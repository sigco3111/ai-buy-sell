
import React, { useEffect, useRef } from 'react';
import { Chart, registerables, type ScriptableContext, type TooltipItem } from 'chart.js';
import { ActualSimulatedPerformance, HistoricalDataPoint, RecommendationAction, DailySimulationRecord, Transaction } from '../types';
import { ChartBarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '../constants';

Chart.register(...registerables);

const formatCurrency = (value: number | undefined, ticker: string, currency: string = 'USD') => {
    if (value === undefined || isNaN(value)) return 'N/A';
    const effectiveCurrency = ticker.toUpperCase().includes('.KS') || ticker.toUpperCase().includes('.KQ') ? 'KRW' : currency;
    const options: Intl.NumberFormatOptions = { style: 'currency', currency: effectiveCurrency };
    if (effectiveCurrency === 'KRW') {
        options.minimumFractionDigits = 0;
        options.maximumFractionDigits = 0;
    } else {
        options.minimumFractionDigits = 2;
        options.maximumFractionDigits = 2;
    }
    return value.toLocaleString(effectiveCurrency === 'KRW' ? 'ko-KR' : 'en-US', options);
};

const formatShares = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return 'N/A';
    return value.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    try {
        const date = new Date(dateString);
         if (isNaN(date.getTime())) return dateString; // Invalid date
        return date.toLocaleDateString('ko-KR', options);
    } catch (e) {
        return dateString; 
    }
};


interface SimulationResultCardProps {
  performanceData: ActualSimulatedPerformance;
  historicalData: HistoricalDataPoint[]; 
  ticker: string;
}

