

import React, { useState, useCallback, useEffect } from 'react';
import InputForm from './components/InputForm';
import RecommendationCard from './components/RecommendationCard';
import VolatilityCard from './components/VolatilityCard';
import SimulationResultCard from './components/SimulationResultCard';
import ErrorMessage from './components/ErrorMessage';
import { LoadingSpinner, ChartBarIcon, KeyIcon } from './constants';
import { getStockRecommendation, getDailyStockSignal } from './services/geminiService';
import { fetchHistoricalData } from './services/yahooFinanceService';
import { StockInfo, RecommendationAction, HistoricalDataPoint, ActualSimulatedPerformance, Transaction, DailySimulationRecord } from './types';

const SIMULATION_PERIOD_OPTIONS = [7, 14, 30];
const MAX_SIMULATION_DAYS = Math.max(...SIMULATION_PERIOD_OPTIONS); // 30
const LOCAL_STORAGE_API_KEY = 'geminiApiKey';

enum ApiKeyStatus {
  UNKNOWN = 'unknown',
  MISSING = 'missing',
  PROVIDED = 'provided', // Key is present (env or local storage), not yet fully validated by API call for this session
  VALIDATED = 'validated', // Key was successfully used
  INVALID = 'invalid',
  SAVING = 'saving',
}

