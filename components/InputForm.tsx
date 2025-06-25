
import React from 'react';
import { MagnifyingGlassIcon } from '../constants';

interface InputFormProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

const InputForm: React.FC<InputFormProps> = ({ query, onQueryChange, onSubmit, isLoading }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto p-4 sm:p-6 bg-gray-800 rounded-xl shadow-2xl">
      <label htmlFor="stock-query" className="block text-sm font-medium text-gray-300 mb-2">
        주식/ETF 티커 또는 종목명
      </label>
      <div className="flex items-center space-x-3">
        <input
          id="stock-query"
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="예: 삼성전자 또는 AAPL"
          className="flex-grow p-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors disabled:opacity-50"
          disabled={isLoading}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="flex items-center justify-center px-5 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 transition-all duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <MagnifyingGlassIcon className="w-5 h-5" />
          )}
          <span className="ml-2">분석</span>
        </button>
      </div>
    </form>
  );
};

export default InputForm;
