"""Typed dataclass responses for the Agent Passport Python SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Literal, Optional, Union

RiskLevel = Literal["low", "medium", "high", "critical"]


@dataclass
class PaymentRequirements:
    amount: str
    network: str
    pay_to: str

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PaymentRequirements":
        return cls(
            amount=str(data.get("amount", "")),
            network=str(data.get("network", "")),
            pay_to=str(data.get("payTo", "")),
        )


@dataclass
class PaymentProof:
    payment_header: str


@dataclass
class AgentPassportConfig:
    base_url: str
    api_key: Optional[str] = None
    timeout: int = 30
    retries: int = 3
    retry_delay: float = 1.0
    on_payment_required: Optional[Callable[[PaymentRequirements], PaymentProof]] = None
    headers: Dict[str, str] = field(default_factory=dict)


@dataclass
class TrustScoreBreakdown:
    age_score: float
    activity_score: float
    volume_score: float
    velocity_score: float
    compliance_score: float


@dataclass
class OnChainInfo:
    balance_algo: float
    total_txns: int
    asset_count: int
    app_count: int
    account_age_days: int
    first_seen_round: int
    last_seen_round: int


@dataclass
class TrustScoreResponse:
    wallet: str
    trust_score: float
    risk_level: RiskLevel
    approved: bool
    recommended_limit: float
    breakdown: TrustScoreBreakdown
    on_chain: OnChainInfo
    explanation: List[str]


@dataclass
class DelegationBreakdown:
    depth_score: float
    sponsor_quality_score: float
    sponsor_count_score: float
    amount_score: float


@dataclass
class DelegationInfo:
    depth: int
    sponsor_count: int
    sponsor_quality: float
    delegation_path: List[str]
    total_delegated_amount: float
    is_trust_anchor: bool
    trusted_ancestors: int


@dataclass
class DelegationResponse:
    wallet: str
    trust_score: float
    risk_level: RiskLevel
    approved: bool
    recommended_limit: float
    breakdown: DelegationBreakdown
    delegation: DelegationInfo
    explanation: List[str]


@dataclass
class CounterpartyCheckResponse:
    allow: bool
    confidence: float
    risk_level: RiskLevel
    trust_score: float
    on_chain_score: float
    delegation_score: float
    explanation: List[str]


@dataclass
class CreditEstimateBreakdown:
    balance_capacity: float
    activity_bonus: float
    age_bonus: float
    risk_penalty: float


@dataclass
class CreditEstimateResponse:
    wallet: str
    estimated_limit: float
    risk: RiskLevel
    confidence: float
    approved: bool
    breakdown: CreditEstimateBreakdown
    explanation: List[str]


@dataclass
class SybilSignals:
    creation_clustering: float
    interaction_density: float
    balance_similarity: float
    circular_activity: float
    timing_regularity: float
    amount_fingerprint: float
    funding_correlation: float


@dataclass
class SybilCheckResponse:
    wallet: str
    sybil_risk: float
    risk_level: RiskLevel
    confidence: float
    cluster_size: int
    signals: SybilSignals
    flagged_wallets: List[str]
    explanation: List[str]


@dataclass
class ReputationBreakdown:
    successful_payments: int
    successful_purchases: int
    disputes: int
    refunds: int
    sponsor_endorsements: int
    service_interactions: int
    total_events: int
    positive_events: int
    negative_events: int


@dataclass
class ReputationResponse:
    wallet: str
    reputation: float
    risk_level: RiskLevel
    confidence: float
    breakdown: ReputationBreakdown
    explanation: List[str]


@dataclass
class ReputationRecordResponse:
    wallet: str
    event_type: str
    amount: float
    round: int
    timestamp: int


@dataclass
class UnderwritingFactors:
    trust_score: float
    delegation_score: float
    sybil_risk: float
    reputation: float


@dataclass
class UnderwriteResponse:
    wallet: str
    approved: bool
    composite_score: float
    risk_level: RiskLevel
    recommended_limit: float
    confidence: float
    factors: UnderwritingFactors
    explanation: List[str]


@dataclass
class TrustGraphInfo:
    depth: int
    node_count: int
    edge_count: int
    clustering_coefficient: float
    hub_score: float
    intermediate_density: float


@dataclass
class TrustGraphExposure:
    total_exposure: float
    direct_exposure: float
    transitive_exposure: float


@dataclass
class TrustGraphWhatIf:
    removal_impact: float
    weakest_link_risk: float


@dataclass
class TrustGraphResponse:
    wallet: str
    graph: TrustGraphInfo
    exposure: TrustGraphExposure
    what_if: TrustGraphWhatIf
    explanation: List[str]


@dataclass
class PassportResponse:
    wallet: str
    generated_at: str
    block_round: int
    schema_version: int
    identity_strength: float
    trust_score: float
    trust_risk_level: RiskLevel
    reputation: float
    reputation_risk_level: RiskLevel
    total_events: int
    payment_reliability: float
    credit_limit: float
    credit_risk: RiskLevel
    risk: float
    sybil_risk: float
    overall_risk_level: RiskLevel
    checksum: str
    summary: str
    explanation: List[str]


@dataclass
class HealthResponse:
    status: str
    service: str
    version: str
    network: str
    x402: bool
    timestamp: str
    algorand_connected: Optional[bool] = None
    algorand_round: Optional[int] = None
    algorand_error: Optional[str] = None


@dataclass
class EndorsementRequest:
    sponsor: str
    agent: str
    amount: float
    idempotency_key: Optional[str] = None


@dataclass
class EndorsementResponse:
    tx_id: str
    sponsor: str
    agent: str
    amount: float
    round: int
    timestamp: int


@dataclass
class RevocationRequest:
    sponsor: str
    agent: str
    idempotency_key: Optional[str] = None


@dataclass
class RevocationResponse:
    tx_id: str
    sponsor: str
    agent: str
    round: int
    timestamp: int
