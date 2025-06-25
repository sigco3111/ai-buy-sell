
import React from 'react';

interface ErrorMessageProps {
  message: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="w-full max-w-xl mx-auto mt-8 p-4 bg-red-800/80 backdrop-blur-sm border border-red-600 text-red-100 rounded-lg shadow-lg" role="alert">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 102 0V5zm-1 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-semibold text-red-200">오류 발생</h3>
          <div className="mt-1 text-sm text-red-100">
            <p>{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorMessage;
