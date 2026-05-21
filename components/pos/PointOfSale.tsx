'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Plus, Minus, ShoppingCart, ScanBarcode, CheckCircle2, Printer, AlertCircle, Trash2 } from 'lucide-react';
import PosScannerModal from '../modals/PosScannerModal';
import { checkoutSale } from '@/app/actions';
import ReceiptPrinter from './ReceiptPrinter';

export default function PointOfSale({
  isOpen,
  onClose,
  inventory,
  posQuickCashNotes = ['50', '100', '500', '1000', '5000']
}: {
  isOpen: boolean;
  onClose: () => void;
  inventory: any[];
  posQuickCashNotes?: string[];
}) {
  const [cart, setCart] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [cashierName, setCashierName] = useState('Admin');
  const [receiptId, setReceiptId] = useState('');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [listModalContent, setListModalContent] = useState<{title: string, items: string[]} | null>(null);
  const [isPosScannerOpen, setIsPosScannerOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<any | null>(null);
  const [stripInput, setStripInput] = useState('1');
  const [pendingUnit, setPendingUnit] = useState<'BOX' | 'STRIP'>('STRIP');
  const [batchSelectionItem, setBatchSelectionItem] = useState<{ medName: string; batches: any[] } | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  
  const receiptRef = useRef<HTMLDivElement>(null);

  // Extract category names dynamically from inventory
  const categoriesList = ['All', ...Array.from(new Set(inventory.map(med => med.categoryName || 'General').filter(Boolean)))];

  // Compute unique out-of-stock and low-stock names
  const outOfStockNames = Array.from(new Set(inventory.filter(med => med.totalStockUnits === 0).map(med => med.name)));

  const lowStockNames = Array.from(new Set(inventory.filter(med => med.totalStockUnits > 0 && med.totalStockUnits <= 3).map(med => med.name)));

  // Available batches for POS (only items with stock)
  const availableItems = inventory.flatMap(med => {
    if (!med.batches || med.batches.length === 0) {
      const stripsPerBox = med.stripsPerBox || 1;
      const boxPrice = med.retailPrice || 0;
      const stripPrice = boxPrice / stripsPerBox;
      return [{
        ...med,
        batchId: `empty-${med.id}`,
        batchNumber: '-',
        batchQuantity: 0,
        batchPrice: stripPrice,
        boxPrice: boxPrice,
        barcode: med.barcode
      }];
    }
    return med.batches.map((b: any) => {
      const stripsPerBox = med.stripsPerBox || 1;
      const boxPrice = b.retailPrice || 0;
      const stripPrice = boxPrice / stripsPerBox;
      return {
        ...med,
        batchId: b.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        // batchQuantity is total smallest-units (strips)
        batchQuantity: b.quantity,
        batchPrice: stripPrice,
        boxPrice: boxPrice,
        stripsPerBox: stripsPerBox,
        defaultSellingUnit: med.defaultSellingUnit || 'BOX',
        barcode: med.barcode
      };
    });
  });

  const filteredItems = availableItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.genericFormula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.barcode && item.barcode.includes(searchTerm));
    
    if (activeCategory === 'All') return matchesSearch;
    return matchesSearch && item.categoryName === activeCategory;
  });

  const addToCart = useCallback((item: any) => {
    if (item.batchQuantity <= 0) {
      setAlertMessage(`"${item.name}" is out of stock and cannot be added!`);
      return;
    }
    
    const existingIndex = cart.findIndex(i => i.batchId === item.batchId);
    if (existingIndex > -1) {
      const existing = cart[existingIndex];
      const stripsPerBox = existing.stripsPerBox || 1;
      const maxInUnit = existing.unit === 'BOX' ? Math.floor(existing.batchQuantity / stripsPerBox) : existing.batchQuantity;
      
      if (existing.quantity >= maxInUnit) {
        setAlertMessage(`Cannot add more. Stock limit of ${maxInUnit} ${existing.unit === 'BOX' ? 'box(es)' : 'strip(s)'} reached!`);
        return;
      }
      
      setCart(prev => prev.map((cItem, idx) => 
        idx === existingIndex ? { ...cItem, quantity: cItem.quantity + 1 } : cItem
      ));
      return;
    }
    
    setPendingItem(item);
    setStripInput('1');
    setPendingUnit(item.defaultSellingUnit === 'BOX' ? 'BOX' : 'STRIP');
  }, [cart]);

  const handleBarcodeAdd = useCallback((barcode: string) => {
    const matches = availableItems.filter(i => i.barcode === barcode && i.batchQuantity > 0);
    if (matches.length === 0) {
      setAlertMessage(`No active stock found for scanned barcode: ${barcode}`);
      return;
    }
    
    const uniquePrices = Array.from(new Set(matches.map(m => m.boxPrice)));
    if (matches.length > 1 && uniquePrices.length > 1) {
      setBatchSelectionItem({ medName: matches[0].name, batches: matches });
    } else {
      addToCart(matches[0]);
    }
  }, [availableItems, addToCart]);

  // USB Barcode Scanner Listener
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in the search input directly, unless it's a very fast scanner input.
      // But for safety, we just capture fast inputs anywhere or if Enter is pressed after some chars.
      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 3) {
          handleBarcodeAdd(barcodeBuffer);
          setSearchTerm(''); // clear search if they happened to focus it
        }
        setBarcodeBuffer('');
      } else if (e.key.length === 1) { // Normal character
        setBarcodeBuffer(prev => prev + e.key);
      }
    };

    // Buffer timeout to clear accidentally typed characters
    let timeout: NodeJS.Timeout;
    if (barcodeBuffer.length > 0) {
      timeout = setTimeout(() => {
        setBarcodeBuffer('');
      }, 100); // 100ms is usually enough for scanner (they type < 50ms per char)
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeout);
    };
  }, [isOpen, barcodeBuffer, handleBarcodeAdd]);

  const removeFromCart = (batchId: string) => {
    setCart(prev => prev.filter(i => i.batchId !== batchId));
  };

  const handlePosScan = (barcode: string, mode: 'add' | 'remove') => {
    if (mode === 'add') {
      handleBarcodeAdd(barcode);
    } else {
      const cartItem = cart.find(i => i.barcode === barcode);
      if (cartItem) {
        removeFromCart(cartItem.batchId);
      } else {
        setAlertMessage(`No matching item in cart to remove!`);
      }
    }
  };

  const updateQuantity = (batchId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(batchId);
      return;
    }
    setCart(prev => prev.map(i => {
      if (i.batchId === batchId) {
        // For items in cart, `quantity` is stored in the selected unit (BOX or STRIP)
        const stripsPerBox = i.stripsPerBox || 1;
        // compute max allowed in that unit
        const maxInUnit = i.unit === 'BOX' ? Math.floor(i.batchQuantity / stripsPerBox) : i.batchQuantity;
        if (qty > maxInUnit) {
          setAlertMessage(`Cannot add more. Only ${maxInUnit} available in selected unit!`);
          return i;
        }
        return { ...i, quantity: qty };
      }
      return i;
    }));
  };

  const subtotal = cart.reduce((sum, item) => {
    return sum + item.quantity * (item.unitPrice || item.batchPrice || 0);
  }, 0);
  const discountAmount = subtotal * ((Number(discountPercent) || 0) / 100);
  const total = subtotal - discountAmount;
  const changeDue = Math.max(0, (Number(tenderedAmount) || 0) - total);

  const handleCheckout = async (printReceipt: boolean = true) => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      await checkoutSale(cart.map(i => ({
        medicineId: i.id,
        batchId: i.batchId,
        // convert quantity to smallest unit (strips) for server
        quantity: i.unit === 'BOX' ? i.quantity * (i.stripsPerBox || 1) : i.quantity,
        price: (i.stripPrice || i.batchPrice || 0) * (1 - (Number(discountPercent) || 0) / 100),
        unit: i.unit
      })));
      
      const newId = 'REC-' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
      setReceiptId(newId);

      setTimeout(() => {
        if (printReceipt) {
          window.print();
        }
        setCart([]);
        setTenderedAmount('');
      }, 200);
      
    } catch (error) {
      console.error(error);
      setAlertMessage('Checkout failed. Check stock levels.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
        <div className="bg-white w-full h-full flex flex-col md:flex-row shadow-xl overflow-hidden">
          
          {/* LEFT: Product Selection */}
          <div className="flex-1 min-w-0 flex flex-col bg-slate-50 border-r border-slate-200">
            <div className="p-4 border-b border-white/20 bg-gradient-to-r from-teal-500 to-blue-600 text-white flex items-center justify-between shadow-md z-10 gap-4">
              <div className="flex items-center flex-wrap gap-4 min-w-0">
                <h2 className="text-xl font-bold flex items-center tracking-tight whitespace-nowrap">
                  <ScanBarcode className="mr-3 w-6 h-6 text-teal-100" /> POS Terminal
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => setListModalContent({ title: 'Low Stock Items', items: lowStockNames })}
                    className="bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm transition-all transform hover:scale-105 active:scale-95 whitespace-nowrap"
                  >
                    Low Stock: {lowStockNames.length}
                  </button>
                  <button 
                    onClick={() => setListModalContent({ title: 'Out of Stock Items', items: outOfStockNames })}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm transition-all transform hover:scale-105 active:scale-95 whitespace-nowrap"
                  >
                    Out of Stock: {outOfStockNames.length}
                  </button>
                </div>
              </div>
              <button onClick={onClose} className="flex-shrink-0 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="p-4 bg-white shadow-sm z-0 flex gap-3">
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-teal-500" />
                <input
                  type="text"
                  placeholder="Search item or scan barcode..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-2xl text-slate-900 bg-slate-50 hover:bg-white focus:bg-white focus:border-teal-500 focus:ring-0 text-lg transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchTerm.trim().length > 0) {
                      const term = searchTerm.trim().toLowerCase();
                      const matches = availableItems.filter(i => 
                        (i.barcode === searchTerm.trim() || i.name.toLowerCase() === term) && 
                        i.batchQuantity > 0
                      );
                      
                      if (matches.length === 0) {
                        setAlertMessage(`No active stock found for "${searchTerm.trim()}".`);
                        return;
                      }
                      
                      const uniquePrices = Array.from(new Set(matches.map(m => m.boxPrice)));
                      if (matches.length > 1 && uniquePrices.length > 1) {
                        setBatchSelectionItem({ medName: matches[0].name, batches: matches });
                        setSearchTerm('');
                      } else {
                        addToCart(matches[0]);
                        setSearchTerm('');
                      }
                    }
                  }}
                  autoFocus
                />
              </div>
              <button 
                onClick={() => setIsPosScannerOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-6 rounded-2xl flex items-center justify-center font-bold shadow-md transition-all transform hover:-translate-y-0.5 active:scale-95"
              >
                <ScanBarcode className="w-5 h-5 mr-2" />
                Scanner
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 flex flex-col space-y-4">
              {/* Dynamic Horizontal Category Pills */}
              <div className="flex gap-2 overflow-x-auto pb-3 pt-1 px-1 no-scrollbar flex-shrink-0">
                {categoriesList.map((cat) => {
                  const isActive = activeCategory === cat;
                  const itemCount = availableItems.filter(i => (cat === 'All' || i.categoryName === cat) && i.batchQuantity > 0).length;
                  
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-4 py-2 rounded-full font-bold text-xs whitespace-nowrap shadow-sm border transition-all transform active:scale-95 flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-gradient-to-r from-teal-500 to-blue-600 text-white border-transparent shadow-teal-500/10'
                          : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <span>{cat === 'All' ? '💊 All' : cat}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {itemCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredItems.map(item => (
                  <div 
                    key={item.batchId} 
                    onClick={() => addToCart(item)}
                    className={`bg-white p-3 rounded-xl border ${item.batchQuantity <= 0 ? 'border-red-200 opacity-60' : 'border-slate-200 cursor-pointer hover:border-teal-500 hover:shadow-lg hover:shadow-teal-500/10 active:scale-95'} shadow-sm transition-all group relative overflow-hidden`}
                  >
                    {item.batchQuantity > 0 && <div className="absolute top-0 left-0 w-1 h-full bg-teal-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
                    <div className="font-bold text-slate-800 line-clamp-1 text-base mb-1">{item.name}</div>
                    <div className="text-[11px] text-slate-500 font-medium mb-2 line-clamp-1 bg-slate-100 inline-block px-2 py-0.5 rounded-full">{item.genericFormula}</div>
                    <div className="flex justify-between items-end mt-2">
                      <div className="flex flex-col gap-1">
                        <div className="text-[10px] text-teal-600 font-bold tracking-wide uppercase">Batch: {item.batchNumber}</div>
                        {item.batchQuantity > 0 ? (
                          <div className={`text-[9px] text-white px-2 py-0.5 rounded-full font-bold uppercase ${item.batchQuantity <= 3 ? 'bg-orange-500 animate-pulse' : 'bg-slate-800'}`}>
                            Stock: {item.batchQuantity}
                          </div>
                        ) : (
                          <div className="text-[9px] text-white bg-red-600 px-2 py-0.5 rounded-full font-bold uppercase">
                            Out of Stock
                          </div>
                        )}
                      </div>
                      <div className="font-extrabold text-lg text-slate-900 text-right leading-tight">
                        <div>Box: Rs. {(item.boxPrice ?? ((item.batchPrice || 0) * (item.stripsPerBox || 1))).toFixed(2)}</div>
                        <div className="text-xs font-semibold text-slate-500">Strip: Rs. {(item.batchPrice || 0).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredItems.length === 0 && (
                  <div className="col-span-full p-8 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                      <Search className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-slate-500 text-base font-medium">No items found with available stock.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Cart & Checkout */}
          <div className="w-full md:w-96 h-full max-h-full bg-white flex flex-col overflow-hidden shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
            <div className="p-4 bg-slate-900 text-white flex items-center shadow-md flex-shrink-0">
              <ShoppingCart className="mr-3 w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold tracking-wide">Current Order</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/50">
              {cart.map(item => (
                <div key={item.batchId} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col relative hover:border-blue-200 transition-colors">
                  <div className="font-bold text-slate-800 pr-4 text-base">{item.name}</div>
                  <div className="text-xs text-slate-500 mb-1.5 font-medium">
                    Rs. {(item.unitPrice || item.batchPrice || 0).toFixed(2)} / {item.unit === 'BOX' ? 'box' : 'strip'}
                    {' '}• {item.unit === 'BOX' ? `${item.quantity} box(es)` : `${item.quantity} strip(s)`}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center bg-slate-100 rounded-lg overflow-hidden p-0.5">
                      <button onClick={() => updateQuantity(item.batchId, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center bg-white hover:bg-slate-50 rounded text-slate-600 font-bold shadow-sm transition-all active:scale-90">-</button>
                      <span className="w-8 text-center font-bold text-sm text-slate-800">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.batchId, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center bg-white hover:bg-slate-50 rounded text-slate-600 font-bold shadow-sm transition-all active:scale-90">+</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-extrabold text-base text-blue-600">Rs. {((item.unitPrice || item.batchPrice || 0) * item.quantity).toFixed(2)}</div>
                      <button 
                        onClick={() => removeFromCart(item.batchId)}
                        className="bg-red-50 hover:bg-red-500 hover:text-white text-red-600 p-1.5 rounded-lg transition-all shadow-sm active:scale-90"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                  <p className="font-medium text-base">Cart is empty</p>
                  <p className="text-xs text-slate-400 text-center px-6 mt-1">Scan a barcode or search for an item to add it to the cart.</p>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold uppercase tracking-wider">Cashier</span>
                <input 
                  type="text" 
                  value={cashierName} 
                  onChange={e => setCashierName(e.target.value)} 
                  className="border border-slate-200 rounded-lg px-2.5 py-1 text-right w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 bg-slate-50 font-medium text-xs" 
                />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold uppercase tracking-wider">Discount (%)</span>
                <input 
                  type="number" 
                  value={discountPercent} 
                  onChange={e => setDiscountPercent(e.target.value)} 
                  className="border border-slate-200 rounded-lg px-2.5 py-1 text-right w-24 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-bold text-orange-700 bg-orange-50 text-xs" 
                  placeholder="0"
                  min="0"
                  max="100"
                />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold uppercase tracking-wider">Items</span>
                <span className="font-extrabold text-slate-700 text-sm">{cart.length}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold uppercase tracking-wider">Tendered (Rs.)</span>
                <input 
                  type="number" 
                  value={tenderedAmount} 
                  onChange={e => setTenderedAmount(e.target.value)} 
                  className="border border-slate-200 rounded-lg px-2.5 py-1 text-right w-24 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-bold text-emerald-700 bg-emerald-50 text-xs" 
                  placeholder="0.00"
                />
              </div>

              {/* Quick Cash Pakistani Rupee Notes Keypad */}
              <div className="py-2.5 border-y border-dashed border-slate-200/80 space-y-1.5 flex-shrink-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Quick Cash Tenders</div>
                <div className="flex flex-wrap gap-1">
                  {posQuickCashNotes.map((noteStr) => {
                    const note = Number(noteStr);
                    if (isNaN(note)) return null;
                    return (
                      <button
                        key={noteStr}
                        onClick={() => {
                          const current = Number(tenderedAmount) || 0;
                          setTenderedAmount(String(current + note));
                        }}
                        className="flex-1 min-w-[60px] text-center py-1 bg-slate-50 border border-slate-200/80 hover:bg-emerald-50 hover:border-emerald-200/60 rounded-lg font-bold text-slate-700 text-xs transition-colors shadow-sm transform active:scale-95 cursor-pointer"
                      >
                        +{note}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-1.5 pt-0.5">
                  <button
                    onClick={() => setTenderedAmount(total.toFixed(2))}
                    className="flex-1 py-1 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg font-black text-teal-800 text-[10px] uppercase tracking-wider transition-colors shadow-sm transform active:scale-95 cursor-pointer"
                  >
                    Exact Cash
                  </button>
                  <button
                    onClick={() => setTenderedAmount('')}
                    className="py-1 px-3 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg font-bold text-red-700 text-[10px] uppercase tracking-wider transition-colors shadow-sm transform active:scale-95 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold uppercase tracking-wider">Change</span>
                <span className="font-extrabold text-emerald-600 text-sm">Rs. {changeDue.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-end mb-3 pt-2 border-t border-dashed border-slate-200">
                <div className="flex flex-col">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-0.5">Total Due</span>
                  {Number(discountPercent) > 0 && (
                    <span className="text-[10px] text-orange-600 font-bold line-through">Rs. {subtotal.toFixed(2)}</span>
                  )}
                </div>
                <span className="text-2xl font-black text-slate-900 tracking-tight">Rs. {total.toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleCheckout(false)}
                  disabled={cart.length === 0 || loading || (tenderedAmount !== '' && Number(tenderedAmount) < total)}
                  className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm flex items-center justify-center transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  {loading ? 'Processing...' : 'Pay Only'}
                </button>
                <button 
                  onClick={() => handleCheckout(true)}
                  disabled={cart.length === 0 || loading || (tenderedAmount !== '' && Number(tenderedAmount) < total)}
                  className="w-1/2 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm flex items-center justify-center transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  {loading ? 'Processing...' : (
                    <>
                      <Printer className="w-4 h-4 mr-1.5" /> Pay & Print
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ReceiptPrinter 
        ref={receiptRef} 
        cart={cart} 
        total={total} 
        tendered={Number(tenderedAmount) || 0}
        change={changeDue}
        cashier={cashierName}
        receiptId={receiptId}
        discount={discountAmount}
        items={cart.length}
      />

      {/* Strip Count Input Modal */}
      {pendingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 print:hidden animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
                    <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Enter Quantity</h3>
                    <p className="text-slate-600 font-medium mb-6">How many <span className="font-bold text-blue-600">{pendingItem.name}</span>?</p>
                    <div className="flex items-center gap-3 mb-4">
                      <select value={pendingUnit} onChange={e => setPendingUnit(e.target.value as any)} className="px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white">
                        <option value="STRIP">Strip</option>
                        <option value="BOX">Box</option>
                      </select>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setStripInput(Math.max(1, Number(stripInput) - 1).toString())}
                          className="w-12 h-12 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600"
                        >
                          -
                        </button>
                        <input 
                          type="number" 
                          value={stripInput} 
                          onChange={e => setStripInput(e.target.value)} 
                          className="w-24 border-2 border-slate-200 rounded-xl px-4 py-3 text-center text-2xl font-bold text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                          autoFocus
                          min="1"
                          max={pendingUnit === 'BOX' ? Math.max(1, Math.floor(pendingItem.batchQuantity / (pendingItem.stripsPerBox || 1))) : pendingItem.batchQuantity}
                        />
                        <button 
                          onClick={() => setStripInput(Math.min(pendingUnit === 'BOX' ? Math.max(1, Math.floor(pendingItem.batchQuantity / (pendingItem.stripsPerBox || 1))) : pendingItem.batchQuantity, Number(stripInput) + 1).toString())}
                          className="w-12 h-12 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mb-6">Available: {Math.floor(pendingItem.batchQuantity / (pendingItem.stripsPerBox || 1))} boxes ({pendingItem.batchQuantity} strips)</p>
                  </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setPendingItem(null)}
                className="flex-1 py-3 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-xl font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const qty = Number(stripInput);
                  const stripsPerBox = pendingItem.stripsPerBox || 1;
                  const maxInUnit = pendingUnit === 'BOX' ? Math.floor(pendingItem.batchQuantity / stripsPerBox) : pendingItem.batchQuantity;
                  if (qty > 0 && qty <= maxInUnit) {
                    const stripUnitPrice = pendingItem.batchPrice || pendingItem.retailPrice || 0;
                    const unitPrice = pendingUnit === 'BOX' ? stripUnitPrice * stripsPerBox : stripUnitPrice;
                    setCart(prev => [...prev, { ...pendingItem, quantity: qty, unit: pendingUnit, stripsPerBox: stripsPerBox, stripPrice: stripUnitPrice, unitPrice }]);
                    setPendingItem(null);
                    setStripInput('1');
                    setPendingUnit('STRIP');
                  }
                }}
                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertMessage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 print:hidden animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Stock Alert</h3>
              <p className="text-slate-500 font-medium leading-relaxed">{alertMessage}</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setAlertMessage(null)}
                className="w-full py-4 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white rounded-2xl font-bold text-lg shadow-lg shadow-slate-900/20 transform transition-all hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Custom List Modal for Out of Stock / Low Stock */}
      {listModalContent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 print:hidden animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="p-6 text-center border-b border-slate-100 flex-shrink-0 relative">
              <button 
                onClick={() => setListModalContent(null)}
                className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner ${listModalContent.title.includes('Out') ? 'bg-red-100' : 'bg-orange-100'}`}>
                <AlertCircle className={`w-8 h-8 ${listModalContent.title.includes('Out') ? 'text-red-500' : 'text-orange-500'}`} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">{listModalContent.title}</h3>
              <p className="text-slate-500 font-medium mt-1">{listModalContent.items.length} total items</p>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
              {listModalContent.items.length > 0 ? (
                <ul className="space-y-2">
                  {listModalContent.items.map((name, idx) => (
                    <li key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm font-bold text-slate-700 flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-3 ${listModalContent.title.includes('Out') ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                      {name}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center text-slate-400 py-8 font-medium">
                  No items found in this category.
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex-shrink-0">
              <button
                onClick={() => setListModalContent(null)}
                className="w-full py-3.5 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white rounded-xl font-bold text-lg shadow-lg shadow-slate-900/20 transform transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Selection Modal for Multi-Price Batches */}
      {batchSelectionItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-center justify-center p-4 print:hidden animate-in fade-in duration-200">
          <div className="bg-white/80 backdrop-blur-xl w-full max-w-lg rounded-[2rem] border border-white/40 shadow-2xl overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-6 text-center border-b border-slate-200/50 bg-gradient-to-r from-teal-500/10 to-blue-500/10 flex-shrink-0 relative">
              <button 
                onClick={() => setBatchSelectionItem(null)}
                className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 bg-white/50 hover:bg-white p-2 rounded-full transition-all border border-slate-200/50"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-16 h-16 bg-gradient-to-tr from-teal-500 to-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/20 transform rotate-3">
                <ScanBarcode className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Multiple Batches Found</h3>
              <p className="text-slate-500 font-semibold mt-1">
                Select active batch for <span className="text-teal-600 font-bold">{batchSelectionItem.medName}</span>
              </p>
            </div>
                        <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1 space-y-4">
              {(() => {
                const nonExpired = batchSelectionItem.batches.filter(b => {
                  if (!b.expiryDate) return false;
                  return new Date(b.expiryDate).getTime() > Date.now();
                });
                const earliestBatchId = nonExpired.length > 0
                  ? [...nonExpired].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0].batchId
                  : null;

                return batchSelectionItem.batches.map((batch) => {
                  const isNearExpiry = batch.expiryDate && (new Date(batch.expiryDate).getTime() - Date.now() < 90 * 24 * 60 * 60 * 1000);
                  const isExpired = batch.expiryDate && (new Date(batch.expiryDate).getTime() < Date.now());
                  const isRecommended = batch.batchId === earliestBatchId;
                  const formattedExpiry = batch.expiryDate 
                    ? new Date(batch.expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                    : 'N/A';
                  
                  return (
                    <div 
                      key={batch.batchId}
                      onClick={() => {
                        addToCart(batch);
                        setBatchSelectionItem(null);
                      }}
                      className={`group p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex justify-between items-center relative overflow-hidden ${
                        isRecommended 
                          ? 'bg-gradient-to-r from-teal-500/5 to-emerald-500/5 hover:from-teal-500/10 hover:to-emerald-500/10 border-teal-500/40 hover:border-teal-500 shadow-md shadow-teal-500/5' 
                          : 'bg-white/70 hover:bg-white border-slate-200/60 hover:border-teal-500 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className={`absolute top-0 left-0 w-1.5 h-full transition-opacity ${isRecommended ? 'bg-teal-500 opacity-100' : 'bg-slate-400 opacity-0 group-hover:opacity-100'}`}></div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`font-extrabold text-[10px] px-2.5 py-1 rounded-lg border tracking-wider transition-colors ${
                            isRecommended
                              ? 'bg-teal-50 border-teal-200/50 text-teal-700'
                              : 'bg-slate-100 border-slate-200/40 text-slate-700 group-hover:bg-teal-50 group-hover:text-teal-700'
                          }`}>
                            BATCH: {batch.batchNumber}
                          </span>
                          {isRecommended && (
                            <span className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wide shadow-sm shadow-teal-500/20">
                              FIFO Sell First
                            </span>
                          )}
                          {isExpired ? (
                            <span className="bg-red-100 text-red-700 font-bold text-[10px] px-2 py-0.5 rounded-md uppercase">Expired</span>
                          ) : isNearExpiry ? (
                            <span className="bg-orange-100 text-orange-700 font-bold text-[10px] px-2 py-0.5 rounded-md uppercase">Near Expiry</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <span>Expiry:</span>
                          <span className={`font-semibold ${isExpired ? 'text-red-600' : isNearExpiry ? 'text-orange-600' : 'text-slate-700'}`}>
                            {formattedExpiry}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-600">
                          Available Stock: <span className="text-slate-800 font-extrabold">{batch.batchQuantity} strips</span>
                        </div>
                      </div>
                      
                      <div className="text-right space-y-1">
                        <div className="text-xs font-semibold text-slate-400">Retail Price</div>
                        <div className="text-lg font-black text-slate-800 group-hover:text-teal-600 transition-colors">
                          Rs. {batch.boxPrice.toFixed(2)} <span className="text-xs font-medium text-slate-500">/box</span>
                        </div>
                        <div className="text-xs font-bold text-slate-500">
                          Rs. {batch.batchPrice.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">/strip</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="p-4 bg-white border-t border-slate-200/50 flex-shrink-0 flex gap-3">
              <button
                onClick={() => setBatchSelectionItem(null)}
                className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-base transition-all border border-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone POS Scanner Modal */}
      <PosScannerModal
        isOpen={isPosScannerOpen}
        onClose={() => setIsPosScannerOpen(false)}
        onScan={handlePosScan}
      />
    </>
  );
}
