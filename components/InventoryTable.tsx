'use client';

import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { format } from 'date-fns';

type InventoryItem = {
  id: string;
  name: string;
  genericFormula: string;
  categoryName: string;
  minStockLevel: number;
  rackLocation: string | null;
  totalStockUnits?: number;
  displayStock?: { boxes: number; strips: number };
  stripsPerBox?: number;
  nearestExpiry: Date | null;
  purchasePrice: number;
  retailPrice: number;
  boxPurchasePrice?: number;
  boxRetailPrice?: number;
  profitMargin: number;
};

export default function InventoryTable({ 
  items,
  onAddBatch 
}: { 
  items: InventoryItem[],
  onAddBatch: (medicineId: string) => void
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.genericFormula.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <h3 className="font-semibold text-slate-800">Inventory</h3>
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or formula..."
            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3">Medicine Info</th>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3">Stock (Min)</th>
              <th className="px-6 py-3">Nearest Expiry</th>
              <th className="px-6 py-3">Pricing (Avg)</th>
              <th className="px-6 py-3">Margin</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => (
              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{item.name}</div>
                  <div className="text-xs text-slate-500">{item.genericFormula}</div>
                  {item.rackLocation && (
                    <div className="text-xs bg-slate-100 inline-block px-1.5 py-0.5 rounded mt-1">
                      Rack: {item.rackLocation}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">{item.categoryName}</td>
                <td className="px-6 py-4">
                  <div className={`font-medium ${((item.displayStock?.boxes || 0) === 0 && (item.displayStock?.strips || 0) < 3) ? 'text-red-600' : 'text-slate-900'}`}>
                    {item.displayStock ? `${item.displayStock.boxes} boxes${item.displayStock.strips > 0 ? ' + ' + item.displayStock.strips + ' strips' : ''}` : item.totalStockUnits}
                  </div>
                  <div className="text-xs text-slate-400">Min: {item.minStockLevel}</div>
                </td>
                <td className="px-6 py-4">
                  {item.nearestExpiry ? format(item.nearestExpiry, 'MMM dd, yyyy') : '-'}
                </td>
                <td className="px-6 py-4">
                  <div>Buy: Rs. {(item.boxPurchasePrice ?? item.purchasePrice).toFixed(2)} / box</div>
                  <div>Buy: Rs. {item.purchasePrice.toFixed(2)} / strip</div>
                  <div>Sell: Rs. {(item.boxRetailPrice ?? item.retailPrice).toFixed(2)} / box</div>
                  <div>Sell: Rs. {item.retailPrice.toFixed(2)} / strip</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    item.profitMargin > 30 ? 'bg-green-100 text-green-700' : 
                    item.profitMargin > 0 ? 'bg-blue-100 text-blue-700' : 
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {item.profitMargin.toFixed(1)}%
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => onAddBatch(item.id)}
                    className="inline-flex items-center justify-center p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    title="Stock In (Add Batch)"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                  No medicines found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
