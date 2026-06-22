#!/usr/bin/env python3
"""
Agent Passport Python SDK
Stateless wallet trust scoring for AI agents on Algorand.
"""

from typing import Optional
import urllib.request
import json

WALLET_REGEX = r'^[A-Z2-7]{58}$'


class APIError(Exception):
    """Raised when the API returns an error response."""

    def __init__(self, message: str, status_code: int, details: Optional[dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details


class AgentPassportClient:
    """Client for the Agent Passport stateless API."""

    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _request(self, method: str, path: str) -> dict:
        url = f"{self.base_url}{path}"
        headers = {"Accept": "application/json"}

        req = urllib.request.Request(url, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            try:
                data = json.loads(body)
                msg = data.get("error", body)
            except json.JSONDecodeError:
                msg = body
            raise APIError(msg, e.code) from e

    def score_wallet(self, wallet: str) -> dict:
        """Get trust score for an Algorand wallet.

        Returns a dict with keys: wallet, trustScore, riskLevel, approved,
        recommendedLimit, breakdown, onChain, explanation.
        """
        import re
        if not re.fullmatch(WALLET_REGEX, wallet):
            raise APIError("Invalid Algorand wallet address", 400)
        return self._request("GET", f"/score?wallet={wallet}")

    def health(self) -> dict:
        """Check API health.

        Returns a dict with keys: status, service, version, network, timestamp.
        """
        return self._request("GET", "/health")
