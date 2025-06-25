export enum RecommendationAction {
  BUY = "매수",
  SELL = "매도",
}

export interface RetrievedSource {
  title: string;
  uri: string;
}

export interface VolatilityInfo {
  name: string; // e.g., "VKOSPI", "VIX"
  value: string; // e.g., "20.5", "36.37" - The actual numeric value of the index.
  status: string; // e.g., "매우 높음", "보통", "안정적" - Qualitative assessment.
  description: string; // Concise analysis of the current volatility status and its implications (1-2 sentences).
  lastKnownStatusTime?: string; // e.g., "2025. 6. 25. 오전 7:30 기준" or "최신 취합 정보 기준"
}

export interface HistoricalDataPoint {
  date: string; // YYYY-MM-DD
  open: number;
  close: number;
}

export interface Transaction {
  date: string;       // YYYY-MM-DD
  action: string;     // e.g., "매수", "매도", "공매도 진입", "공매도 청산"
  price: number;
  shares: number;
}

export interface DailySimulationRecord {
  date: string;
  dayOpenPrice: number;
  dayClosePrice: number;
  aiSignalForDay: RecommendationAction | "신호 없음"; // Updated type
  actionOnDay: string; // e.g., "매수 진입", "보유", "공매도 진입", "포지션 없음", "AI 신호 없음 - 보유"
  positionAfterDay: 'LONG' | 'SHORT' | 'NONE';
  sharesHeldAfterDay: number;
  portfolioValueAtDayClose: number;
}

export interface ActualSimulatedPerformance {
  startingCapital: number;
  endingCapital: number;
  entryPrice?: number; 
  exitPrice?: number;  
  entryDate?: string; 
  exitDate?: string;   
  actionTaken?: RecommendationAction; // Made optional as simulation now driven by daily signals
  numberOfShares?: number; 
  profit: number;
  profitPercentage: number;
  tradingDays: number;
  transactions: Transaction[]; 
  dailyLog: DailySimulationRecord[]; 
  isPositionOpen: boolean; 
}

export interface StockInfo {
  recommendation: RecommendationAction;
  reason: string;
  stockName?: string;
  ticker?: string;
  market?: string;
  retrievedSources?: RetrievedSource[];
  volatilityInfo?: VolatilityInfo;
  historicalData?: HistoricalDataPoint[];
  actualSimulatedPerformance?: ActualSimulatedPerformance;
}

export interface GeminiStockResponse {
  recommendation: RecommendationAction | string; 
  reason: string;
  stockName?: string;
  ticker?: string;
  market?: string;
  volatilityIndex?: Omit<VolatilityInfo, 'relevance'>;
}

// For the new daily signal service
export interface GeminiDailySignalResponse {
    signal: RecommendationAction | string;
}