// Helper function for introducing a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const App: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const [simulationPerformance, setSimulationPerformance] = useState<ActualSimulatedPerformance | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationProgress, setSimulationProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedSimulationDays, setSelectedSimulationDays] = useState<number>(SIMULATION_PERIOD_OPTIONS[0]);

  const [currentApiKey, setCurrentApiKey] = useState<string>('');
  const [inputApiKey, setInputApiKey] = useState<string>('');
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>(ApiKeyStatus.UNKNOWN);

  useEffect(() => {
    const keyFromStorage = localStorage.getItem(LOCAL_STORAGE_API_KEY);
    const keyFromEnv = process.env.API_KEY; // Assumed to be available if set

    if (keyFromStorage) {
      setCurrentApiKey(keyFromStorage);
      setInputApiKey(keyFromStorage);
      setApiKeyStatus(ApiKeyStatus.PROVIDED);
    } else if (keyFromEnv) {
      setCurrentApiKey(keyFromEnv);
      setInputApiKey(keyFromEnv); // Let user see and potentially override env key
      setApiKeyStatus(ApiKeyStatus.PROVIDED);
    } else {
      setApiKeyStatus(ApiKeyStatus.MISSING);
    }
  }, []);
  
  const handleSaveApiKey = () => {
    if (!inputApiKey.trim()) {
        setError("API 키를 입력해주세요.");
        setApiKeyStatus(currentApiKey ? ApiKeyStatus.PROVIDED : ApiKeyStatus.MISSING); // Revert to previous status if input is cleared
        return;
    }
    setApiKeyStatus(ApiKeyStatus.SAVING);
    localStorage.setItem(LOCAL_STORAGE_API_KEY, inputApiKey);
    setCurrentApiKey(inputApiKey);
    // Optimistically set to PROVIDED. Actual validation happens on API call.
    setApiKeyStatus(ApiKeyStatus.PROVIDED); 
    setError(null); // Clear previous API key errors
    // Optionally, you could trigger a lightweight test API call here for immediate validation.
  };


  useEffect(() => {
    setSimulationPerformance(null);
  }, [stockInfo, selectedSimulationDays]);

  const calculateSimulation = useCallback(async (
    stockTicker: string,
    stockMarket: string,
    historicalData: HistoricalDataPoint[],
    daysToSimulate: number,
    startingCapital: number = 1000000 
  ): Promise<ActualSimulatedPerformance | null> => {
    if (!currentApiKey) {
      setError("API 키가 설정되지 않아 시뮬레이션을 진행할 수 없습니다.");
      setApiKeyStatus(ApiKeyStatus.MISSING);
      return null;
    }
    if (historicalData.length < daysToSimulate) {
      setError(`시뮬레이션 계산 오류: 과거 데이터(최소 ${daysToSimulate}거래일)가 충분하지 않습니다. 보유 데이터: ${historicalData.length}일.`);
      return null;
    }

    const sortedData = [...historicalData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const simulationPeriodData = sortedData.slice(-daysToSimulate);

    if (simulationPeriodData.length < daysToSimulate) {
      setError(`시뮬레이션 기간 설정 오류: 필터링 후 데이터가 ${simulationPeriodData.length}일치만 남아, ${daysToSimulate}일 시뮬레이션이 불가능합니다.`);
      return null;
    }
    
    let currentCapital = startingCapital;
    let sharesHeld = 0;
    let currentPosition: 'LONG' | 'NONE' = 'NONE';
    const transactionsLog: Transaction[] = [];
    const dailyLog: DailySimulationRecord[] = [];
    let averageBuyPrice = 0; 

    for (let i = 0; i < simulationPeriodData.length; i++) {
      const dayData = simulationPeriodData[i];
      setSimulationProgress(`AI 신호 분석 중: ${i + 1} / ${daysToSimulate}일 (${dayData.date})`);
      
      await delay(500); 

      const aiSignalToday: RecommendationAction | "신호 없음" = await getDailyStockSignal(stockTicker, stockMarket, dayData.date, currentApiKey);
      
      if (aiSignalToday === "신호 없음" && apiKeyStatus !== ApiKeyStatus.INVALID) {
         // Check if this "신호 없음" might be due to a (potentially new) API key issue from getDailyStockSignal
         // getDailyStockSignal currently console.errors API key issues but returns "신호 없음"
         // This part may need refinement if getDailyStockSignal starts throwing for API key errors
      }

      let actionOnDay: string = "보유"; 
      let entryOrExitPriceThisDay: number | undefined = undefined;

      if (dayData.open <= 0 || isNaN(dayData.open)) {
           console.warn(`유효하지 않은 시가 데이터 (${dayData.date}): ${dayData.open}. 해당일 거래 건너뜀.`);
           actionOnDay = "데이터 오류 - 거래 불가";
      } else {
          entryOrExitPriceThisDay = dayData.open; 

          if (aiSignalToday === RecommendationAction.BUY) {
              if (currentPosition === 'NONE') {
                  sharesHeld = currentCapital / entryOrExitPriceThisDay;
                  averageBuyPrice = entryOrExitPriceThisDay;
                  currentCapital = 0; 
                  currentPosition = 'LONG';
                  actionOnDay = `매수 진입 @ ${entryOrExitPriceThisDay.toFixed(2)}`;
                  transactionsLog.push({ date: dayData.date, action: "매수", price: entryOrExitPriceThisDay, shares: sharesHeld });
              } else { 
                  actionOnDay = "보유 (매수 신호)";
              }
          } else if (aiSignalToday === RecommendationAction.SELL) {
              if (currentPosition === 'LONG') {
                  currentCapital = sharesHeld * entryOrExitPriceThisDay;
                  actionOnDay = `매도 청산 @ ${entryOrExitPriceThisDay.toFixed(2)}`;
                  transactionsLog.push({ date: dayData.date, action: "매도", price: entryOrExitPriceThisDay, shares: sharesHeld });
                  sharesHeld = 0;
                  averageBuyPrice = 0;
                  currentPosition = 'NONE';
              } else { 
                  actionOnDay = "관망 (매도 신호 - 공매도 비활성화)";
              }
          } else { 
              actionOnDay = currentPosition === 'NONE' ? "관망 (신호 없음)" : "보유 (신호 없음)";
          }
      }

      let portfolioValueAtDayClose: number;
      if (currentPosition === 'LONG') {
        portfolioValueAtDayClose = sharesHeld * dayData.close;
      } else { 
        portfolioValueAtDayClose = currentCapital;
      }
      
      dailyLog.push({
        date: dayData.date,
        dayOpenPrice: dayData.open,
        dayClosePrice: dayData.close,
        aiSignalForDay: aiSignalToday,
        actionOnDay: actionOnDay,
        positionAfterDay: currentPosition,
        sharesHeldAfterDay: sharesHeld,
        portfolioValueAtDayClose: portfolioValueAtDayClose
      });
    } 
    setSimulationProgress(''); 

    let finalCapital = currentCapital;
    let isPositionOpenAtEnd = false;
    let finalValuationPrice = simulationPeriodData[simulationPeriodData.length - 1].close;

    if (currentPosition === 'LONG') {
        finalCapital = sharesHeld * finalValuationPrice;
        isPositionOpenAtEnd = true;
        transactionsLog.push({ date: simulationPeriodData[simulationPeriodData.length -1].date, action: "보유종료(평가)", price: finalValuationPrice, shares: sharesHeld });
    }
    
    const profit = finalCapital - startingCapital;
    const profitPercentage = startingCapital !== 0 ? (profit / startingCapital) * 100 : 0;

    setApiKeyStatus(ApiKeyStatus.VALIDATED); // If simulation runs, key is likely valid for these calls

    return {
      startingCapital,
      endingCapital: finalCapital,
      profit,
      profitPercentage,
      tradingDays: simulationPeriodData.length,
      transactions: transactionsLog,
      dailyLog,
      isPositionOpen: isPositionOpenAtEnd,
      actionTaken: stockInfo?.recommendation 
    };
  }, [stockInfo?.recommendation, currentApiKey, apiKeyStatus]);

  const handleFetchRecommendation = useCallback(async () => {
    if (!query.trim()) return;
    if (!currentApiKey) {
      setError("API 키가 설정되지 않았습니다. API 키를 입력하고 저장한 후 다시 시도해주세요.");
      setApiKeyStatus(ApiKeyStatus.MISSING);
      return;
    }

    setIsLoading(true);
    setError(null);
    setStockInfo(null);
    setSimulationProgress('');

    try {
      const baseStockInfo = await getStockRecommendation(query, currentApiKey);
      setStockInfo(baseStockInfo); 
      setApiKeyStatus(ApiKeyStatus.VALIDATED);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("제공된 API 키가 유효하지 않습니다") || err.message?.includes("API_KEY_INVALID")) {
        setError("API 키가 유효하지 않습니다. 확인 후 API 키 관리 섹션에서 다시 저장해주세요.");
        setApiKeyStatus(ApiKeyStatus.INVALID);
      } else if (err.message && err.message.includes("429") && err.message.toUpperCase().includes("RESOURCE_EXHAUSTED")) {
        setError(`API 사용량 한도에 도달했습니다. 잠시 후 다시 시도하거나 Google AI 콘솔에서 할당량을 확인해주세요. (상세: ${err.message})`);
      } else {
        setError(err.message || '추천을 받아오는 중 알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [query, currentApiKey]);

  const handleRunSimulation = useCallback(async () => {
    if (!currentApiKey) {
      setError("API 키가 설정되지 않아 시뮬레이션을 진행할 수 없습니다.");
      setApiKeyStatus(ApiKeyStatus.MISSING);
      return;
    }
    if (!stockInfo || !stockInfo.ticker || !stockInfo.market) {
      setError("시뮬레이션을 실행하기 위한 종목 정보가 부족합니다. AI 분석을 먼저 실행해주세요.");
      return;
    }

    setIsSimulating(true);
    setError(null); 
    setSimulationProgress('과거 데이터 로딩 중...');

    let currentHistoricalData = stockInfo.historicalData;

    if (!currentHistoricalData) {
      try {
        const rawHistoricalData = await fetchHistoricalData(stockInfo.ticker, stockInfo.market);
        const validHistoricalData = rawHistoricalData
          .filter(d => d.open > 0 && d.close > 0)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (validHistoricalData.length < Math.min(...SIMULATION_PERIOD_OPTIONS)) {
          console.warn(`Not enough valid historical data for ${stockInfo.ticker} after fetching. Need at least ${Math.min(...SIMULATION_PERIOD_OPTIONS)}, got ${validHistoricalData.length}.`);
          setError(`시뮬레이션을 위한 최소 과거 데이터(${Math.min(...SIMULATION_PERIOD_OPTIONS)}거래일)가 부족하여 로드하지 못했습니다. (가져온 유효 데이터: ${validHistoricalData.length}일)`);
          setIsSimulating(false);
          setSimulationProgress('');
          setStockInfo(prev => ({ ...prev!, historicalData: validHistoricalData.slice(-(MAX_SIMULATION_DAYS * 2)) }));
          return;
        }
        currentHistoricalData = validHistoricalData.slice(-(MAX_SIMULATION_DAYS * 2)); 
        setStockInfo(prev => ({ ...prev!, historicalData: currentHistoricalData }));
      } catch (dataError: any) {
        console.error("Error fetching or processing historical data for simulation:", dataError);
        setError(`시뮬레이션용 과거 데이터 로딩 중 오류: ${dataError.message}`);
        setIsSimulating(false);
        setSimulationProgress('');
        return;
      }
    }
    
    const effectiveHistoricalData = stockInfo.historicalData || currentHistoricalData;

    if (!effectiveHistoricalData || effectiveHistoricalData.length < selectedSimulationDays) {
      setError(`선택된 ${selectedSimulationDays}일 시뮬레이션을 실행하기에 과거 데이터가 충분하지 않습니다. (보유 데이터: ${effectiveHistoricalData?.length || 0}일)`);
      setIsSimulating(false);
      setSimulationProgress('');
      return;
    }
    
    setSimulationProgress(`AI 시뮬레이션 계산 중...`);
    try {
        const result = await calculateSimulation(
            stockInfo.ticker!, 
            stockInfo.market!, 
            effectiveHistoricalData as HistoricalDataPoint[],
            selectedSimulationDays
        );
        
        if (result) {
            setSimulationPerformance(result);
        } else {
            // Error handling for calculateSimulation returning null (e.g. API key issue handled within)
             if (!error && apiKeyStatus !== ApiKeyStatus.INVALID && apiKeyStatus !== ApiKeyStatus.MISSING) {
                setError("시뮬레이션 계산 중 알 수 없는 오류가 발생하여 결과를 표시할 수 없습니다.");
            }
        }
    } catch (simError: any) {
        console.error("Simulation calculation failed:", simError);
         if (simError.message?.includes("제공된 API 키가 유효하지 않습니다")) {
            setError("API 키가 유효하지 않아 시뮬레이션 중단. API 키를 확인해주세요.");
            setApiKeyStatus(ApiKeyStatus.INVALID);
        } else {
            setError(`시뮬레이션 중 심각한 오류 발생: ${simError.message}`);
        }
    } finally {
        setIsSimulating(false);
        setSimulationProgress('');
    }
  }, [stockInfo, selectedSimulationDays, error, calculateSimulation, currentApiKey, apiKeyStatus]); 


  const canAttemptSimulation = stockInfo && stockInfo.ticker && stockInfo.market && apiKeyStatus !== ApiKeyStatus.MISSING && apiKeyStatus !== ApiKeyStatus.INVALID;
  const isApiKeyConfigured = apiKeyStatus !== ApiKeyStatus.MISSING && apiKeyStatus !== ApiKeyStatus.INVALID && apiKeyStatus !== ApiKeyStatus.UNKNOWN;


  const renderApiKeyStatus = () => {
    switch (apiKeyStatus) {
      case ApiKeyStatus.MISSING:
        return <p className="text-yellow-400 text-xs">API 키가 필요합니다. 키를 입력하고 저장해주세요.</p>;
      case ApiKeyStatus.PROVIDED:
        return <p className="text-blue-400 text-xs">API 키 로드됨. 첫 사용 시 유효성 검증됩니다.</p>;
      case ApiKeyStatus.VALIDATED:
        return <p className="text-green-400 text-xs">API 키 활성됨.</p>;
      case ApiKeyStatus.INVALID:
        return <p className="text-red-400 text-xs">API 키가 유효하지 않습니다. 확인 후 다시 저장해주세요.</p>;
      case ApiKeyStatus.SAVING:
        return <p className="text-gray-400 text-xs">API 키 저장 중...</p>;
      case ApiKeyStatus.UNKNOWN:
      default:
        return <p className="text-gray-500 text-xs">API 키 상태 확인 중...</p>;
    }
  };


  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-start pt-10 sm:pt-16 p-4 selection:bg-blue-500 selection:text-white">
      <header className="text-center mb-6 sm:mb-8 w-full max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
            AI Buy&Sell
          </span>
        </h1>
        <p className="mt-3 text-lg text-gray-400 max-w-xl mx-auto">
          한국 또는 미국 주식/ETF 티커 또는 종목명을 입력하고 AI 기반 투자 의견 및 시뮬레이션 결과를 받아보세요.
        </p>
      </header>

      <div className="w-full max-w-xl mx-auto mb-6 p-4 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
        <div className="flex items-center mb-3">
            <KeyIcon className="w-5 h-5 mr-2 text-yellow-400" />
            <h3 className="text-md font-semibold text-gray-200">Gemini API 키 관리</h3>
        </div>
        <div className="flex items-center space-x-2 mb-2">
            <input
            type="password"
            value={inputApiKey}
            onChange={(e) => setInputApiKey(e.target.value)}
            placeholder="API 키 입력 (로컬 스토리지에 저장)"
            className="flex-grow p-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 outline-none placeholder-gray-500"
            aria-label="Gemini API Key Input"
            />
            <button
            onClick={handleSaveApiKey}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors text-sm disabled:opacity-50"
            disabled={apiKeyStatus === ApiKeyStatus.SAVING}
            >
            {apiKeyStatus === ApiKeyStatus.SAVING ? '저장중...' : '저장'}
            </button>
        </div>
        {renderApiKeyStatus()}
      </div>


      <main className="w-full flex-grow flex flex-col items-center pb-8">
        <InputForm
          query={query}
          onQueryChange={setQuery}
          onSubmit={handleFetchRecommendation}
          isLoading={isLoading || apiKeyStatus === ApiKeyStatus.SAVING}
          // Disable form if API key is missing, invalid, or being saved.
          // Allow input if status is UNKNOWN or PROVIDED, as it might become valid.
        //   disabledReason={!isApiKeyConfigured ? "API 키를 설정해주세요." : undefined}
        />
         {(apiKeyStatus === ApiKeyStatus.MISSING || apiKeyStatus === ApiKeyStatus.INVALID) && (
            <ErrorMessage message="AI 분석 및 시뮬레이션을 사용하려면 먼저 유효한 API 키를 입력하고 저장해주세요." />
        )}


        {isLoading && <LoadingSpinner />} 
        
        {error && (!isLoading || !isSimulating) && <ErrorMessage message={error} />}


        {stockInfo && !isLoading && isApiKeyConfigured && (
          <>
            <RecommendationCard data={stockInfo} />
            {stockInfo.volatilityInfo && (
              <VolatilityCard 
                data={stockInfo.volatilityInfo} 
                recommendation={stockInfo.recommendation} 
              />
            )}
            
            {isSimulating && (
              <div className="mt-4 text-center">
                <LoadingSpinner />
                <p className="text-sm text-gray-400">{simulationProgress || `AI 일일 신호 기반 ${selectedSimulationDays}일 시뮬레이션 실행 중...`}</p>
              </div>
            )}
            
            {canAttemptSimulation && !isSimulating && (
                 <div className="w-full max-w-xl mx-auto mt-6">
                    <div className="mb-3 text-center">
                        <label className="block text-sm font-medium text-gray-300 mb-2">시뮬레이션 기간 선택:</label>
                        <div className="flex justify-center space-x-2">
                        {SIMULATION_PERIOD_OPTIONS.map(days => (
                            <button
                            key={days}
                            onClick={() => setSelectedSimulationDays(days)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ease-in-out
                                ${selectedSimulationDays === days
                                ? 'bg-blue-600 text-white shadow-lg transform scale-105 ring-2 ring-blue-400'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                                }
                                ${isSimulating || !isApiKeyConfigured ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                            disabled={isSimulating || !isApiKeyConfigured}
                            aria-pressed={selectedSimulationDays === days}
                            >
                            {days}일
                            </button>
                        ))}
                        </div>
                    </div>
                    {!simulationPerformance && (
                         <button
                            onClick={handleRunSimulation}
                            disabled={isSimulating || !isApiKeyConfigured}
                            className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-75 transition-all duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                            aria-live="polite"
                            aria-label={`AI 일일 신호 기반 ${selectedSimulationDays}일 거래 시뮬레이션 실행`}
                        >
                            <ChartBarIcon className="w-5 h-5 mr-2" />
                            AI 일일 신호 기반 {selectedSimulationDays}일 시뮬레이션 실행
                        </button>
                    )}
                 </div>
            )}
            
            {error && isSimulating && <ErrorMessage message={error} />} 

            {simulationPerformance && stockInfo.historicalData && stockInfo.ticker && !isSimulating && isApiKeyConfigured && (
              <SimulationResultCard 
                performanceData={simulationPerformance} 
                historicalData={stockInfo.historicalData.slice(-Math.max(simulationPerformance.tradingDays, stockInfo.historicalData.length > simulationPerformance.tradingDays * 1.5 ? simulationPerformance.tradingDays : 0 ))} 
                ticker={stockInfo.ticker}
              />
            )}
            
          </>
        )}
      </main>
      <footer className="w-full text-center py-6 mt-auto">
        <p className="text-xs text-gray-500">
          본 서비스에서 제공되는 정보는 투자 조언이 아니며, 정보 제공 목적으로만 사용됩니다.
          모든 투자 결정은 사용자의 독립적인 판단과 책임 하에 이루어져야 합니다.
          제공자는 정보의 정확성이나 완전성을 보장하지 않으며, 정보 사용으로 인한 어떤 결과에 대해서도 책임을 지지 않습니다.
          일일 AI 신호 기반 시뮬레이션은 과거 데이터에 대한 AI의 가정적 판단이며, 실제 시장 상황과 다를 수 있습니다.
        </p>
      </footer>
    </div>
  );
};

export default App;