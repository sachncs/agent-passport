const WALLET_REGEX = /^[A-Z2-7]{58}$/;

export interface AgentPassportConfig {
  baseUrl: string;
  timeout?: number;
}

export interface WalletTrustScore {
  wallet: string;
  trustScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  approved: boolean;
  recommendedLimit: number;
  breakdown: {
    ageScore: number;
    activityScore: number;
    volumeScore: number;
    velocityScore: number;
    complianceScore: number;
  };
  onChain: {
    balanceAlgo: number;
    totalTxns: number;
    assetCount: number;
    appCount: number;
    accountAgeDays: number;
    firstSeenRound: number;
    lastSeenRound: number;
  };
  explanation: string[];
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  network: string;
  timestamp: string;
}

export class AgentPassportClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: AgentPassportConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout || 30000;
  }

  private async request<T>(method: string, path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new APIError(data.error || 'Request failed', response.status, data);
      }

      return data as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async scoreWallet(wallet: string): Promise<WalletTrustScore> {
    if (!WALLET_REGEX.test(wallet)) {
      throw new APIError('Invalid Algorand wallet address', 400);
    }
    return this.request<WalletTrustScore>('GET', `/score?wallet=${wallet}`);
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/health');
  }
}

export class APIError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.details = details;
  }
}
