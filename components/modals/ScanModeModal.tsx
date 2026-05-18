'use client';

import { useState, useEffect } from 'react';
import { ScanBarcode, X } from 'lucide-react';

export default function ScanModeModal({
  isOpen,
  onClose,
  onScan
}: {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}) {
  const [barcodeBuffer, setBarcodeBuffer] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setBarcodeBuffer('');
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore input if user is typing in a text field (unlikely in this modal, but safe)
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 3) {
          onScan(barcodeBuffer);
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
  }, [isOpen, barcodeBuffer, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 print:hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl p-10 max-w-sm w-full text-center relative overflow-hidden transform transition-all scale-100 animate-in zoom-in-95">
        <button 
          onClick={onClose} 
          className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-24 h-24 mx-auto bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner relative">
          <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
          <ScanBarcode className="w-12 h-12 relative z-10" />
        </div>

        <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Ready to Scan</h3>
        <p className="text-slate-500 font-medium leading-relaxed">
          Please point your barcode scanner at the product to automatically add it to your inventory.
        </p>

        {barcodeBuffer && (
          <div className="mt-6 p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 font-mono text-sm">
            Scanning... {barcodeBuffer}
          </div>
        )}
      </div>
    </div>
  );
}
