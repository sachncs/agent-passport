"""Agent Passport Python SDK client.

Uses the `requests` library for HTTP transport so it integrates cleanly
with the `responses` mocking library used in tests.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any, Callable, Dict, Optional

import requests

from .errors import (
    AgentPassportError,
    AuthenticationError,
    ConnectionError,
    IdempotencyError,
    NotFoundError,
    PaymentRequiredError,
    RateLimitError,
    ServerError,
    TimeoutError,
    ValidationError,
)
from .retry import RETRYABLE_STATUSES, compute_backoff, is_retryable_status
from .types import (
    CounterpartyCheckResponse,
    CreditEstimateResponse,
    EndorsementRequest,
    EndorsementResponse,
    HealthResponse,
    PaymentProof,
    PaymentRequirements,
    PassportResponse,
    ReputationRecordResponse,
    ReputationResponse,
    RevocationRequest,
    RevocationResponse,
    SybilCheckResponse,
    TrustGraphResponse,
    TrustScoreResponse,
    UnderwriteResponse,
    DelegationResponse,
)

WALLET_REGEX = re.compile(r"^[A-Z2-7]{58}$")
USER_AGENT = "agent-passport-sdk/0.2.0 (python)"

__all__ = ["AgentPassportClient"]


def _is_wallet(s: str) -> bool:
    return isinstance(s, str) and bool(WALLET_REGEX.match(s))


def _error_from_response(
    status: int,
    body: Dict[str, Any],
    request_id: Optional[str],
    retry_after: Optional[int] = None,
) -> AgentPassportError:
    message = (body or {}).get("error") or f"HTTP {status}"
    if status == 400:
        return ValidationError(message, body, request_id)
    if status == 401:
        return AuthenticationError(message, body, request_id)
    if status == 402:
        return PaymentRequiredError(body, request_id)
    if status == 404:
        return NotFoundError(message, body, request_id)
    if status == 408:
        return TimeoutError(message, request_id)
    if status == 409:
        err = (body or {}).get("error", "")
        if isinstance(err, str) and "idempotency" in err.lower():
            return IdempotencyError(message, body, request_id)
        return AgentPassportError(message, 409, body, request_id)
    if status == 429:
        return RateLimitError(message, retry_after, request_id)
    if status >= 500:
        return ServerError(message, body, request_id)
    return AgentPassportError(message, status, body, request_id)


class AgentPassportClient:
    """Client for the Agent Passport stateless API.

    Args:
        base_url: Base URL of the Agent Passport API.
        api_key: Optional API key for authentication.
        timeout: Request timeout in seconds.
        retries: Number of retry attempts for failed requests.
        retry_delay: Base delay between retries in seconds.
        on_payment_required: Callback for x402 payment handling.

    Example:
        >>> client = AgentPassportClient("https://passport.example.com")
        >>> score = client.get_score("AAAA...AAA")
        >>> print(score["trustScore"])
    """

    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        timeout: int = 30,
        retries: int = 3,
        retry_delay: float = 1.0,
        on_payment_required: Optional[Callable[[PaymentRequirements], PaymentProof]] = None,
        headers: Optional[Dict[str, str]] = None,
        session: Optional[requests.Session] = None,
    ):
        if not base_url:
            raise ValueError("base_url is required")
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.retries = retries
        self.retry_delay = retry_delay
        self.on_payment_required = on_payment_required
        self.default_headers = headers or {}
        self.session = session or requests.Session()

    @staticmethod
    def validate_wallet(wallet: str) -> None:
        """Validate an Algorand wallet address.

        Args:
            wallet: 58-character base32 Algorand address.

        Raises:
            ValidationError: If the wallet address is invalid.
        """
        if not isinstance(wallet, str) or not WALLET_REGEX.match(wallet):
            raise ValidationError(
                "Invalid Algorand wallet address. Must be 58-character base32 (A-Z, 2-7)."
            )

    def _build_headers(
        self,
        idempotency_key: Optional[str] = None,
        x_payment: Optional[str] = None,
    ) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
            **self.default_headers,
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        if x_payment:
            headers["x-payment"] = x_payment
        return headers

    def _request(
        self,
        method: str,
        path: str,
        body: Optional[Dict[str, Any]] = None,
        idempotency_key: Optional[str] = None,
        x_payment: Optional[str] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = self._build_headers(idempotency_key=idempotency_key, x_payment=x_payment)
        json_body = body if method != "GET" else None

        last_error: Optional[AgentPassportError] = None

        for attempt in range(self.retries + 1):
            try:
                resp = self.session.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=json_body,
                    timeout=self.timeout,
                )

                request_id = resp.headers.get("X-Request-ID")
                retry_after_header = resp.headers.get("Retry-After")
                retry_after: Optional[int] = None
                if retry_after_header:
                    try:
                        retry_after = int(retry_after_header)
                    except ValueError:
                        retry_after = None

                if resp.status_code == 402 and self.on_payment_required and not x_payment:
                    try:
                        body_data = resp.json()
                    except (ValueError, json.JSONDecodeError):
                        body_data = {}
                    requirements = PaymentRequirements.from_dict(body_data)
                    proof = self.on_payment_required(requirements)
                    return self._request(
                        method, path, body,
                        idempotency_key=idempotency_key,
                        x_payment=proof.payment_header,
                    )

                if not resp.ok:
                    try:
                        err_data = resp.json()
                    except (ValueError, json.JSONDecodeError):
                        err_data = {}
                    err = _error_from_response(resp.status_code, err_data, request_id, retry_after)
                    if not is_retryable_status(resp.status_code, RETRYABLE_STATUSES):
                        raise err
                    last_error = err
                else:
                    try:
                        payload = resp.json()
                    except (ValueError, json.JSONDecodeError):
                        payload = {}
                    return payload if isinstance(payload, dict) else {"data": payload}

            except requests.exceptions.Timeout:
                last_error = TimeoutError()
            except requests.exceptions.ConnectionError as e:
                last_error = ConnectionError(str(e))
            except requests.exceptions.RequestException as e:
                last_error = ConnectionError(str(e))

            if attempt < self.retries:
                delay = compute_backoff(attempt, self.retry_delay)
                time.sleep(max(0.0, delay))

        raise last_error or AgentPassportError("Request failed after retries", 500)

    # ── Health ────────────────────────────────────────────────────

    def health(self) -> Dict[str, Any]:
        return self._request("GET", "/health")

    # ── Trust Score ───────────────────────────────────────────────

    def get_score(self, wallet: str) -> Dict[str, Any]:
        self.validate_wallet(wallet)
        return self._request("GET", f"/score?wallet={wallet}")

    # ── Delegation ────────────────────────────────────────────────

    def get_delegation(self, wallet: str) -> Dict[str, Any]:
        self.validate_wallet(wallet)
        return self._request("GET", f"/delegation?wallet={wallet}")

    # ── Counterparty Check ────────────────────────────────────────

    def check_counterparty(self, buyer: str) -> Dict[str, Any]:
        self.validate_wallet(buyer)
        return self._request("POST", "/counterparty-check", {"buyer": buyer})

    # ── Credit Estimate ───────────────────────────────────────────

    def estimate_credit(
        self,
        wallet: str,
        amount: Optional[float] = None,
    ) -> Dict[str, Any]:
        self.validate_wallet(wallet)
        body: Dict[str, Any] = {"wallet": wallet}
        if amount is not None:
            body["amount"] = amount
        return self._request("POST", "/credit-estimate", body)

    # ── Sybil Check ───────────────────────────────────────────────

    def check_sybil(self, wallet: str) -> Dict[str, Any]:
        self.validate_wallet(wallet)
        return self._request("GET", f"/sybil-check?wallet={wallet}")

    # ── Reputation ────────────────────────────────────────────────

    def get_reputation(self, wallet: str) -> Dict[str, Any]:
        self.validate_wallet(wallet)
        return self._request("GET", f"/reputation?wallet={wallet}")

    def record_reputation_event(
        self,
        wallet: str,
        event_type: str,
        amount: Optional[float] = None,
        counterparty: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        self.validate_wallet(wallet)
        body: Dict[str, Any] = {"wallet": wallet, "eventType": event_type}
        if amount is not None:
            body["amount"] = amount
        if counterparty is not None:
            self.validate_wallet(counterparty)
            body["counterparty"] = counterparty
        return self._request("POST", "/reputation/record", body, idempotency_key=idempotency_key)

    # ── Underwrite ────────────────────────────────────────────────

    def underwrite(self, wallet: str) -> Dict[str, Any]:
        self.validate_wallet(wallet)
        return self._request("GET", f"/underwrite?wallet={wallet}")

    # ── Trust Graph ───────────────────────────────────────────────

    def get_trust_graph(self, wallet: str) -> Dict[str, Any]:
        self.validate_wallet(wallet)
        return self._request("GET", f"/trust-graph?wallet={wallet}")

    # ── Passport ──────────────────────────────────────────────────

    def get_passport(self, wallet: str) -> Dict[str, Any]:
        self.validate_wallet(wallet)
        return self._request("GET", f"/passport?wallet={wallet}")

    def create_passport(self, wallet: str) -> Dict[str, Any]:
        """Generate a new Agent Passport document. Alias for get_passport."""
        return self.get_passport(wallet)

    # ── Endorse (on-chain delegation) ─────────────────────────────

    def endorse(self, req: EndorsementRequest) -> Dict[str, Any]:
        self.validate_wallet(req.sponsor)
        self.validate_wallet(req.agent)
        if req.sponsor == req.agent:
            raise ValidationError("Sponsor and agent must be different wallets")
        if not isinstance(req.amount, (int, float)) or req.amount <= 0:
            raise ValidationError("Amount must be a positive finite number")
        return self._request(
            "POST",
            "/delegate",
            {"sponsor": req.sponsor, "agent": req.agent, "amount": req.amount},
            idempotency_key=req.idempotency_key,
        )

    # ── Revoke (on-chain revocation) ──────────────────────────────

    def revoke(self, req: RevocationRequest) -> Dict[str, Any]:
        self.validate_wallet(req.sponsor)
        self.validate_wallet(req.agent)
        return self._request(
            "POST",
            "/revoke",
            {"sponsor": req.sponsor, "agent": req.agent},
            idempotency_key=req.idempotency_key,
        )
