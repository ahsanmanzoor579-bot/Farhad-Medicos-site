'use client';

import { useState, useEffect } from 'react';
import { X, Search, Sparkles, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { addMedicineAndCategory } from '@/app/actions';

const standardTemplates = [
  { name: 'Ponstan 250mg', genericFormula: 'Mefenamic Acid', categoryName: 'Painkillers', stripsPerBox: 10, defaultSellingUnit: 'STRIP' },
  { name: 'Voltral 50mg', genericFormula: 'Diclofenac Sodium', categoryName: 'Painkillers', stripsPerBox: 10, defaultSellingUnit: 'STRIP' },
  { name: 'Caflam 50mg', genericFormula: 'Diclofenac Potassium', categoryName: 'Painkillers', stripsPerBox: 10, defaultSellingUnit: 'STRIP' },
  { name: 'Panadol Advance 500mg', genericFormula: 'Paracetamol', categoryName: 'Painkillers', stripsPerBox: 10, defaultSellingUnit: 'STRIP' },
  { name: 'Augmentin 625mg', genericFormula: 'Amoxicillin + Clavulanate', categoryName: 'Antibiotics', stripsPerBox: 10, defaultSellingUnit: 'STRIP' },
  { name: 'Cravit 500mg', genericFormula: 'Levofloxacin', categoryName: 'Antibiotics', stripsPerBox: 10, defaultSellingUnit: 'STRIP' },
  { name: 'Flagyl 400mg', genericFormula: 'Metronidazole', categoryName: 'Gastrointestinal', stripsPerBox: 10, defaultSellingUnit: 'STRIP' },
  { name: 'Risek 20mg', genericFormula: 'Omeprazole', categoryName: 'Gastrointestinal', stripsPerBox: 10, defaultSellingUnit: 'STRIP' },
  { name: 'Nexum 40mg', genericFormula: 'Esomeprazole', categoryName: 'Gastrointestinal', stripsPerBox: 10, defaultSellingUnit: 'STRIP' },
  { name: 'Arinac Forte', genericFormula: 'Ibuprofen + Pseudoephedrine', categoryName: 'Allergy', stripsPerBox: 10, defaultSellingUnit: 'STRIP' },
  { name: 'Rigix 10mg', genericFormula: 'Cetirizine', categoryName: 'Allergy', stripsPerBox: 10, defaultSellingUnit: 'STRIP' },
  { name: 'Surbex Z', genericFormula: 'Multivitamin', categoryName: 'Vitamins', stripsPerBox: 10, defaultSellingUnit: 'STRIP' },
  { name: 'Glucophage 500mg', genericFormula: 'Metformin HCl', categoryName: 'Diabetes', stripsPerBox: 10, defaultSellingUnit: 'STRIP' },
  { name: 'Concor 5mg', genericFormula: 'Bisoprolol Fumarate', categoryName: 'Cardiology', stripsPerBox: 10, defaultSellingUnit: 'STRIP' },
  { name: 'Loprin 75mg', genericFormula: 'Aspirin', categoryName: 'Cardiology', stripsPerBox: 10, defaultSellingUnit: 'STRIP' }
];

export default function AddMedicineModal({
  isOpen,
  onClose,
  existingCategories,
  initialBarcode,
  existingMedicines = [],
  onSelectExistingMedicine
}: {
  isOpen: boolean;
  onClose: () => void;
  existingCategories: { id: string; name: string }[];
  initialBarcode?: string;
  existingMedicines?: any[];
  onSelectExistingMedicine?: (medId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Controlled fields state for auto-fill and duplication detection
  const [medicineName, setMedicineName] = useState('');
  const [genericFormula, setGenericFormula] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('10');
  const [rackLocation, setRackLocation] = useState('');
  const [stripsPerBox, setStripsPerBox] = useState('10');
  const [defaultSellingUnit, setDefaultSellingUnit] = useState('BOX');
  const [barcode, setBarcode] = useState('');

  // Reset states or prefill barcode
  useEffect(() => {
    if (isOpen) {
      setMedicineName('');
      setGenericFormula('');
      setSelectedCategory('');
      setNewCategoryName('');
      setMinStockLevel('10');
      setRackLocation('');
      setStripsPerBox('10');
      setDefaultSellingUnit('BOX');
      setBarcode(initialBarcode || '');
      setSearchQuery('');
    }
  }, [isOpen, initialBarcode]);

  // Duplicate Check
  const matchedExisting = existingMedicines.find(m => 
    m.name.toLowerCase().trim() === medicineName.toLowerCase().trim() ||
    (barcode && m.barcode === barcode)
  );

  // Search Results filtering (inventory + standard templates)
  const filteredTemplates = searchQuery.trim() === '' ? [] : standardTemplates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.genericFormula.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExisting = searchQuery.trim() === '' ? [] : existingMedicines.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.genericFormula.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleApplyTemplate = (template: typeof standardTemplates[0]) => {
    setMedicineName(template.name);
    setGenericFormula(template.genericFormula);
    
    // Find category ID matching name or create new category
    const cat = existingCategories.find(c => c.name.toLowerCase() === template.categoryName.toLowerCase());
    if (cat) {
      setSelectedCategory(cat.id);
      setNewCategoryName('');
    } else {
      setSelectedCategory('');
      setNewCategoryName(template.categoryName);
    }

    setStripsPerBox(String(template.stripsPerBox));
    setDefaultSellingUnit(template.defaultSellingUnit);
    setSearchQuery('');
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    const finalCategoryName = newCategoryName || existingCategories.find(c => c.id === selectedCategory)?.name || '';

    // Client-side validation for stripsPerBox: required, positive integer
    const stripsNum = Number(stripsPerBox.trim());
    if (!Number.isFinite(stripsNum) || !Number.isInteger(stripsNum) || stripsNum < 1) {
      alert('Please enter a valid whole number (>= 1) for "Strips Per Box".');
      return;
    }

    // Optional Initial Batch Stock In fields validation
    const formData = new FormData(e.currentTarget);
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
      await addMedicineAndCategory({
        medicineName,
        genericFormula,
        categoryName: finalCategoryName,
        minStockLevel: Number(minStockLevel),
        rackLocation: rackLocation || undefined,
        stripsPerBox: stripsNum,
        defaultSellingUnit: defaultSellingUnit as 'BOX' | 'STRIP',
        barcode: barcode || undefined,
        initialBatch
      });
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col border border-white/50 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-teal-500/5 to-blue-500/5 flex-shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Add New Medicine</h2>
            <p className="text-xs text-slate-500 mt-0.5">Register a drug profile and add active batches</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Autocomplete Template / Inventory Search Bar */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 relative flex-shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Pakistani catalog templates or registered drugs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-100 hover:border-slate-200 focus:border-teal-500 rounded-xl text-sm text-slate-800 bg-white focus:outline-none transition-all placeholder-slate-400 shadow-sm focus:ring-4 focus:ring-teal-500/5"
            />
          </div>

          {searchQuery.trim() !== '' && (
            <div className="absolute left-6 right-6 mt-2 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-2xl max-h-60 overflow-y-auto z-50 p-2 space-y-1 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
              
              {/* Existing Registered Inventory matches */}
              {filteredExisting.length > 0 && (
                <div className="pb-1.5 pt-1">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-rose-500 px-2.5 mb-1.5 block">Already Registered (Stock-In)</span>
                  {filteredExisting.map(med => (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => onSelectExistingMedicine?.(med.id)}
                      className="w-full text-left px-3 py-2 hover:bg-rose-50/60 rounded-xl flex items-center justify-between text-xs transition-colors group"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{med.name}</p>
                        <p className="text-slate-400 text-[10px]">{med.genericFormula}</p>
                      </div>
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1 group-hover:bg-rose-200 transition-colors">
                        Add Stock <ArrowRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Standard Templates matches */}
              {filteredTemplates.length > 0 && (
                <div className="pt-2 pb-1">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-teal-600 px-2.5 mb-1.5 block">Catalog Templates (Auto-fill)</span>
                  {filteredTemplates.map((template, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyTemplate(template)}
                      className="w-full text-left px-3 py-2 hover:bg-teal-50/60 rounded-xl flex items-center justify-between text-xs transition-colors group"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{template.name}</p>
                        <p className="text-slate-400 text-[10px]">{template.genericFormula} • {template.categoryName}</p>
                      </div>
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-full flex items-center gap-1 group-hover:bg-teal-200 transition-colors">
                        Auto-fill <Sparkles className="w-3 h-3 text-teal-600" />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {filteredExisting.length === 0 && filteredTemplates.length === 0 && (
                <div className="p-4 text-center text-slate-400 text-xs font-semibold">
                  No registered drugs or templates found matching "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Duplicate Warning Card */}
        {matchedExisting && (
          <div className="mx-6 mt-4 p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-200/60 text-amber-900 rounded-[1.5rem] flex gap-3 text-xs animate-in slide-in-from-top-2 shadow-sm shadow-amber-500/5">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 animate-bounce" />
            <div className="flex-1">
              <p className="font-extrabold text-amber-800">Important Notice</p>
              <p className="text-amber-800/80 mt-1 leading-relaxed font-medium">
                "{matchedExisting.name}" is already registered in your database system! To add new stock (with a new price/expiry), click the button below to directly record a new batch instead of creating a duplicate.
              </p>
              <button
                type="button"
                onClick={() => onSelectExistingMedicine?.(matchedExisting.id)}
                className="mt-3.5 inline-flex items-center gap-1.5 font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl shadow-md shadow-amber-600/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                Go to Stock In for this Medicine <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Medicine Name *</label>
              <input 
                required 
                name="medicineName" 
                type="text" 
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-slate-100 focus:border-teal-500 rounded-xl text-slate-800 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10 text-sm transition-all duration-300" 
                placeholder="e.g. Panadol Advance" 
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Generic Formula *</label>
              <input 
                required 
                name="genericFormula" 
                type="text" 
                value={genericFormula}
                onChange={(e) => setGenericFormula(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-slate-100 focus:border-teal-500 rounded-xl text-slate-800 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10 text-sm transition-all duration-300" 
                placeholder="e.g. Paracetamol 500mg" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Category</label>
                <select 
                  name="existingCategory" 
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    if (e.target.value !== '') setNewCategoryName('');
                  }}
                  className="w-full px-4 py-2.5 border-2 border-slate-100 focus:border-teal-500 rounded-xl text-slate-800 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10 text-sm transition-all duration-300"
                >
                  <option value="">-- Or enter new --</option>
                  {existingCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">New Category</label>
                <input 
                  name="categoryName" 
                  type="text" 
                  value={newCategoryName}
                  onChange={(e) => {
                    setNewCategoryName(e.target.value);
                    if (e.target.value !== '') setSelectedCategory('');
                  }}
                  disabled={selectedCategory !== ''}
                  className="w-full px-4 py-2.5 border-2 border-slate-100 focus:border-teal-500 rounded-xl text-slate-800 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10 text-sm transition-all duration-300 disabled:opacity-55 disabled:bg-slate-100" 
                  placeholder="e.g. Painkillers" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Min Stock Level *</label>
                <input 
                  required 
                  name="minStockLevel" 
                  type="number" 
                  min="0" 
                  value={minStockLevel}
                  onChange={(e) => setMinStockLevel(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-slate-100 focus:border-teal-500 rounded-xl text-slate-800 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10 text-sm transition-all duration-300" 
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Rack Location</label>
                <input 
                  name="rackLocation" 
                  type="text" 
                  value={rackLocation}
                  onChange={(e) => setRackLocation(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-slate-100 focus:border-teal-500 rounded-xl text-slate-800 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10 text-sm transition-all duration-300" 
                  placeholder="e.g. A1-Shelf 3" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Strips Per Box *</label>
                <input 
                  name="stripsPerBox" 
                  type="number" 
                  min="1" 
                  step="1" 
                  inputMode="numeric" 
                  required 
                  value={stripsPerBox}
                  onChange={(e) => setStripsPerBox(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-slate-100 focus:border-teal-500 rounded-xl text-slate-800 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10 text-sm transition-all duration-300" 
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Default Selling Unit</label>
                <select 
                  name="defaultSellingUnit" 
                  value={defaultSellingUnit}
                  onChange={(e) => setDefaultSellingUnit(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-slate-100 focus:border-teal-500 rounded-xl text-slate-800 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10 text-sm transition-all duration-300"
                >
                  <option value="BOX">Box</option>
                  <option value="STRIP">Strip</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Barcode (Optional)</label>
              <input 
                name="barcode" 
                type="text" 
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-slate-100 focus:border-teal-500 rounded-xl text-slate-800 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10 text-sm transition-all duration-300" 
                placeholder="Scan or type barcode" 
              />
            </div>

            {/* Stock In / Initial Batch (Optional) */}
            <div className="border border-slate-200/50 rounded-2xl p-4 mt-6 bg-slate-50/40">
              <h3 className="text-xs font-black text-slate-800 tracking-wide uppercase mb-3 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-600" />
                Initial Stock In / New Batch (Optional)
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Batch Number</label>
                  <input name="batchNumber" type="text" className="w-full px-3 py-2 border-2 border-slate-100 hover:border-slate-200 focus:border-teal-500 rounded-xl text-slate-800 bg-white focus:outline-none text-xs transition-all" placeholder="e.g. B-10293" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Expiry Date</label>
                  <input name="expiryDate" type="date" className="w-full px-3 py-2 border-2 border-slate-100 hover:border-slate-200 focus:border-teal-500 rounded-xl text-slate-800 bg-white focus:outline-none text-xs transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Purchase Price (Box)</label>
                  <input name="purchasePrice" type="number" step="0.01" min="0" className="w-full px-3 py-2 border-2 border-slate-100 hover:border-slate-200 focus:border-teal-500 rounded-xl text-slate-800 bg-white focus:outline-none text-xs transition-all" placeholder="Rs. 0.00" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Retail Price (Box)</label>
                  <input name="retailPrice" type="number" step="0.01" min="0" className="w-full px-3 py-2 border-2 border-slate-100 hover:border-slate-200 focus:border-teal-500 rounded-xl text-slate-800 bg-white focus:outline-none text-xs transition-all" placeholder="Rs. 0.00" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Quantity</label>
                  <input name="quantity" type="number" min="1" className="w-full px-3 py-2 border-2 border-slate-100 hover:border-slate-200 focus:border-teal-500 rounded-xl text-slate-800 bg-white focus:outline-none text-xs transition-all" placeholder="e.g. 10" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Unit</label>
                  <select name="unit" className="w-full px-3 py-2 border-2 border-slate-100 hover:border-slate-200 focus:border-teal-500 rounded-xl text-slate-800 bg-white focus:outline-none text-xs transition-all">
                    <option value="BOX">Box</option>
                    <option value="STRIP">Strip</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50/80 backdrop-blur-md border-t border-slate-100 flex justify-end gap-3 flex-shrink-0 sticky bottom-0 z-40">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all">
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading || !!matchedExisting} 
              className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-teal-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading ? 'Saving...' : 'Save Medicine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
