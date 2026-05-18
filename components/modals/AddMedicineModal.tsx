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
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const categoryNameInput = formData.get('categoryName') as string;
    const existingCategoryId = formData.get('existingCategory') as string;
    
    const finalCategoryName = categoryNameInput || existingCategories.find(c => c.id === existingCategoryId)?.name || '';

    try {
      await addMedicineAndCategory({
        medicineName: formData.get('medicineName') as string,
        genericFormula: formData.get('genericFormula') as string,
        categoryName: finalCategoryName,
        minStockLevel: Number(formData.get('minStockLevel')),
        rackLocation: formData.get('rackLocation') as string,
      });
      onClose();
    } catch (error) {
      console.error(error);
      alert('Failed to add medicine.');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">Add New Medicine</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Medicine Name *</label>
            <input required name="medicineName" type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Panadol Advance" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Generic Formula *</label>
            <input required name="genericFormula" type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Paracetamol 500mg" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Category</label>
              <select name="existingCategory" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                <option value="">-- Or enter new --</option>
                {existingCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Category</label>
              <input name="categoryName" type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="e.g. Painkillers" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock Level *</label>
              <input required name="minStockLevel" type="number" min="0" defaultValue="10" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rack Location</label>
              <input name="rackLocation" type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. A1-Shelf 3" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Barcode (Optional)</label>
            <input defaultValue={initialBarcode} name="barcode" type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Scan or type barcode" />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Medicine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
