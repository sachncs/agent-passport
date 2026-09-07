"""Agent Passport Python SDK.

Stateless wallet trust scoring for AI agents on Algorand.
"""

from .client import AgentPassportClient
from .errors import (
    AgentPassportError,
    APIError,
    AuthenticationError,
    PaymentRequiredError,
    NotFoundError,
    RateLimitError,
    IdempotencyError,
    ValidationError,
    ServerError,
    TimeoutError,
    ConnectionError,
)
from .types import (
    AgentPassportConfig,
    TrustScoreResponse,
    DelegationResponse,
    CounterpartyCheckResponse,
    CreditEstimateResponse,
    SybilCheckResponse,
    ReputationResponse,
    ReputationRecordResponse,
    UnderwriteResponse,
    TrustGraphResponse,
    PassportResponse,
    HealthResponse,
    EndorsementRequest,
    EndorsementResponse,
    RevocationRequest,
    RevocationResponse,
    PaymentRequirements,
    PaymentProof,
)

__version__ = "0.2.0"

__all__ = [
    "AgentPassportClient",
    "AgentPassportError",
    "APIError",
    "AuthenticationError",
    "PaymentRequiredError",
    "NotFoundError",
    "RateLimitError",
    "IdempotencyError",
    "ValidationError",
    "ServerError",
    "TimeoutError",
    "ConnectionError",
    "AgentPassportConfig",
    "TrustScoreResponse",
    "DelegationResponse",
    "CounterpartyCheckResponse",
    "CreditEstimateResponse",
    "SybilCheckResponse",
    "ReputationResponse",
    "ReputationRecordResponse",
    "UnderwriteResponse",
    "TrustGraphResponse",
    "PassportResponse",
    "HealthResponse",
    "EndorsementRequest",
    "EndorsementResponse",
    "RevocationRequest",
    "RevocationResponse",
    "PaymentRequirements",
    "PaymentProof",
    "__version__",
]
