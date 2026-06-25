"""Tests for the Agent Passport Python SDK.

Uses the `responses` library to mock urllib requests.
"""

from __future__ import annotations

import json
import pytest
import responses

from agent_passport import (
    AgentPassportClient,
    AuthenticationError,
    AgentPassportError,
    IdempotencyError,
    NotFoundError,
    PaymentRequiredError,
    RateLimitError,
    ServerError,
    ValidationError,
    EndorsementRequest,
    RevocationRequest,
    PaymentRequirements,
    PaymentProof,
)

BASE_URL = "https://passport.example.com"

VALID_WALLET = "GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX"
ALT_WALLET = "ALT7V52CKSH5F2S6L4XJ7UKI3DPEHBQJAHOV4DKRY7GNU3CJQX6FMT2BIP"


@pytest.fixture
def client() -> AgentPassportClient:
    return AgentPassportClient(base_url=BASE_URL, retries=0)


# ── Construction ──────────────────────────────────────────────────


def test_raises_on_missing_base_url() -> None:
    with pytest.raises(ValueError):
        AgentPassportClient(base_url="")  # type: ignore[arg-type]


def test_strips_trailing_slash() -> None:
    c = AgentPassportClient(base_url=BASE_URL + "/")
    assert c.base_url == BASE_URL


def test_applies_default_timeout_retries() -> None:
    c = AgentPassportClient(base_url=BASE_URL)
    assert c.timeout == 30
    assert c.retries == 3
    assert c.retry_delay == 1.0


# ── Validation ────────────────────────────────────────────────────


def test_rejects_invalid_wallet_on_get_score(client: AgentPassportClient) -> None:
    with pytest.raises(ValidationError):
        client.get_score("invalid")


def test_rejects_empty_wallet(client: AgentPassportClient) -> None:
    with pytest.raises(ValidationError):
        client.get_score("")


def test_rejects_57_char_wallet(client: AgentPassportClient) -> None:
    with pytest.raises(ValidationError):
        client.get_score("A" * 57)


def test_rejects_59_char_wallet(client: AgentPassportClient) -> None:
    with pytest.raises(ValidationError):
        client.get_score("A" * 59)


# ── Health ────────────────────────────────────────────────────────


@responses.activate
def test_health(client: AgentPassportClient) -> None:
    responses.add(
        responses.GET,
        f"{BASE_URL}/health",
        json={"status": "ok", "service": "Agent Passport"},
        status=200,
    )
    res = client.health()
    assert res["status"] == "ok"


# ── Trust Score ───────────────────────────────────────────────────


@responses.activate
def test_get_score_passes_through_2xx(client: AgentPassportClient) -> None:
    responses.add(
        responses.GET,
        f"{BASE_URL}/score",
        json={"wallet": VALID_WALLET, "trustScore": 75, "riskLevel": "low"},
        status=200,
    )
    res = client.get_score(VALID_WALLET)
    assert res["trustScore"] == 75


@responses.activate
def test_get_score_404_maps_to_not_found(client: AgentPassportClient) -> None:
    responses.add(
        responses.GET,
        f"{BASE_URL}/score",
        json={"error": "Wallet not found"},
        status=404,
    )
    with pytest.raises(NotFoundError):
        client.get_score(VALID_WALLET)


@responses.activate
def test_get_score_400_maps_to_validation_error(client: AgentPassportClient) -> None:
    responses.add(
        responses.GET,
        f"{BASE_URL}/score",
        json={"error": "Invalid wallet"},
        status=400,
    )
    with pytest.raises(ValidationError):
        client.get_score(VALID_WALLET)


@responses.activate
def test_get_score_500_maps_to_server_error(client: AgentPassportClient) -> None:
    responses.add(
        responses.GET,
        f"{BASE_URL}/score",
        json={"error": "Internal error"},
        status=500,
    )
    with pytest.raises(ServerError):
        client.get_score(VALID_WALLET)


# ── Headers ───────────────────────────────────────────────────────


@responses.activate
def test_authorization_header_set_when_api_key_configured() -> None:
    client = AgentPassportClient(base_url=BASE_URL, api_key="secret", retries=0)
    responses.add(
        responses.GET,
        f"{BASE_URL}/health",
        json={"status": "ok"},
        status=200,
    )
    client.health()
    sent = responses.calls[0].request
    assert sent.headers.get("Authorization") == "Bearer secret"


@responses.activate
def test_idempotency_key_header_set_on_endorse() -> None:
    client = AgentPassportClient(base_url=BASE_URL, retries=0)
    responses.add(
        responses.POST,
        f"{BASE_URL}/delegate",
        json={"txId": "tx1"},
        status=201,
    )
    client.endorse(EndorsementRequest(sponsor=VALID_WALLET, agent=ALT_WALLET, amount=1000, idempotency_key="key-12345678"))
    sent = responses.calls[0].request
    assert sent.headers.get("Idempotency-Key") == "key-12345678"


# ── Endorse ───────────────────────────────────────────────────────


@responses.activate
def test_endorse_sends_post_to_delegate(client: AgentPassportClient) -> None:
    responses.add(
        responses.POST,
        f"{BASE_URL}/delegate",
        json={"txId": "tx1"},
        status=201,
    )
    client.endorse(EndorsementRequest(sponsor=VALID_WALLET, agent=ALT_WALLET, amount=1000))
    assert len(responses.calls) == 1
    sent = responses.calls[0].request
    assert sent.method == "POST"
    body = json.loads(sent.body)
    assert body == {"sponsor": VALID_WALLET, "agent": ALT_WALLET, "amount": 1000}


def test_endorse_rejects_self_delegation(client: AgentPassportClient) -> None:
    with pytest.raises(ValidationError):
        client.endorse(EndorsementRequest(sponsor=VALID_WALLET, agent=VALID_WALLET, amount=1000))


