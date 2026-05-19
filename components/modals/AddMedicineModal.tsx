'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { addMedicineAndCategory } from '@/app/actions';

export default function AddMedicineModal({
  isOpen,
  onClose,
  existingCategories,
  initialBarcode
}: {
  isOpen: boolean;
  onClose: () => void;
  existingCategories: { id: string; name: string }[];
  initialBarcode?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const categoryNameInput = formData.get('categoryName') as string;
    const existingCategoryId = formData.get('existingCategory') as string;
    const finalCategoryName = categoryNameInput || existingCategories.find(c => c.id === existingCategoryId)?.name || '';

    // Client-side validation for stripsPerBox: required, positive integer
    const stripsRaw = formData.get('stripsPerBox');
    const stripsNum = stripsRaw === null ? NaN : Number(String(stripsRaw).trim());
    if (!Number.isFinite(stripsNum) || !Number.isInteger(stripsNum) || stripsNum < 1) {
      alert('Please enter a valid whole number (>= 1) for "Strips Per Box".');
      return;
    }

    // Optional Initial Batch Stock In fields validation
    const batchNumber = formData.get('batchNumber') as string;
    const expiryDate = formData.get('expiryDate') as string;
    const purchasePriceRaw = formData.get('purchasePrice');
    const retailPriceRaw = formData.get('retailPrice');
    const quantityRaw = formData.get('quantity');
    const unit = (formData.get('unit') as string) || 'BOX';

    const hasBatchInfo = batchNumber || expiryDate || purchasePriceRaw || retailPriceRaw || quantityRaw;

    let initialBatch = undefined;
    if (hasBatchInfo) {
      if (!batchNumber || !expiryDate || !purchasePriceRaw || !retailPriceRaw || !quantityRaw) {
        alert('Please fill out all batch fields (Batch Number, Expiry Date, Purchase Price, Retail Price, and Quantity) if you want to add stock!');
        return;
      }
      initialBatch = {
        batchNumber,
        expiryDate,
        purchasePrice: Number(purchasePriceRaw),
        retailPrice: Number(retailPriceRaw),
        quantity: Number(quantityRaw),
        unit: unit as 'BOX' | 'STRIP'
      };
    }

    setLoading(true);
    try {
      const res = await addMedicineAndCategory({
        medicineName: formData.get('medicineName') as string,
        genericFormula: formData.get('genericFormula') as string,
        categoryName: finalCategoryName,
        minStockLevel: Number(formData.get('minStockLevel')),
        rackLocation: formData.get('rackLocation') as string,
        stripsPerBox: stripsNum,
        defaultSellingUnit: ((formData.get('defaultSellingUnit') as string) || 'BOX') as 'BOX' | 'STRIP',
        barcode: (formData.get('barcode') as string) || undefined,
        initialBatch
      });

      if (res && !res.success) {
        alert(res.error);
        return;
      }
      onClose();
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Failed to add medicine.');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[85vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Add New Medicine</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Medicine Name *</label>
              <input required name="medicineName" type="text" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="e.g. Panadol Advance" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Generic Formula *</label>
              <input required name="genericFormula" type="text" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="e.g. Paracetamol 500mg" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Category</label>
                <select name="existingCategory" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="">-- Or enter new --</option>
                  {existingCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Category</label>
                <input name="categoryName" type="text" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="e.g. Painkillers" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock Level *</label>
                <input required name="minStockLevel" type="number" min="0" defaultValue="10" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rack Location</label>
                <input name="rackLocation" type="text" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="e.g. A1-Shelf 3" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Strips Per Box</label>
                <input name="stripsPerBox" type="number" min="1" step="1" inputMode="numeric" required defaultValue="10" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm pointer-events-auto" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Selling Unit</label>
                <select name="defaultSellingUnit" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="BOX">Box</option>
                  <option value="STRIP">Strip</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Barcode (Optional)</label>
              <input defaultValue={initialBarcode} name="barcode" type="text" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Scan or type barcode" />
            </div>

            {/* Stock In / Initial Batch (Optional) */}
            <div className="border-t border-slate-200 pt-3 mt-3">
              <h3 className="text-xs font-bold text-slate-800 tracking-wide uppercase mb-3">Stock In / New Batch (Optional)</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Batch Number</label>
                  <input name="batchNumber" type="text" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs" placeholder="e.g. B-10293" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date</label>
                  <input name="expiryDate" type="date" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Purchase Price (Box)</label>
                  <input name="purchasePrice" type="number" step="0.01" min="0" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs" placeholder="Rs. 0.00" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Retail Price (Box)</label>
                  <input name="retailPrice" type="number" step="0.01" min="0" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs" placeholder="Rs. 0.00" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity</label>
                  <input name="quantity" type="number" min="1" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs" placeholder="e.g. 10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Unit</label>
                  <select name="unit" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs">
                    <option value="BOX">Box</option>
                    <option value="STRIP">Strip</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 flex justify-end gap-3 border-t border-slate-100 bg-white sticky bottom-0 z-40">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors pointer-events-auto">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 pointer-events-auto">
              {loading ? 'Saving...' : 'Save Medicine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
