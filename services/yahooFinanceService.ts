
import { HistoricalDataPoint } from '../types';

// Helper to format ticker for Yahoo Finance
const formatTickerForYahoo = (ticker: string, market: string): string => {
  const upperMarket = market.toUpperCase();
  if (upperMarket === 'KOSPI') {
    return `${ticker}.KS`;
  }
  if (upperMarket === 'KOSDAQ') {
    return `${ticker}.KQ`;
  }
  // For US markets like NASDAQ, NYSE, AMEX, ticker usually works as is
  return ticker;
};

// Function to generate MOCKED historical data
const generateMockData = (ticker: string, calendarDaysToGenerateAround: number = 45): HistoricalDataPoint[] => {
  const data: HistoricalDataPoint[] = [];
  let currentDate = new Date(); // Start from today and go back

  let nextDayClose = 50 + (ticker.charCodeAt(0) % 50); 
  if (ticker.includes('.KS') || ticker.includes('.KQ')) {
    nextDayClose *= 1000;
  }
  // Slightly reduce random daily trend for more varied data over shorter periods
  const trendFactor = 1 + (Math.random() - 0.5) * 0.0015; 

  // Generate for a bit more than 30 trading days to account for weekends
  // Aim for roughly 'calendarDaysToGenerateAround' calendar days in the past
  const targetPastDate = new Date();
  targetPastDate.setDate(targetPastDate.getDate() - calendarDaysToGenerateAround);

  while (currentDate >= targetPastDate) {
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) { // Skip weekends (Sunday=0, Saturday=6)
      const dateStr = currentDate.toISOString().split('T')[0];
      
      const openPriceFluctuation = (Math.random() - 0.48) * (nextDayClose * 0.03); // Base fluctuation on previous close
      const openPrice = Math.max(1, nextDayClose + openPriceFluctuation);
      
      const closePriceFluctuation = (Math.random() - 0.5) * (openPrice * 0.03); // Base fluctuation on open
      const closePrice = Math.max(1, openPrice + closePriceFluctuation);
      
      data.unshift({ // Add to the beginning to keep it sorted oldest to newest
        date: dateStr,
        open: parseFloat(openPrice.toFixed(2)),
        close: parseFloat(closePrice.toFixed(2)),
      });
      nextDayClose = closePrice / trendFactor; // Update for next iteration (previous day)
    }
    currentDate.setDate(currentDate.getDate() - 1);
  }
  // Ensure we have at least 30, but not excessively more.
  // This mock generation is approximate. A real API would be more precise.
  // The actual slicing to 30 days will happen in App.tsx after fetching.
  return data; 
};


/**
 * Fetches historical stock data for the given ticker and market.
 * !!! THIS IS A MOCKED IMPLEMENTATION !!!
 */
export const fetchHistoricalData = async (
  ticker: string,
  market: string
): Promise<HistoricalDataPoint[]> => {
  const yahooTicker = formatTickerForYahoo(ticker, market);
  console.log(`Fetching MOCKED historical data for Yahoo ticker: ${yahooTicker}`);

  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 300));

  // Generate mock data for roughly 30 trading days (pass around 45 calendar days)
  const mockData = generateMockData(yahooTicker, 45); 

  if (Math.random() < 0.05) { 
    console.warn(`MOCK: No data found for ${yahooTicker}`);
    return [];
  }
  
  console.log(`MOCK: Returning ${mockData.length} data points for ${yahooTicker}. App will slice to 30.`);
  return mockData;
  // --- END OF MOCKED RESPONSE ---
};