def test_endorse_rejects_non_positive_amount(client: AgentPassportClient) -> None:
    with pytest.raises(ValidationError):
        client.endorse(EndorsementRequest(sponsor=VALID_WALLET, agent=ALT_WALLET, amount=0))


@responses.activate
def test_endorse_503_when_registry_not_configured(client: AgentPassportClient) -> None:
    responses.add(
        responses.POST,
        f"{BASE_URL}/delegate",
        json={"error": "Registry not configured", "code": "REGISTRY_NOT_CONFIGURED"},
        status=503,
    )
    with pytest.raises(ServerError):
        client.endorse(EndorsementRequest(sponsor=VALID_WALLET, agent=ALT_WALLET, amount=1000))


# ── Revoke ────────────────────────────────────────────────────────


@responses.activate
def test_revoke_sends_post_to_revoke(client: AgentPassportClient) -> None:
    responses.add(
        responses.POST,
        f"{BASE_URL}/revoke",
        json={"txId": "tx1"},
        status=200,
    )
    client.revoke(RevocationRequest(sponsor=VALID_WALLET, agent=ALT_WALLET))
    sent = responses.calls[0].request
    body = json.loads(sent.body)
    assert body == {"sponsor": VALID_WALLET, "agent": ALT_WALLET}


# ── Counterparty ──────────────────────────────────────────────────


@responses.activate
def test_check_counterparty_sends_buyer(client: AgentPassportClient) -> None:
    responses.add(
        responses.POST,
        f"{BASE_URL}/counterparty-check",
        json={"allow": True, "confidence": 0.9, "riskLevel": "low", "trustScore": 80},
        status=200,
    )
    res = client.check_counterparty(VALID_WALLET)
    assert res["allow"] is True
    sent = responses.calls[0].request
    body = json.loads(sent.body)
    assert body == {"buyer": VALID_WALLET}


# ── Underwrite ────────────────────────────────────────────────────


@responses.activate
def test_underwrite_sends_get(client: AgentPassportClient) -> None:
    responses.add(
        responses.GET,
        f"{BASE_URL}/underwrite",
        json={"wallet": VALID_WALLET, "approved": True, "compositeScore": 80},
        status=200,
    )
    res = client.underwrite(VALID_WALLET)
    assert res["approved"] is True


# ── Create Passport ───────────────────────────────────────────────


@responses.activate
def test_create_passport_is_alias_for_get_passport(client: AgentPassportClient) -> None:
    responses.add(
        responses.GET,
        f"{BASE_URL}/passport",
        json={"wallet": VALID_WALLET, "checksum": "abc"},
        status=200,
    )
    res = client.create_passport(VALID_WALLET)
    assert res["wallet"] == VALID_WALLET


# ── Reputation ────────────────────────────────────────────────────


@responses.activate
def test_record_reputation_event_with_idempotency_key(client: AgentPassportClient) -> None:
    responses.add(
        responses.POST,
        f"{BASE_URL}/reputation/record",
        json={"wallet": VALID_WALLET, "eventType": "payment"},
        status=200,
    )
    client.record_reputation_event(VALID_WALLET, "payment", amount=100, idempotency_key="key-87654321")
    sent = responses.calls[0].request
    assert sent.headers.get("Idempotency-Key") == "key-87654321"


# ── Error mapping ─────────────────────────────────────────────────


@responses.activate
def test_409_idempotency_error(client: AgentPassportClient) -> None:
    responses.add(
        responses.POST,
        f"{BASE_URL}/delegate",
        json={"error": "Idempotency-Key conflict"},
        status=409,
    )
    with pytest.raises(IdempotencyError):
        client.endorse(EndorsementRequest(sponsor=VALID_WALLET, agent=ALT_WALLET, amount=1000))


@responses.activate
def test_429_rate_limit_error(client: AgentPassportClient) -> None:
    responses.add(
        responses.GET,
        f"{BASE_URL}/score",
        json={"error": "Too many requests"},
        status=429,
        headers={"Retry-After": "60"},
    )
    with pytest.raises(RateLimitError) as exc_info:
        client.get_score(VALID_WALLET)
    assert exc_info.value.retry_after == 60


@responses.activate
def test_401_maps_to_authentication_error(client: AgentPassportClient) -> None:
    responses.add(
        responses.GET,
        f"{BASE_URL}/score",
        json={"error": "Auth required"},
        status=401,
    )
    with pytest.raises(AuthenticationError):
        client.get_score(VALID_WALLET)


# ── x402 callback ─────────────────────────────────────────────────


@responses.activate
def test_402_invokes_payment_callback() -> None:
    requirements_data = {
        "amount": "0.005",
        "network": "eip155:84532",
        "payTo": "PAYEE",
    }
    responses.add(
        responses.GET,
        f"{BASE_URL}/score",
        json=requirements_data,
        status=402,
    )
    responses.add(
        responses.GET,
        f"{BASE_URL}/score",
        json={"wallet": VALID_WALLET, "trustScore": 80},
        status=200,
    )

    captured: dict = {}

    def on_payment_required(req: PaymentRequirements) -> PaymentProof:
        captured["amount"] = req.amount
        captured["network"] = req.network
        return PaymentProof(payment_header="payment-tx-1")

    client = AgentPassportClient(
        base_url=BASE_URL,
        retries=0,
        on_payment_required=on_payment_required,
    )
    res = client.get_score(VALID_WALLET)
    assert res["trustScore"] == 80
    assert captured["amount"] == "0.005"
    assert captured["network"] == "eip155:84532"

    # Second request should have x-payment header
    second_request = responses.calls[1].request
    assert second_request.headers.get("x-payment") == "payment-tx-1"
