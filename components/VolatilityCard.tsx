import React from 'react';
import { VolatilityInfo, RecommendationAction } from '../types';
import { GlobeAltIcon, MapPinIcon } from '../constants';

interface VolatilityCardProps {
  data: VolatilityInfo;
  recommendation: RecommendationAction;
}

const VolatilityCard: React.FC<VolatilityCardProps> = ({ data, recommendation }) => {
  const isVIXRaw = data.name.toUpperCase().includes("VIX");
  const cardTitleBase = isVIXRaw ? "국제 시장 변동성" : "국내 시장 변동성";
  const MainIconComponent = isVIXRaw ? GlobeAltIcon : MapPinIcon;
  
  const isHighVolatility = data.status.includes("높음") || data.status.includes("극심");

  const contentBoxStyles = isHighVolatility
    ? {
        bgColor: 'bg-red-900 bg-opacity-40',
        borderColor: 'border-red-700',
        iconColor: 'text-red-400',
        headerTextColor: 'text-red-200',
        descriptionTextColor: 'text-red-200',
        timestampColor: 'text-red-400',
      }
    : {
        bgColor: 'bg-gray-700',
        borderColor: 'border-gray-600',
        iconColor: 'text-gray-400',
        headerTextColor: 'text-gray-200',
        descriptionTextColor: 'text-gray-300',
        timestampColor: 'text-gray-500',
      };

  let displayName = data.name;
  if (data.name.toUpperCase().includes("VIX")) {
    displayName = "VIX";
  } else if (data.name.toUpperCase().includes("VKOSPI")) {
    displayName = "VKOSPI";
  }

  const headerLine1 = `${cardTitleBase} (${displayName} 기준)`;
  const headerLine2 = `- ${data.status} (${displayName}: ${data.value})`;

  return (
    <div className={`w-full max-w-xl mx-auto mt-6 p-5 sm:p-6 bg-gray-800 rounded-xl shadow-2xl overflow-hidden border-t-2 ${isVIXRaw ? 'border-blue-500' : 'border-green-500'}`}>
      <div className="relative z-10">
        <div className={`p-4 rounded-lg ${contentBoxStyles.bgColor} border ${contentBoxStyles.borderColor}`}>
          <div className="flex items-start mb-3"> {/* Changed to items-start for multi-line text alignment */}
            <MainIconComponent className={`w-6 h-6 mr-3 mt-1 flex-shrink-0 ${contentBoxStyles.iconColor}`} /> {/* Added mt-1 for better alignment with first line of text */}
            <h2 className={`text-lg sm:text-xl font-semibold ${contentBoxStyles.headerTextColor}`}>
              <span>{headerLine1}</span>
              <span className="block mt-0.5">{headerLine2}</span> {/* Force second part to new line */}
            </h2>
          </div>
          <p className={`text-sm ${contentBoxStyles.descriptionTextColor} whitespace-pre-line leading-relaxed`}>
            {data.description}
          </p>
          {data.lastKnownStatusTime && (
            <p className={`text-xs ${contentBoxStyles.timestampColor} mt-3`}>
              기준 시각: {data.lastKnownStatusTime}
            </p>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700/50">
          <p className="text-sm text-gray-300">
            AI 주식 의견: <span className={`font-semibold ${recommendation === RecommendationAction.BUY ? 'text-green-400' : 'text-red-400'}`}>{recommendation}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VolatilityCard;