const SimulationResultCard: React.FC<SimulationResultCardProps> = ({ performanceData, historicalData, ticker }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const {
    startingCapital,
    endingCapital,
    profit,
    profitPercentage,
    tradingDays, 
    dailyLog,
    transactions,
    isPositionOpen,
    // actionTaken, // This is the initial overall AI recommendation, kept for context if needed
  } = performanceData;

  const profitLossColor = profit >= 0 ? 'text-green-400' : 'text-red-400';
  const cardBorderColor = profit >= 0 ? 'border-green-500' : 'border-red-500';
  const TrendIcon = profit >= 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;

  useEffect(() => {
    if (chartRef.current && dailyLog.length > 0) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        const labels = dailyLog.map(d => formatDate(d.date));
        const closePrices = dailyLog.map(d => d.dayClosePrice);
        
        const transactionPoints = dailyLog.map((logDay, index) => {
            const txOnDay = transactions.find(tx => tx.date === logDay.date);
            if (txOnDay) {
                return {
                    index,
                    action: txOnDay.action,
                    price: txOnDay.price,
                };
            }
            return null;
        }).filter(p => p !== null) as {index: number, action: string, price: number}[];


        chartInstanceRef.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: `${ticker} 종가`,
                data: closePrices,
                borderColor: 'rgb(59, 130, 246)', 
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.1,
                fill: true,
                pointRadius: 2,
                pointHoverRadius: 4,
                pointBackgroundColor: 'rgba(59, 130, 246, 0.5)',
                pointBorderColor: 'rgb(59, 130, 246)',
              },
              { // Dataset for transaction markers
                label: '거래 지점',
                data: dailyLog.map((logDay, index) => {
                    const txPoint = transactionPoints.find(p => p.index === index);
                    return txPoint ? txPoint.price : null; // Plot at transaction price on the day's close price line
                }),
                pointStyle: (context: ScriptableContext<"line">) => {
                    const tx = transactionPoints.find(p => p.index === context.dataIndex);
                    if (tx) {
                       if (tx.action.includes("매수") || tx.action.includes("공매도 청산")) return 'triangle'; // Buy-like
                       if (tx.action.includes("매도") || tx.action.includes("공매도 진입")) return 'rectRot'; // Sell-like
                    }
                    return false; // Don't show point if no transaction
                },
                pointRadius: (context: ScriptableContext<"line">) => transactionPoints.some(p => p.index === context.dataIndex) ? 8 : 0,
                pointHoverRadius: (context: ScriptableContext<"line">) => transactionPoints.some(p => p.index === context.dataIndex) ? 10 : 0,
                pointBackgroundColor: (context: ScriptableContext<"line">) => {
                    const tx = transactionPoints.find(p => p.index === context.dataIndex);
                    if (tx) {
                        if (tx.action.includes("매수") || tx.action.includes("공매도 청산")) return 'rgba(74, 222, 128, 1)'; // Green
                        if (tx.action.includes("매도") || tx.action.includes("공매도 진입")) return 'rgba(248, 113, 113, 1)'; // Red
                    }
                    return 'transparent';
                },
                borderColor: 'transparent', // No line for this dataset
                backgroundColor: 'transparent',
                showLine: false,
              }
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: '#9ca3af', maxRotation: 45, minRotation:30, autoSkipPadding: 20 },
              },
              y: {
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: '#9ca3af', callback: (value) => typeof value === 'number' ? formatCurrency(value, ticker) : value },
              },
            },
            plugins: {
              legend: { labels: { color: '#d1d5db' } },
              tooltip: {
                callbacks: {
                  label: (tooltipItem: TooltipItem<"line">) => {
                    let label = `${tooltipItem.dataset.label || ''}: ${formatCurrency(tooltipItem.parsed.y, ticker)}`;
                    if (tooltipItem.datasetIndex === 1) { // Transaction dataset
                        const tx = transactionPoints.find(p => p.index === tooltipItem.dataIndex);
                        if (tx) {
                           label = `거래: ${tx.action} @ ${formatCurrency(tx.price, ticker)}`;
                        } else {
                            return null; // Don't show tooltip for non-transaction points on this dataset
                        }
                    }
                    return label;
                  },
                   title: (tooltipItems: TooltipItem<"line">[]) => {
                      if (!tooltipItems || tooltipItems.length === 0 || tooltipItems[0].dataIndex >= dailyLog.length) return '';
                      const logEntry = dailyLog[tooltipItems[0].dataIndex];
                      let title = formatDate(logEntry.date);
                      const tx = transactions.find(t => t.date === logEntry.date);
                      if (tx) {
                          title += ` (${tx.action})`;
                      }
                      return title;
                   }
                },
              },
            },
          },
        });
      }
    }
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [dailyLog, transactions, ticker]); 

  const summaryText = () => {
    const numTrades = transactions.filter(tx => !tx.action.includes("평가")).length;
    let summary = `AI의 일일 신호를 기반으로 ${tradingDays}일간 시뮬레이션을 진행했습니다. 총 ${numTrades}건의 거래가 발생했습니다. `;
    
    if (isPositionOpen) {
      const lastAction = dailyLog[dailyLog.length-1].actionOnDay;
      summary += `시뮬레이션 종료일 현재 포지션을 보유 중이며 (최종 행동: ${lastAction}), 최종일 종가 기준 미실현 수익은 `;
    } else {
      summary += `최종 실현 수익은 `;
    }
    summary += `<span class="font-semibold ${profitLossColor}">${formatCurrency(profit, ticker)} (${profitPercentage.toFixed(2)}%)</span> 입니다.`;
    return summary;
  };


  return (
    <div className={`w-full max-w-xl mx-auto mt-6 p-5 sm:p-6 bg-gray-800 rounded-xl shadow-2xl overflow-hidden border-t-2 ${cardBorderColor}`}>
      <div className="relative z-10">
        <div className="flex items-center mb-4">
          <ChartBarIcon className={`w-7 h-7 mr-3 ${profitLossColor}`} />
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-100">
            {tradingDays}일 거래 시뮬레이션 (일일 AI 신호 기반)
          </h2>
        </div>

        <div className="mb-5 p-4 bg-gray-700/50 rounded-lg">
          <p className="text-sm text-center text-gray-300" dangerouslySetInnerHTML={{ __html: summaryText() }}></p>
        </div>
        
        <div className="h-64 sm:h-80 mb-6">
          <canvas ref={chartRef}></canvas>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-6 text-gray-300">
          <div>
            <p className="text-xs text-gray-400">시작 자본금:</p>
            <p className="text-md font-medium">{formatCurrency(startingCapital, ticker)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">최종 자산가치:</p>
            <p className={`text-md font-medium ${profitLossColor}`}>{formatCurrency(endingCapital, ticker)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">{isPositionOpen ? '미실현 수익/손실:' : '수익/손실:'}</p>
            <div className={`flex items-center text-lg font-bold ${profitLossColor}`}>
                <TrendIcon className="w-5 h-5 mr-1" />
                {formatCurrency(profit, ticker)}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400">수익률:</p>
            <p className={`text-lg font-bold ${profitLossColor}`}>{profitPercentage.toFixed(2)}%</p>
          </div>
           {isPositionOpen && (
            <div>
                <p className="text-xs text-gray-400">포지션 상태:</p>
                <p className="text-md font-medium text-yellow-400">보유 중</p>
            </div>
           )}
        </div>

        {dailyLog && dailyLog.length > 0 && (
            <div className="mt-6 pt-5 border-t border-gray-700/50">
                <h3 className="text-lg font-semibold text-gray-200 mb-3">상세 일일 로그:</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-700/80 max-h-96">
                    <table className="min-w-full divide-y divide-gray-700 text-xs">
                        <thead className="bg-gray-700 sticky top-0 z-10">
                            <tr>
                                <th scope="col" className="px-2 py-2 text-left font-medium text-gray-300 uppercase tracking-wider">날짜</th>
                                <th scope="col" className="px-2 py-2 text-right font-medium text-gray-300 uppercase tracking-wider">시가</th>
                                <th scope="col" className="px-2 py-2 text-right font-medium text-gray-300 uppercase tracking-wider">종가</th>
                                <th scope="col" className="px-2 py-2 text-center font-medium text-gray-300 uppercase tracking-wider">AI 신호</th>
                                <th scope="col" className="px-2 py-2 text-left font-medium text-gray-300 uppercase tracking-wider">당일 행동</th>
                                <th scope="col" className="px-2 py-2 text-center font-medium text-gray-300 uppercase tracking-wider">포지션</th>
                                <th scope="col" className="px-2 py-2 text-right font-medium text-gray-300 uppercase tracking-wider">수량</th>
                                <th scope="col" className="px-2 py-2 text-right font-medium text-gray-300 uppercase tracking-wider">일 평가액</th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700/80">
                            {dailyLog.map((log, index) => (
                                <tr key={index} className="hover:bg-gray-700/40 transition-colors duration-150">
                                    <td className="px-2 py-2 whitespace-nowrap text-gray-300">{formatDate(log.date)}</td>
                                    <td className="px-2 py-2 whitespace-nowrap text-gray-300 text-right">{formatCurrency(log.dayOpenPrice, ticker)}</td>
                                    <td className="px-2 py-2 whitespace-nowrap text-gray-300 text-right">{formatCurrency(log.dayClosePrice, ticker)}</td>
                                    <td className={`px-2 py-2 whitespace-nowrap font-medium text-center ${
                                        log.aiSignalForDay === RecommendationAction.BUY ? 'text-green-400' :
                                        log.aiSignalForDay === RecommendationAction.SELL ? 'text-red-400' : 'text-gray-500'
                                    }`}>
                                        {log.aiSignalForDay}
                                    </td>
                                    <td className="px-2 py-2 whitespace-nowrap text-gray-300 text-left" title={log.actionOnDay.startsWith("AI 신호 없음") ? "AI로부터 해당 날짜의 신호를 받지 못해 이전 포지션을 유지했습니다." : ""}>
                                      {log.actionOnDay}
                                    </td>
                                    <td className="px-2 py-2 whitespace-nowrap text-gray-300 text-center">
                                        {log.positionAfterDay === 'NONE' ? '-' : log.positionAfterDay}
                                    </td>
                                    <td className="px-2 py-2 whitespace-nowrap text-gray-300 text-right">{formatShares(log.sharesHeldAfterDay > 0 ? log.sharesHeldAfterDay : 0)}</td>
                                    <td className="px-2 py-2 whitespace-nowrap text-gray-300 text-right">{formatCurrency(log.portfolioValueAtDayClose, ticker)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        <div className="mt-6 pt-5 border-t border-gray-700/50">
          <p className="text-xs text-gray-500 leading-relaxed">
            주의: 본 시뮬레이션은 AI의 과거 특정일에 대한 가정적 판단에 따른 가상 거래 결과이며, 단순 참고용입니다. 
            실제 투자 수익을 보장하지 않으며, 모든 투자 결정은 사용자의 판단과 책임 하에 이루어져야 합니다.
            거래는 해당일의 시초가 기준으로, 평가는 종가 기준으로 이루어졌다고 가정합니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SimulationResultCard;
