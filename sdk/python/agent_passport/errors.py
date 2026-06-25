"""Typed exception hierarchy for the Agent Passport Python SDK."""

from __future__ import annotations

from typing import Any, Dict, Optional


class AgentPassportError(Exception):
    """Base class for all Agent Passport SDK errors."""

    def __init__(
        self,
        message: str,
        status_code: int,
        details: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
    ):
        super().__init__(message)
        self.name = "AgentPassportError"
        self.status_code = status_code
        self.details = details
        self.request_id = request_id

    def __repr__(self) -> str:
        return f"{self.name}(status_code={self.status_code}, message='{self}')"


# Backwards-compatible alias
APIError = AgentPassportError


class ValidationError(AgentPassportError):
    """Raised when input validation fails (HTTP 400)."""

    def __init__(self, message: str = "Validation failed", details: Optional[Dict[str, Any]] = None, request_id: Optional[str] = None):
        super().__init__(message, 400, details, request_id)
        self.name = "ValidationError"


class AuthenticationError(AgentPassportError):
    """Raised when authentication fails (HTTP 401)."""

    def __init__(self, message: str = "Authentication failed", details: Optional[Dict[str, Any]] = None, request_id: Optional[str] = None):
        super().__init__(message, 401, details, request_id)
        self.name = "AuthenticationError"


class PaymentRequiredError(AgentPassportError):
    """Raised when the server returns HTTP 402 (x402 payment required)."""

    def __init__(self, requirements: Dict[str, Any], request_id: Optional[str] = None):
        super().__init__("Payment required (x402)", 402, requirements, request_id)
        self.name = "PaymentRequiredError"
        self.requirements = requirements


class NotFoundError(AgentPassportError):
    """Raised when a resource is not found (HTTP 404)."""

    def __init__(self, message: str = "Resource not found", details: Optional[Dict[str, Any]] = None, request_id: Optional[str] = None):
        super().__init__(message, 404, details, request_id)
        self.name = "NotFoundError"


class TimeoutError(AgentPassportError):  # noqa: F811
    """Raised when a request times out (HTTP 408)."""

    def __init__(self, message: str = "Request timed out", request_id: Optional[str] = None):
        super().__init__(message, 408, None, request_id)
        self.name = "TimeoutError"


class IdempotencyError(AgentPassportError):
    """Raised when an Idempotency-Key is reused with a different body (HTTP 409)."""

    def __init__(self, message: str = "Idempotency conflict: same key with different body", details: Optional[Dict[str, Any]] = None, request_id: Optional[str] = None):
        super().__init__(message, 409, details, request_id)
        self.name = "IdempotencyError"


class RateLimitError(AgentPassportError):
    """Raised when the client is being rate-limited (HTTP 429)."""

    def __init__(self, message: str = "Rate limit exceeded", retry_after: Optional[int] = None, request_id: Optional[str] = None):
        super().__init__(message, 429, {"retry_after": retry_after}, request_id)
        self.name = "RateLimitError"
        self.retry_after = retry_after


class ServerError(AgentPassportError):
    """Raised when the server returns HTTP 5xx."""

    def __init__(self, message: str = "Server error", details: Optional[Dict[str, Any]] = None, request_id: Optional[str] = None):
        super().__init__(message, 500, details, request_id)
        self.name = "ServerError"


class ConnectionError(AgentPassportError):
    """Raised when a connection error occurs (no HTTP response)."""

    def __init__(self, message: str = "Connection error", request_id: Optional[str] = None):
        super().__init__(message, 503, None, request_id)
        self.name = "ConnectionError"
