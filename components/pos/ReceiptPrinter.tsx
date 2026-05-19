'use client';

import { forwardRef } from 'react';
import { format } from 'date-fns';

type ReceiptProps = {
  cart: any[];
  total: number;
  tendered?: number;
  change?: number;
  cashier?: string;
  receiptId?: string;
  discount?: number;
  items?: number;
};

const ReceiptPrinter = forwardRef<HTMLDivElement, ReceiptProps>(({ cart, total, tendered, change, cashier, receiptId, discount, items }, ref) => {
  return (
    <div className="hidden print:block text-black bg-white" ref={ref} style={{ fontFamily: "'Courier New', Courier, monospace" }}>
      <style type="text/css" media="print">
        {`
          @page { size: 80mm 297mm; margin: 0; }
          body { margin: 0; padding: 15px; }
          .receipt-divider { border-bottom: 2px dashed #000; margin: 12px 0; }
        `}
      </style>
      
      <div className="text-center mb-6">
        <h2 className="text-2xl mb-1 font-bold tracking-wide uppercase">Farhad Medicos</h2>
        <p className="text-[13px] mb-2 font-medium">CASH RECEIPT</p>
        <p className="text-[14px] leading-snug">Thana Road, Opp. Category C Hospital Wari</p>
        <p className="text-[14px] leading-snug font-medium mt-1">Tel: 0312-0999536</p>
      </div>

      <div className="receipt-divider" />

      <div className="flex justify-between items-center text-[15px] font-semibold">
        <span>Date: {format(new Date(), 'dd-MM-yyyy')}</span>
        <span>{format(new Date(), 'HH:mm')}</span>
      </div>

      <div className="receipt-divider" />

      <div className="w-full text-[15px] mb-3">
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold">Items:</span>
          <span className="font-bold text-lg">{items || cart.length}</span>
        </div>
      </div>

      <div className="w-full text-[15px]">
        {cart.map((item, index) => {
          const name = item.name || item.medicineName;
          const unitPrice = item.unitPrice || item.batchPrice || item.price || 0;
          const displayQty = item.unit === 'BOX' ? `${item.quantity} box(es)` : `${item.quantity} strip(s)`;
          const displayPrice = unitPrice * item.quantity;
          return (
            <div key={index} className="flex justify-between items-start mb-1.5">
              <span className="max-w-[50mm] break-words pr-2">
                {name} {item.quantity > 1 ? `(${displayQty})` : ''}
              </span>
              <span className="text-right">
                <div>{unitPrice.toFixed(2)} / {item.unit === 'BOX' ? 'box' : 'strip'}</div>
                <div>{displayPrice.toFixed(2)}</div>
              </span>
            </div>
          );
        })}
      </div>

      <div className="receipt-divider" />

      <div className="w-full">
        <div className="flex justify-between items-center mb-3">
          <span className="text-2xl">Total</span>
          <span className="text-2xl font-bold">{total.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between items-center text-[15px] mb-1.5">
          <span>Sub-total</span>
          <span>{(total + (discount || 0)).toFixed(2)}</span>
        </div>

        {discount !== undefined && discount > 0 && (
          <div className="flex justify-between items-center text-[15px] mb-1.5">
            <span>Discount</span>
            <span>-{discount.toFixed(2)}</span>
          </div>
        )}

        {tendered !== undefined && tendered > 0 ? (
          <>
            <div className="flex justify-between items-center text-[15px] mb-1.5">
              <span>Tendered</span>
              <span>{tendered.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-[15px]">
              <span>Change</span>
              <span>{(change || 0).toFixed(2)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between items-center text-[15px]">
            <span>Balance</span>
            <span>0.00</span>
          </div>
        )}
      </div>

      <div className="mt-10 text-center">
        <h3 className="text-2xl mb-6 font-medium tracking-wide">THANK YOU</h3>
        
        {/* Fake Barcode */}
        <div className="flex justify-center w-full h-14 items-end mb-2">
          {Array.from({ length: 40 }).map((_, i) => {
            // Generate deterministic varying widths and margins for a realistic barcode look
            const width = [1, 2, 1.5, 3][i % 4];
            const margin = [1, 2, 1, 3][(i * 3) % 4];
            return (
              <div 
                key={i} 
                className="bg-black h-full" 
                style={{ width: `${width}px`, marginRight: `${margin}px` }} 
              />
            );
          })}
        </div>
        {receiptId && <p className="text-[12px] tracking-widest">{receiptId}</p>}
      </div>
    </div>
  );
});

ReceiptPrinter.displayName = 'ReceiptPrinter';
export default ReceiptPrinter;
