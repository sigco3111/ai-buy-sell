

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { StockInfo, RecommendationAction, GeminiStockResponse, RetrievedSource, VolatilityInfo, GeminiDailySignalResponse } from '../types';

// API_KEY is now passed as an argument to service functions.
const modelName = 'gemini-2.5-flash';

// Helper function for introducing a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isValidRecommendationAction(action: any): action is RecommendationAction {
  return action === RecommendationAction.BUY || action === RecommendationAction.SELL;
}

function isValidVolatilityInfo(info: any): info is Omit<VolatilityInfo, 'relevance'> {
  return info && 
         typeof info.name === 'string' && 
         typeof info.value === 'string' &&
         typeof info.status === 'string' &&
         typeof info.description === 'string' && 
         (typeof info.lastKnownStatusTime === 'string' || typeof info.lastKnownStatusTime === 'undefined');
}

export const getStockRecommendation = async (query: string, apiKey: string): Promise<Omit<StockInfo, 'historicalData' | 'actualSimulatedPerformance'>> => {
  if (!apiKey) { 
    return Promise.reject(new Error("API 키가 제공되지 않았습니다. API 키를 설정한 후 다시 시도해주세요."));
  }
  
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `사용자가 입력한 주식 또는 ETF의 티커 또는 종목명은 '${query}'입니다.
이 종목에 대한 투자 의견을 '매수' 또는 '매도' 중 하나로 *반드시* 제시해주십시오.
귀하의 의견에 대한 **상세하고 포괄적인 이유**를 설명해주십시오. 고려된 주요 요인들을 명확히 밝혀주십시오.

또한, 분석된 주식의 시장을 기반으로 관련 시장 변동성 지수에 대한 정보를 포함해주십시오:
- 주식이 한국 시장(예: KOSPI, KOSDAQ)에 상장된 경우, 'VKOSPI (코스피200 변동성 지수)'에 대해 설명해주십시오.
- 주식이 국제 시장(예: NASDAQ, NYSE 등 미국 시장)에 상장된 경우, 'VIX (CBOE 변동성 지수)'에 대해 설명해주십시오.

변동성 지수 정보에는 다음을 포함해야 합니다:
  - name: 지수명 (예: "VKOSPI" 또는 "VIX")
  - value: Google 검색을 통해 파악된 현재 또는 최근 지수의 실제 숫자 값 (문자열, 예: "20.5" 또는 "36.37"). 찾을 수 없다면 "N/A"로 명시.
  - status: 해당 지수 값에 대한 질적 평가 (예: "매우 높음", "높음", "보통", "낮음", "매우 낮음", "안정적"). 찾을 수 없다면 "정보 없음"으로 명시.
  - description: 현재 변동성 지수 상태에 대한 **간결한 분석** (1-2 문장). 지수 자체에 대한 일반적인 설명보다는, 현재 상태가 시장에 어떤 의미를 가지는지 요약합니다.
  - lastKnownStatusTime: 지수 값 또는 상태의 기준 시각 (예: "2023년 10월 26일 장마감 기준", "실시간 업데이트" 또는 "최신 취합 정보 기준"). Google 검색에서 명확한 기준 시각을 찾을 수 없는 경우 "최신 취합 정보 기준"으로 명시하십시오. (선택 사항)

응답은 다음 JSON 형식이어야 합니다:
\`\`\`json
{
  "recommendation": "매수" | "매도",
  "reason": "상세하고 포괄적인 이유. 여러 문장으로 구성될 수 있습니다. 입력 정보가 모호했다면, 그 점을 언급하고 판단 근거를 상세히 설명하십시오.",
  "stockName": "인식된 종목명 (예: 삼성전자)",
  "ticker": "인식된 티커 (예: 005930 또는 AAPL)",
  "market": "시장 구분 (예: KOSPI, KOSDAQ, NASDAQ, NYSE 등)",
  "volatilityIndex": {
    "name": "VKOSPI",
    "value": "25.76",
    "status": "보통",
    "description": "VKOSPI 지수가 보통 수준을 유지하고 있어, 시장은 단기적으로 비교적 안정적인 상태로 평가됩니다. 그러나 특정 경제 지표 발표에 따라 변동성이 확대될 수 있습니다.",
    "lastKnownStatusTime": "최신 취합 정보 기준"
  }
}
\`\`\`
만약 입력된 정보로 특정 종목을 명확히 식별하기 어렵더라도, 최선을 다해 주어진 정보를 바탕으로 '매수' 또는 '매도' 중 하나의 의견과 그 상세한 이유, 관련 변동성 지수 정보를 제시해야 합니다.
'보류' 또는 '판단 불가'와 같은 응답은 허용되지 않습니다.
항상 JSON 형식으로만 응답해주십시오. 다른 설명은 추가하지 마십시오.
`;

  let geminiApiResponse: GenerateContentResponse | undefined = undefined;
  let attempt = 0;
  const maxRetries = 3; 
  let currentDelay = 2000; 

  while (attempt < maxRetries) {
    try {
      geminiApiResponse = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.3, 
          tools: [{googleSearch: {}}], 
        },
      });
      break; 
    } catch (error: any) {
      attempt++;
      const isRateLimitError = error.message?.includes('"code":429') && error.message?.includes('"RESOURCE_EXHAUSTED"');
      // Check for API key specific errors
      const isApiKeyError = error.message?.includes("API key not valid") || 
                            error.message?.includes("API_KEY_INVALID") || 
                            error.message?.includes("API key is not valid") || // Common variations
                            (error.status === 400 && error.message?.includes("API_KEY_INVALID")); // Example for some SDKs

      if (isApiKeyError) {
         throw new Error("제공된 API 키가 유효하지 않습니다. 확인 후 다시 시도해주세요.");
      }

      if (attempt >= maxRetries || !isRateLimitError) {
        console.error(`Error getting stock recommendation from Gemini (attempt ${attempt}/${maxRetries}):`, error);
        throw new Error(`AI 전체 추천 분석 중 오류가 발생했습니다 (시도 ${attempt}/${maxRetries}): ${error.message || '알 수 없는 오류'}`);
      }
      
      console.warn(`Attempt ${attempt} for stock recommendation failed with rate limit error. Retrying in ${currentDelay}ms...`);
      await delay(currentDelay);
      currentDelay *= 3; 
    }
  }

  if (!geminiApiResponse) {
    throw new Error("AI로부터 응답을 받지 못했습니다 (모든 재시도 실패).");
  }

  try {
    const rawResponseText = geminiApiResponse.text?.trim();

    if (!rawResponseText) {
        const finishReason = geminiApiResponse.candidates?.[0]?.finishReason;
        const safetyRatings = geminiApiResponse.candidates?.[0]?.safetyRatings;
        let errorMessage = "AI로부터 응답을 받지 못했습니다.";
        if (finishReason) {
            switch (finishReason) {
                case "STOP": errorMessage = "AI가 응답했지만 내용이 비어있습니다. 입력 내용이나 요청이 너무 모호하거나, 모델이 현재 요청에 대해 적절한 답변을 생성할 수 없는 경우 발생할 수 있습니다."; break;
                case "MAX_TOKENS": errorMessage = "AI 응답이 최대 토큰 길이에 도달하여 잘렸습니다. 요청을 더 구체화해 보세요."; break;
                case "SAFETY":
                    errorMessage = "AI 응답이 안전 가이드라인에 따라 차단되었습니다.";
                    if (safetyRatings && safetyRatings.length > 0) {
                        const blockedCategories = safetyRatings.filter(r => r.blocked).map(r => r.category).join(', ');
                        if (blockedCategories) errorMessage += ` 차단된 주요 범주: ${blockedCategories}.`;
                    }
                    errorMessage += " 입력 내용을 수정하여 다시 시도해 주세요.";
                    break;
                case "RECITATION": errorMessage = "AI 응답이 소스 자료를 과도하게 인용하여 차단되었습니다. 다른 방식으로 질문해 주세요."; break;
                case "OTHER": errorMessage = "알 수 없는 이유로 AI가 응답 생성을 완료하지 못했습니다 (OTHER)."; break;
                default: errorMessage = `AI가 응답을 생성하지 못했습니다 (종료 사유: ${finishReason}).`; break;
            }
        }
        throw new Error(errorMessage);
    }

    let jsonStr: string;
    const fenceRegex = /```(?:json)?\s*\n?(.*?)\n?\s*```/s; 
    const fenceMatch = rawResponseText.match(fenceRegex);

    if (fenceMatch && fenceMatch[1]) { 
      jsonStr = fenceMatch[1].trim();
    } else if (rawResponseText.trim().startsWith("{") && rawResponseText.trim().endsWith("}")) {
      jsonStr = rawResponseText.trim();
    } else {
      console.error("AI response is not in valid JSON format for general recommendation. Raw response:", rawResponseText);
      throw new Error(`AI의 전체 추천 응답이 JSON 형식이 아닙니다. 응답 시작: ${rawResponseText.substring(0, 100)}...`);
    }
    
    const parsedData = JSON.parse(jsonStr) as GeminiStockResponse;

    if (!isValidRecommendationAction(parsedData.recommendation)) {
        console.error(`Invalid recommendation value from AI: ${parsedData.recommendation}`);
        throw new Error(`AI가 유효한 투자 의견('매수' 또는 '매도' 중 하나)을 제시하지 못했습니다. AI 응답: ${parsedData.recommendation}`);
    }
    
    const finalRecommendation = parsedData.recommendation as RecommendationAction;

    let retrievedSources: RetrievedSource[] = [];
    const groundingMetadata = geminiApiResponse.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata?.groundingChunks && groundingMetadata.groundingChunks.length > 0) {
      retrievedSources = groundingMetadata.groundingChunks
        .map(chunk => chunk.web)
        .filter(webSource => webSource?.uri && webSource?.title)
        .map(webSource => ({
          uri: webSource.uri as string, 
          title: webSource.title as string, 
        }));
    }

    let volatilityInfo: VolatilityInfo | undefined = undefined;
    if (parsedData.volatilityIndex && isValidVolatilityInfo(parsedData.volatilityIndex)) {
        volatilityInfo = parsedData.volatilityIndex as VolatilityInfo;
    } else if (parsedData.volatilityIndex) {
        console.warn("Received partial or invalid volatilityIndex data from AI. Fields received:", Object.keys(parsedData.volatilityIndex).join(', '));
        const vi = parsedData.volatilityIndex;
        if (typeof vi.name === 'string' && typeof vi.description === 'string') {
             volatilityInfo = { 
                 name: vi.name,
                 value: typeof vi.value === 'string' ? vi.value : "N/A",
                 status: typeof vi.status === 'string' ? vi.status : "정보 없음",
                 description: vi.description,
                 lastKnownStatusTime: typeof vi.lastKnownStatusTime === 'string' ? vi.lastKnownStatusTime : undefined,
             };
             console.warn("Using partially valid volatilityIndex data with defaults for missing/invalid fields.");
        } else {
            console.error("Critical fields (name, description) missing in volatilityIndex, cannot use. Received name:", vi.name, "value:", vi.value, "status:", vi.status, "desc:", vi.description);
        }
    }

    return {
      recommendation: finalRecommendation,
      reason: parsedData.reason || "AI가 이유를 제공하지 않았습니다.",
      stockName: parsedData.stockName,
      ticker: parsedData.ticker,
      market: parsedData.market,
      retrievedSources: retrievedSources.length > 0 ? retrievedSources : undefined,
      volatilityInfo: volatilityInfo,
    };

  } catch (error: any) {
    console.error("Error processing stock recommendation from Gemini:", error);
     if (error.message?.includes("제공된 API 키가 유효하지 않습니다")) { // Propagate API key error
        throw error;
    }
    throw new Error(`AI 추천 분석 결과 처리 중 오류: ${error.message || '알 수 없는 내부 오류'}`);
  }
};


