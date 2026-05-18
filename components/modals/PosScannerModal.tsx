'use client';

import { useState, useEffect } from 'react';
import { ScanBarcode, X, PlusCircle, MinusCircle } from 'lucide-react';

export default function PosScannerModal({
  isOpen,
  onClose,
  onScan
}: {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string, mode: 'add' | 'remove') => void;
}) {
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [scanMode, setScanMode] = useState<'add' | 'remove'>('add');
  const [lastScanned, setLastScanned] = useState<{barcode: string, mode: string} | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setBarcodeBuffer('');
      setLastScanned(null);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      // Quick toggle shortcuts
      if (e.key === '+') {
        setScanMode('add');
        return;
      }
      if (e.key === '-') {
        setScanMode('remove');
        return;
      }

      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 3) {
          onScan(barcodeBuffer, scanMode);
          setLastScanned({ barcode: barcodeBuffer, mode: scanMode });
          
          // Clear last scanned message after 2 seconds
          setTimeout(() => setLastScanned(null), 2000);
        }
        setBarcodeBuffer('');
      } else if (e.key.length === 1) { // Normal character
        setBarcodeBuffer(prev => prev + e.key);
      }
    };

    let timeout: NodeJS.Timeout;
    if (barcodeBuffer.length > 0) {
      timeout = setTimeout(() => {
        setBarcodeBuffer('');
      }, 100); // 100ms timeout for scanner
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeout);
    };
  }, [isOpen, barcodeBuffer, scanMode, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 print:hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full text-center relative overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 border-4 border-white/20">
        <button 
          onClick={onClose} 
          className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex justify-center mb-6">
          <div className={`w-28 h-28 rounded-full flex items-center justify-center shadow-inner relative transition-colors duration-500 ${scanMode === 'add' ? 'bg-teal-100 text-teal-600' : 'bg-red-100 text-red-600'}`}>
            <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${scanMode === 'add' ? 'bg-teal-400' : 'bg-red-400'}`}></div>
            <ScanBarcode className="w-14 h-14 relative z-10" />
          </div>
        </div>

        <h3 className="text-3xl font-black text-slate-800 tracking-tight mb-2">POS Scanner</h3>
        <p className="text-slate-500 font-medium mb-8">
          Point scanner at product to {scanMode === 'add' ? 'add to' : 'remove from'} receipt.
        </p>

        {/* Mode Toggle */}
        <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-6 relative z-10">
          <button
            onClick={() => setScanMode('add')}
            className={`flex-1 flex items-center justify-center py-3 px-4 rounded-xl font-bold text-sm transition-all ${scanMode === 'add' ? 'bg-white text-teal-600 shadow-md transform scale-105' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <PlusCircle className="w-5 h-5 mr-2" /> Add ( + )
          </button>
          <button
            onClick={() => setScanMode('remove')}
            className={`flex-1 flex items-center justify-center py-3 px-4 rounded-xl font-bold text-sm transition-all ${scanMode === 'remove' ? 'bg-white text-red-600 shadow-md transform scale-105' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <MinusCircle className="w-5 h-5 mr-2" /> Remove ( - )
          </button>
        </div>

        {lastScanned && (
          <div className={`p-4 rounded-xl font-bold text-sm animate-in slide-in-from-bottom-2 ${lastScanned.mode === 'add' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {lastScanned.mode === 'add' ? 'Added' : 'Removed'} product!
          </div>
        )}

        {barcodeBuffer && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-slate-800 text-slate-300 font-mono text-xs rounded-full opacity-50">
            {barcodeBuffer}
          </div>
        )}
      </div>
    </div>
  );
}
