'use client';

import React, { useState, useMemo } from 'react';
import { Search, Plus, ChevronDown, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { getMedicineBatches } from '@/app/actions';

type BatchItem = {
  id: string;
  batchNumber: string;
  expiryDate: Date;
  quantity: number;
  purchasePrice: number;
  retailPrice: number;
};

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
  batches?: BatchItem[];
};

const ITEMS_PER_PAGE = 50;

export default function InventoryTable({ 
  items,
  onAddBatch 
}: { 
  items: InventoryItem[],
  onAddBatch: (medicineId: string) => void
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMedIds, setExpandedMedIds] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [loadedBatches, setLoadedBatches] = useState<Record<string, BatchItem[]>>({});
  const [loadingBatches, setLoadingBatches] = useState<Record<string, boolean>>({});

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const currentTime = mounted ? Date.now() : null;

  const filteredItems = useMemo(() => 
    items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.genericFormula.toLowerCase().includes(searchTerm.toLowerCase())
    ), [items, searchTerm]
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const toggleRow = async (medId: string) => {
    const isCurrentlyExpanded = !!expandedMedIds[medId];
    setExpandedMedIds(prev => ({ ...prev, [medId]: !prev[medId] }));

    // Fetch batches on first expand
    if (!isCurrentlyExpanded && !loadedBatches[medId]) {
      setLoadingBatches(prev => ({ ...prev, [medId]: true }));
      try {
        const batches = await getMedicineBatches(medId);
        setLoadedBatches(prev => ({ ...prev, [medId]: batches }));
      } catch (e) {
        console.error('Failed to load batches:', e);
      }
      setLoadingBatches(prev => ({ ...prev, [medId]: false }));
    }
  };

  // Helper to highlight searched term in text
  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return text;
    const regex = new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) 
            ? <mark key={i} className="bg-yellow-200 text-slate-900 rounded px-0.5 font-semibold">{part}</mark>
            : part
        )}
      </>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-150 flex items-center justify-between bg-slate-50/50">
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg tracking-tight">Inventory Catalog</h3>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            {filteredItems.length.toLocaleString()} medicines{searchTerm ? ' matching' : ' total'} • Page {safeCurrentPage} of {totalPages}
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by brand or generic formula..."
            className="pl-10 pr-4 py-2 border border-slate-200 hover:border-slate-350 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 w-72 transition-all bg-white text-slate-800 caret-slate-800"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-600 border-collapse">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-150">
            <tr>
              <th className="px-6 py-3.5 font-bold">Medicine Info</th>
              <th className="px-6 py-3.5 font-bold">Category</th>
              <th className="px-6 py-3.5 font-bold">Stock Health Status (Min)</th>
              <th className="px-6 py-3.5 font-bold">Nearest Expiry</th>
              <th className="px-6 py-3.5 font-bold">Pricing Breakdown (Avg)</th>
              <th className="px-6 py-3.5 font-bold">Margin</th>
              <th className="px-6 py-3.5 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedItems.map(item => {
              const isExpanded = !!expandedMedIds[item.id];
              const totalUnits = item.totalStockUnits || 0;
              const thresholdUnits = (item.minStockLevel || 0) * (item.stripsPerBox || 1);
              
              // Determine stock status category
              const isOutOfStock = totalUnits === 0;
              const isLowStock = totalUnits > 0 && totalUnits <= Math.max(3, thresholdUnits);
              
              return (
                <React.Fragment key={item.id}>
                  {/* Main Medicine Row */}
                  <tr 
                    onClick={() => toggleRow(item.id)}
                    className={`cursor-pointer select-none transition-colors border-b border-slate-100 hover:bg-slate-50/40 ${
                      isExpanded ? 'bg-slate-50/20' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div>
                          <div className="font-bold text-slate-900 text-base">{highlightText(item.name, searchTerm)}</div>
                          <div className="text-xs text-slate-500 font-medium">{highlightText(item.genericFormula, searchTerm)}</div>
                          {item.rackLocation && (
                            <div className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200/50 inline-block px-2 py-0.5 rounded-full mt-1.5 font-bold uppercase tracking-wider">
                              Rack: {item.rackLocation}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">{item.categoryName}</td>
                    <td className="px-6 py-4">
                      {/* Pulse color-coded status badge */}
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black w-fit border ${
                          isOutOfStock
                            ? 'bg-rose-50 text-rose-700 border-rose-100'
                            : isLowStock
                              ? 'bg-amber-50 text-amber-700 border-amber-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            isOutOfStock
                              ? 'bg-rose-500'
                              : isLowStock
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          }`}></span>
                          {item.displayStock 
                            ? `${item.displayStock.boxes} box(es)${item.displayStock.strips > 0 ? ' + ' + item.displayStock.strips + ' strip(s)' : ''}` 
                            : `${totalUnits} units`
                          }
                        </span>
                        <div className="text-xs text-slate-400 font-medium">Min Level: {item.minStockLevel} box(es)</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {item.nearestExpiry ? (
                        <span className={`px-2 py-0.5 rounded font-bold text-xs uppercase ${
                          new Date(item.nearestExpiry).getTime() < (currentTime || 0)
                            ? 'bg-red-50 text-red-700 border border-red-150'
                            : new Date(item.nearestExpiry).getTime() - (currentTime || 0) < 90 * 24 * 60 * 60 * 1000
                              ? 'bg-orange-50 text-orange-700 border border-orange-150'
                              : 'text-slate-700'
                        }`}>
                          {format(item.nearestExpiry, 'MMM dd, yyyy')}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium space-y-1 text-slate-500">
                      <div><span className="font-bold text-slate-700">Buy:</span> Rs. {(item.boxPurchasePrice ?? item.purchasePrice).toFixed(2)} / box • Rs. {item.purchasePrice.toFixed(2)} / strip</div>
                      <div><span className="font-bold text-slate-700">Sell:</span> Rs. {(item.boxRetailPrice ?? item.retailPrice).toFixed(2)} / box • Rs. {item.retailPrice.toFixed(2)} / strip</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black ${
                        item.profitMargin > 30 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                        item.profitMargin > 0 ? 'bg-blue-50 text-blue-700 border border-blue-100' : 
                        'bg-slate-50 text-slate-600 border border-slate-100'
                      }`}>
                        {item.profitMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onAddBatch(item.id)}
                        className="inline-flex items-center justify-center p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all shadow-sm active:scale-95 transform hover:-translate-y-0.5 border border-blue-100"
                        title="Stock In (Add Batch)"
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        <span className="text-xs font-black uppercase">Stock In</span>
                      </button>
                    </td>
                  </tr>

                  {/* Collapsible Active Batches Row */}
                  {isExpanded && (() => {
                    const batchList = loadedBatches[item.id] || [];
                    const isLoading = !!loadingBatches[item.id];
                    return (
                    <tr className="bg-slate-50/20 border-b border-slate-200">
                      <td colSpan={7} className="px-8 py-4">
                        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-inner space-y-3.5">
                          <div className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                            <span>Active Registered Batches ({batchList.length})</span>
                            <span className="text-slate-500 font-semibold lowercase">Each box contains {item.stripsPerBox} strips</span>
                          </div>
                          
                          {isLoading ? (
                            <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span className="text-sm font-bold">Loading batches...</span>
                            </div>
                          ) : batchList.length > 0 ? (
                            <div className="overflow-x-auto rounded-xl border border-slate-100">
                              <table className="w-full text-xs text-left text-slate-500 border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-400 uppercase tracking-wider text-[10px]">
                                    <th className="py-2.5 px-4 font-bold">Batch ID / Code</th>
                                    <th className="py-2.5 px-4 font-bold">Expiry Date</th>
                                    <th className="py-2.5 px-4 font-bold text-center">Remaining Quantity</th>
                                    <th className="py-2.5 px-4 font-bold text-right">Purchase Price (Box)</th>
                                    <th className="py-2.5 px-4 font-bold text-right">Retail Price (Box)</th>
                                    <th className="py-2.5 px-4 font-bold text-right text-teal-600">Expected Profit (Box)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {batchList.map((batch) => {
                                    const isBatchExpired = new Date(batch.expiryDate).getTime() < (currentTime || 0);
                                    const isBatchNearExpiry = new Date(batch.expiryDate).getTime() - (currentTime || 0) < 90 * 24 * 60 * 60 * 1000;
                                    
                                    const batchBoxes = Math.floor(batch.quantity / (item.stripsPerBox || 1));
                                    const batchStrips = batch.quantity % (item.stripsPerBox || 1);
                                    const batchProfit = batch.retailPrice - batch.purchasePrice;
                                    
                                    return (
                                      <tr key={batch.id} className="hover:bg-slate-50/30 transition-colors">
                                        <td className="py-3 px-4 font-black text-slate-800 uppercase tracking-wider">{batch.batchNumber}</td>
                                        <td className="py-3 px-4 font-bold">
                                          <span className={`px-2 py-0.5 rounded text-[10px] border uppercase ${
                                            isBatchExpired 
                                              ? 'bg-rose-50 text-rose-700 border-rose-100' 
                                              : isBatchNearExpiry 
                                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                : 'bg-slate-50 text-slate-600 border-slate-150'
                                          }`}>
                                            {format(new Date(batch.expiryDate), 'MMM dd, yyyy')}
                                            {isBatchExpired ? ' (Expired)' : isBatchNearExpiry ? ' (Near Expiry)' : ''}
                                          </span>
                                        </td>
                                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                                          {batchBoxes} box(es){batchStrips > 0 ? ` + ${batchStrips} strip(s)` : ''}
                                          <span className="text-[10px] text-slate-400 font-medium block">Total: {batch.quantity} strips</span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium text-slate-600">Rs. {batch.purchasePrice.toFixed(2)}</td>
                                        <td className="py-3 px-4 text-right font-bold text-slate-800">Rs. {batch.retailPrice.toFixed(2)}</td>
                                        <td className="py-3 px-4 text-right font-black text-teal-600">Rs. {batchProfit.toFixed(2)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center text-slate-400 py-6 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                              No batches currently registered. Click the blue &quot;Stock In&quot; button on the right to add a batch!
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })()}
                </React.Fragment>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <Search className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-bold text-base">No medicines found matching your search query.</p>
                  <p className="text-xs text-slate-400 mt-1">Try refining the terms or checking category filters.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50/30">
          <p className="text-xs font-bold text-slate-500">
            Showing {startIdx + 1}–{Math.min(startIdx + ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length.toLocaleString()}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="First page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page number buttons */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (safeCurrentPage <= 3) {
                page = i + 1;
              } else if (safeCurrentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = safeCurrentPage - 2 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                    page === safeCurrentPage
                      ? 'bg-teal-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Last page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