export const getDailyStockSignal = async (
    ticker: string, 
    market: string, 
    date: string,
    apiKey: string
): Promise<RecommendationAction | "신호 없음"> => {
    if (!apiKey) { 
        console.error(`일일 신호 요청 API 키 오류: ${ticker} (${date}). API 키가 제공되지 않았습니다.`);
        return "신호 없음"; 
    }
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
You are a stock trading AI. The simulated current date is ${date}.
Analyze the stock/ETF '${ticker}' (market: ${market}) based on information available *up to and including ${date}*.
Provide a trading signal: '매수' (Buy) or '매도' (Sell).
Do not use any information after ${date}.

Respond in the following JSON format ONLY:
\`\`\`json
{
  "signal": "매수"
}
\`\`\`
Or:
\`\`\`json
{
  "signal": "매도"
}
\`\`\`
Ensure your response strictly adheres to this JSON format. Your entire response must be only this JSON structure.
`;

    try {
        const geminiApiResponse = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                temperature: 0.2, 
                tools: [{ googleSearch: {} }],
            },
        });

        const rawResponseText = geminiApiResponse.text?.trim();

        if (!rawResponseText) {
            const finishReason = geminiApiResponse.candidates?.[0]?.finishReason;
            console.warn(`AI daily signal response text is empty for ${ticker} on ${date}. Finish Reason: ${finishReason}`);
             if (finishReason === "SAFETY") {
                const safetyRatings = geminiApiResponse.candidates?.[0]?.safetyRatings;
                if (safetyRatings && safetyRatings.length > 0) {
                    const blockedCategories = safetyRatings.filter(r => r.blocked).map(r => r.category).join(', ');
                    console.warn(`Daily signal for ${ticker} on ${date} blocked due to SAFETY. Categories: ${blockedCategories}`);
                }
            }
            return "신호 없음";
        }

        let jsonStr: string;
        const fenceRegex = /```(?:json)?\s*\n?(.*?)\n?\s*```/s;
        const fenceMatch = rawResponseText.match(fenceRegex);

        if (fenceMatch && fenceMatch[1]) {
            jsonStr = fenceMatch[1].trim();
        } else if (rawResponseText.trim().startsWith("{") && rawResponseText.trim().endsWith("}")) {
            jsonStr = rawResponseText.trim();
        } else {
            console.error(`AI daily signal response for ${ticker} on ${date} is not in valid JSON format. Raw response:`, rawResponseText);
            return "신호 없음";
        }
        
        const parsedData = JSON.parse(jsonStr) as GeminiDailySignalResponse;

        if (isValidRecommendationAction(parsedData.signal)) {
            return parsedData.signal as RecommendationAction;
        } else {
            console.warn(`Invalid daily signal value from AI for ${ticker} on ${date}: ${parsedData.signal}`);
            return "신호 없음";
        }

    } catch (error: any) {
        const isApiKeyError = error.message?.includes("API key not valid") || 
                            error.message?.includes("API_KEY_INVALID") ||
                            error.message?.includes("제공된 API 키가 유효하지 않습니다");
        if (isApiKeyError) {
             console.error(`API Key error during daily signal for ${ticker} on ${date}: ${error.message}`);
             // Potentially throw or handle differently if App.tsx needs to know about this specific failure type
        }
        console.error(`Error getting daily stock signal for ${ticker} on ${date}:`, error);
        return "신호 없음";
    }
};
