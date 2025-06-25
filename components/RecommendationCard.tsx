
import React, { useState } from 'react';
import { StockInfo, RecommendationAction, RetrievedSource } from '../types';
import { ArrowUpIcon, ArrowDownIcon, QuestionMarkCircleIcon, ChevronDownIcon, ArrowTopRightOnSquareIcon } from '../constants';
import Modal from './Modal';

interface RecommendationCardProps {
  data: StockInfo;
}

const REASON_SUMMARY_LENGTH = 75; // Characters to show before "More"

const RecommendationCard: React.FC<RecommendationCardProps> = ({ data }) => {
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);

  const getRecommendationStyles = () => {
    switch (data.recommendation) {
      case RecommendationAction.BUY:
        return {
          bgColor: 'bg-green-600',
          textColor: 'text-green-100',
          borderColor: 'border-green-500',
          icon: <ArrowUpIcon className="w-8 h-8 sm:w-10 sm:h-10 text-green-100" />,
          text: RecommendationAction.BUY,
          gradient: 'from-green-500 to-emerald-600',
        };
      case RecommendationAction.SELL:
        return {
          bgColor: 'bg-red-600',
          textColor: 'text-red-100',
          borderColor: 'border-red-500',
          icon: <ArrowDownIcon className="w-8 h-8 sm:w-10 sm:h-10 text-red-100" />,
          text: RecommendationAction.SELL,
          gradient: 'from-red-500 to-rose-600',
        };
      default: 
        console.warn("Unexpected recommendation value in Card:", data.recommendation);
        return {
          bgColor: 'bg-gray-600',
          textColor: 'text-gray-100',
          borderColor: 'border-gray-500',
          icon: <QuestionMarkCircleIcon className="w-8 h-8 sm:w-10 sm:h-10 text-gray-100" />,
          text: '정보 오류',
          gradient: 'from-gray-500 to-slate-600',
        };
    }
  };

  const styles = getRecommendationStyles();
  
  const trimmedReason = data.reason.trim();
  const showMoreButton = trimmedReason.length > REASON_SUMMARY_LENGTH;
  const reasonSummary = showMoreButton
    ? trimmedReason.substring(0, REASON_SUMMARY_LENGTH) + "..."
    : trimmedReason;

  const getMarketLink = (): string | null => {
    if (!data.ticker) return null;
    const ticker = data.ticker;
    const market = data.market?.toUpperCase();

    if (market === 'KOSPI' || market === 'KOSDAQ') {
      return `https://finance.naver.com/item/main.naver?code=${ticker}`;
    }
    // Default to Yahoo Finance for US markets or if market is unspecified/other
    return `https://finance.yahoo.com/quote/${ticker}`;
  };

  const marketLink = getMarketLink();

  return (
    <>
      <div className={`w-full max-w-xl mx-auto mt-8 p-5 sm:p-8 bg-gray-800 rounded-xl shadow-2xl border-t-4 ${styles.borderColor} overflow-hidden`}>
        <div className={`absolute -top-12 -left-12 w-32 h-32 bg-gradient-radial ${styles.gradient} opacity-20 rounded-full filter blur-2xl`}></div>
        <div className={`absolute -bottom-16 -right-16 w-48 h-48 bg-gradient-radial ${styles.gradient} opacity-15 rounded-full filter blur-3xl`}></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
          <div className={`p-3 sm:p-4 rounded-full ${styles.bgColor} shadow-lg`}>
            {styles.icon}
          </div>
          <div className="flex-grow text-center sm:text-left">
            <h2 className={`text-3xl sm:text-4xl font-bold ${styles.textColor}`}>
              {styles.text}
            </h2>
            {(data.stockName || data.ticker) && (
              <p className="text-lg text-gray-200 mt-1">
                {data.stockName || 'N/A'}
                {data.ticker && <span className="text-gray-400 ml-2">({data.ticker})</span>}
              </p>
            )}
            {data.market && (
               <p className="text-sm text-gray-400">{data.market}</p>
            )}
            {marketLink && (
              <a
                href={marketLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center px-4 py-2 text-sm font-medium text-blue-300 bg-gray-700 hover:bg-gray-600 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors"
                aria-label={`외부 링크: ${data.stockName || data.ticker} 시세 확인`}
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4 mr-2" />
                시세 확인하기
              </a>
            )}
          </div>
        </div>
        <div className="relative z-10 mt-6 pt-6 border-t border-gray-700">
          <h3 className="text-md font-semibold text-gray-300 mb-2">AI 분석 근거:</h3>
          <p className="text-gray-300 text-sm sm:text-base leading-relaxed whitespace-pre-line">{reasonSummary}</p>
          {showMoreButton && (
            <button
              onClick={() => setIsReasonModalOpen(true)}
              className="mt-3 flex items-center text-sm text-blue-400 hover:text-blue-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 rounded"
              aria-expanded={isReasonModalOpen}
              aria-controls="reason-details-modal"
            >
              더보기 <ChevronDownIcon className="ml-1 w-4 h-4" />
            </button>
          )}
        </div>

        {data.retrievedSources && data.retrievedSources.length > 0 && (
          <div className="relative z-10 mt-6 pt-6 border-t border-gray-700">
            <h3 className="text-md font-semibold text-gray-300 mb-3">AI가 참고한 자료 (Google 검색 기반):</h3>
            <ul className="space-y-2">
              {data.retrievedSources.map((source, index) => (
                <li key={index} className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <a
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 hover:underline text-sm transition-colors break-all"
                    aria-label={`외부 링크: ${source.title || '출처 상세 보기'}`}
                  >
                    {source.title || source.uri}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Modal
        isOpen={isReasonModalOpen}
        onClose={() => setIsReasonModalOpen(false)}
        title="AI 분석 상세 근거"
      >
        <div id="reason-details-modal" className="whitespace-pre-line text-gray-300 text-sm sm:text-base leading-relaxed">
          {data.reason}
        </div>
      </Modal>
    </>
  );
};

export default RecommendationCard;