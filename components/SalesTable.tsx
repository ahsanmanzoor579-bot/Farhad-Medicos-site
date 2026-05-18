'use client';

import { Activity } from 'lucide-react';

export default function SalesTable({ items }: { items: any[] }) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Activity className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1">No Sales Today</h3>
        <p className="text-slate-500">There are currently no sales recorded for today.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm uppercase tracking-wider">
              <th className="p-4 font-bold">Time</th>
              <th className="p-4 font-bold">Medicine</th>
              <th className="p-4 font-bold text-center">Batch</th>
              <th className="p-4 font-bold text-center">Qty</th>
              <th className="p-4 font-bold text-right">Unit Price</th>
              <th className="p-4 font-bold text-center">Unit</th>
              <th className="p-4 font-bold text-right text-emerald-600">Revenue</th>
              <th className="p-4 font-bold text-right text-blue-600">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 text-slate-500 text-sm whitespace-nowrap">
                  {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="p-4">
                  <div className="font-bold text-slate-800">{item.medicineName}</div>
                  <div className="text-xs text-slate-500">{item.genericFormula}</div>
                </td>
                <td className="p-4 text-center">
                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold uppercase">
                    {item.batchNumber}
                  </span>
                </td>
                <td className="p-4 text-center font-bold text-slate-700">{item.displayQuantity || item.quantity}</td>
                <td className="p-4 text-right text-slate-600">Rs. {(item.unitPrice || item.salePrice).toFixed(2)}</td>
                <td className="p-4 text-center text-slate-600 font-medium">{item.unit || '-'}</td>
                <td className="p-4 text-right font-bold text-emerald-600">
                  Rs. {item.revenue.toFixed(2)}
                </td>
                <td className="p-4 text-right font-bold text-blue-600">
                  Rs. {item.profit.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
