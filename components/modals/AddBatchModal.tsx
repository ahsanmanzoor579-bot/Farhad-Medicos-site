'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { addBatch } from '@/app/actions';
import { useRouter } from 'next/navigation';

export default function AddBatchModal({
  isOpen,
  onClose,
  medicineId,
  medicineName,
  stripsPerBox = 1
}: {
  isOpen: boolean;
  onClose: () => void;
  medicineId: string;
  medicineName: string;
  stripsPerBox?: number;
}) {
  const stripsPerBoxProp = stripsPerBox || 1;
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    
    try {
      const unit = ((formData.get('unit') as string) || 'BOX') as 'BOX' | 'STRIP';
      const rawQuantity = Number(formData.get('quantity'));
      const rawPurchase = Number(formData.get('purchasePrice'));
      const rawRetail = Number(formData.get('retailPrice'));

      await addBatch({
        medicineId,
        batchNumber: formData.get('batchNumber') as string,
        expiryDate: formData.get('expiryDate') as string,
        purchasePrice: rawPurchase,
        retailPrice: rawRetail,
        quantity: rawQuantity,
        unit,
      });
      router.refresh();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Failed to add batch.');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">Stock In / New Batch</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
          <p className="text-sm text-slate-500">Adding stock for:</p>
          <p className="font-semibold text-slate-800">{medicineName}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input type="hidden" name="stripsPerBox" value={String(stripsPerBoxProp)} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Batch Number *</label>
              <input required name="batchNumber" type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. B-10293" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date *</label>
              <input required name="expiryDate" type="date" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Price (Box) *</label>
              <input required name="purchasePrice" type="number" step="0.01" min="0" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Retail Price (Box) *</label>
              <input required name="retailPrice" type="number" step="0.01" min="0" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
              <input required name="quantity" type="number" min="1" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
              <select name="unit" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                <option value="BOX">Box</option>
                <option value="STRIP">Strip</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500">Enter the box price here. The system will divide by strips per box and store the per-strip price automatically.</div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
