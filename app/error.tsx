'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Next.js Caught Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-lg w-full text-center border border-slate-100">
        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Something went wrong!</h2>
        <p className="text-slate-500 font-medium mb-8 leading-relaxed">
          {error.message || 'An unexpected error occurred while loading this page. Please try again or contact support.'}
        </p>
        <button
          onClick={() => reset()}
          className="flex items-center justify-center w-full py-4 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white rounded-2xl font-bold text-lg shadow-lg shadow-slate-900/20 transform transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          <RefreshCcw className="w-5 h-5 mr-2" />
          Try Again
        </button>
      </div>
    </div>
  );
}
