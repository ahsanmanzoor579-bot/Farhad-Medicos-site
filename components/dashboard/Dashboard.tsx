'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StatsBanner from './StatsBanner';
import NotificationsPanel from './NotificationsPanel';
import InventoryTable from '../tables/InventoryTable';
import SalesTable from '../tables/SalesTable';
import AddMedicineModal from '../modals/AddMedicineModal';
import AddBatchModal from '../modals/AddBatchModal';
import ScanModeModal from '../modals/ScanModeModal';
import PointOfSale from '../pos/PointOfSale';
import ImportDbModal from '../modals/ImportDbModal';
import { PlusCircle, ShoppingBag, Database, LogOut, Activity, ScanBarcode, Bell, X, CheckCircle2, Settings, ShieldAlert, Trash2, SlidersHorizontal, Lock, Eye, EyeOff } from 'lucide-react';
import { clearAllSystemData } from '@/app/actions';

type DashboardProps = {
  stats: any;
  inventory: any[];
  categories: any[];
  todaySales: any[];
};

export default function Dashboard({ stats, inventory, categories, todaySales }: DashboardProps) {
  const [isAddMedicineOpen, setIsAddMedicineOpen] = useState(false);
  const [isPosOpen, setIsPosOpen] = useState(false);
  const [isScanModeOpen, setIsScanModeOpen] = useState(false);
  const [scannedBarcodeForNew, setScannedBarcodeForNew] = useState<string | undefined>(undefined);
  const [activeBatchModalMedId, setActiveBatchModalMedId] = useState<string | null>(null);
  const [isImportDbOpen, setIsImportDbOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isOverrideEnabled, setIsOverrideEnabled] = useState(true);
  const [overrideStatsToZero, setOverrideStatsToZero] = useState(true);
  const [customStats, setCustomStats] = useState({
    uniqueMedicines: '0',
    shortExpiry: '0',
    lowStock: '0',
    stockValue: '0',
    dailySell: '0',
    dailyProfit: '0'
  });
  const [filterMode, setFilterMode] = useState<string>('all');

  const [lowStockThreshold, setLowStockThreshold] = useState<number>(3);
  const [expiryAlertMonths, setExpiryAlertMonths] = useState<number>(6);
  const [posQuickCashNotes, setPosQuickCashNotes] = useState<string[]>(['50', '100', '500', '1000', '5000']);
  
  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLowStock = localStorage.getItem('lowStockThreshold');
      if (savedLowStock) setLowStockThreshold(Number(savedLowStock));

      const savedExpiryMonths = localStorage.getItem('expiryAlertMonths');
      if (savedExpiryMonths) setExpiryAlertMonths(Number(savedExpiryMonths));

      const savedCashNotes = localStorage.getItem('posQuickCashNotes');
      if (savedCashNotes) {
        try {
          setPosQuickCashNotes(JSON.parse(savedCashNotes));
        } catch (e) {
          console.error('Failed to parse cash notes', e);
        }
      }
    }
  }, []);

  const updateLowStockThreshold = (val: number) => {
    setLowStockThreshold(val);
    localStorage.setItem('lowStockThreshold', String(val));
  };

  const updateExpiryAlertMonths = (val: number) => {
    setExpiryAlertMonths(val);
    localStorage.setItem('expiryAlertMonths', String(val));
  };

  const updatePosQuickCashNotes = (notes: string[]) => {
    setPosQuickCashNotes(notes);
    localStorage.setItem('posQuickCashNotes', JSON.stringify(notes));
  };

  const handleExportDatabase = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(inventory, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `farhad_medicos_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error(err);
      alert("Failed to export database backup.");
    }
  };

  const router = useRouter();

  const activeMedName = activeBatchModalMedId 
    ? inventory.find(m => m.id === activeBatchModalMedId)?.name || ''
    : '';
  const activeMedStripsPerBox = activeBatchModalMedId
    ? inventory.find(m => m.id === activeBatchModalMedId)?.stripsPerBox || 1
    : 1;

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const handleScanBarcode = (barcode: string) => {
    setIsScanModeOpen(false);
    
    // Check if product exists in inventory
    const existingMed = inventory.find(m => m.barcode === barcode);
    
    if (existingMed) {
      // Product exists, open Add Batch modal
      setActiveBatchModalMedId(existingMed.id);
    } else {
      // Product doesn't exist, open Add Medicine modal with pre-filled barcode
      setScannedBarcodeForNew(barcode);
      setIsAddMedicineOpen(true);
    }
  };

  const filteredInventory = inventory.filter(item => {
    if (filterMode === 'all' || filterMode === 'total-stock' || filterMode === 'sold-today') return true;
    
    if (filterMode === 'short-expiry') {
      if (!item.nearestExpiry) return false;
      const now = new Date();
      const alertDate = new Date();
      alertDate.setMonth(now.getMonth() + expiryAlertMonths);
      return new Date(item.nearestExpiry) > now && new Date(item.nearestExpiry) <= alertDate;
    }
    
    if (filterMode === 'low-stock') {
      const totalUnits = item.totalStockUnits || 0;
      const stripsPerBox = item.stripsPerBox || 1;
      const thresholdUnits = lowStockThreshold * stripsPerBox;
      return totalUnits > 0 && totalUnits <= thresholdUnits;
    }
    
    return true;
  });

  const dynamicLowStockCount = inventory.filter(item => {
    const totalUnits = item.totalStockUnits || 0;
    const stripsPerBox = item.stripsPerBox || 1;
    const thresholdUnits = lowStockThreshold * stripsPerBox;
    return totalUnits > 0 && totalUnits <= thresholdUnits;
  }).length;

  const dynamicShortExpiryCount = inventory.filter(item => {
    if (!item.nearestExpiry) return false;
    const now = new Date();
    const alertDate = new Date();
    alertDate.setMonth(now.getMonth() + expiryAlertMonths);
    const itemExpiry = new Date(item.nearestExpiry);
    return itemExpiry > now && itemExpiry <= alertDate;
  }).length;

  const displayedStats = {
    totalUniqueMedicines: isOverrideEnabled 
      ? (overrideStatsToZero ? 0 : (Number(customStats.uniqueMedicines) || 0)) 
      : stats.totalUniqueMedicines,
    totalStockValue: isOverrideEnabled 
      ? (overrideStatsToZero ? 0 : (Number(customStats.stockValue) || 0)) 
      : stats.totalStockValue,
    shortExpiryCount: isOverrideEnabled 
      ? (overrideStatsToZero ? 0 : (Number(customStats.shortExpiry) || 0)) 
      : dynamicShortExpiryCount,
    lowStockCount: isOverrideEnabled 
      ? (overrideStatsToZero ? 0 : (Number(customStats.lowStock) || 0)) 
      : dynamicLowStockCount,
    dailySell: isOverrideEnabled 
      ? (overrideStatsToZero ? 0 : (Number(customStats.dailySell) || 0)) 
      : stats.dailySell,
    dailyProfit: isOverrideEnabled 
      ? (overrideStatsToZero ? 0 : (Number(customStats.dailyProfit) || 0)) 
      : stats.dailyProfit,
  };

  const dynamicUrgentBatches = inventory.flatMap(item => {
    if (!item.batches) return [];
    return item.batches
      .filter((b: any) => {
        const expiry = new Date(b.expiryDate);
        const now = new Date();
        const alertDate = new Date();
        alertDate.setMonth(now.getMonth() + expiryAlertMonths);
        return expiry <= alertDate;
      })
      .map((b: any) => ({
        id: b.id || b._id,
        medicineName: item.name,
        batchNumber: b.batchNumber,
        expiryDate: new Date(b.expiryDate)
      }));
  });

  const dynamicLowStockAlerts = inventory
    .filter(item => {
      const totalUnits = item.totalStockUnits || 0;
      const stripsPerBox = item.stripsPerBox || 1;
      const thresholdUnits = lowStockThreshold * stripsPerBox;
      return totalUnits > 0 && totalUnits <= thresholdUnits;
    })
    .map(item => ({
      id: `ls-${item.id}`,
      medicineName: item.name,
      quantity: item.totalStockUnits || 0
    }));

  const totalAlerts = isOverrideEnabled && overrideStatsToZero 
    ? 0 
    : (dynamicUrgentBatches.length + dynamicLowStockAlerts.length);

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 md:p-8 font-sans relative overflow-hidden">
      {/* Decorative floating blur blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-400/10 rounded-full blur-[80px] pointer-events-none -z-10"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[80px] pointer-events-none -z-10"></div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10 print:hidden">
        
        {/* Colorful Glassmorphic Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/70 backdrop-blur-sm p-6 rounded-3xl border border-white/60 shadow-lg shadow-slate-100/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-tr from-teal-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20 transform hover:rotate-3 transition-transform">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-teal-700 to-blue-800 tracking-tight">
                Farhad Medicos
              </h1>
              <p className="text-blue-600/80 font-bold text-xs mt-0.5 uppercase tracking-wider">Premium Inventory Management</p>
            </div>
          </div>
          
          <div className="flex gap-3 flex-wrap items-center">
            {/* Database Import */}
            <button 
              onClick={() => setIsImportDbOpen(true)}
              className="inline-flex items-center justify-center h-10 px-4 bg-white text-teal-700 font-bold text-sm rounded-2xl hover:bg-teal-50 hover:border-teal-200 transition-all shadow-sm border border-teal-100/80 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              <Database className="w-4 h-4 mr-2" />
              Import DB
            </button>
            
            {/* Register Drug */}
            <button 
              onClick={() => {
                setScannedBarcodeForNew(undefined);
                setIsAddMedicineOpen(true);
              }}
              className="inline-flex items-center justify-center h-10 px-4 bg-slate-900 text-white font-bold text-sm rounded-2xl hover:bg-slate-800 transition-all shadow-md transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 mr-2 text-teal-400" />
              Add Medicine
            </button>
            
            {/* Barcode scan */}
            <button 
              onClick={() => setIsScanModeOpen(true)}
              className="inline-flex items-center justify-center h-10 px-4 bg-blue-50 text-blue-800 border border-blue-200 font-bold text-sm rounded-2xl hover:bg-blue-100 transition-all shadow-sm transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              <ScanBarcode className="w-4 h-4 mr-2" />
              Scan to Add
            </button>
            
            {/* Checkout POS */}
            <button 
              onClick={() => setIsPosOpen(true)}
              className="inline-flex items-center justify-center h-10 px-5 bg-gradient-to-r from-teal-500 to-blue-600 text-white font-extrabold text-sm rounded-2xl hover:from-teal-600 hover:to-blue-700 transition-all shadow-lg shadow-teal-500/25 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 mr-2 text-teal-100" />
              POS Checkout
            </button>

            {/* Glowing Active Alerts Badge */}
            <button 
              onClick={() => setIsNotificationsOpen(true)}
              className={`relative inline-flex items-center justify-center h-10 px-4 bg-white text-slate-700 font-bold text-sm rounded-2xl border transition-all shadow-sm transform hover:-translate-y-0.5 active:scale-95 cursor-pointer ${
                totalAlerts > 0 
                  ? 'border-rose-200 text-rose-700 hover:bg-rose-50/50' 
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Bell className={`w-4 h-4 mr-2 ${totalAlerts > 0 ? 'text-rose-500 animate-bounce' : 'text-slate-400'}`} />
              Alerts
              {totalAlerts > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-white animate-pulse">
                  {totalAlerts}
                </span>
              )}
            </button>

            {/* Admin Control Settings Button */}
            <button 
              onClick={() => {
                if (isAdminAuthenticated) {
                  setIsAdminOpen(true);
                } else {
                  setAdminUsername('');
                  setAdminPassword('');
                  setAdminLoginError('');
                  setShowAdminPassword(false);
                  setIsAdminLoginOpen(true);
                }
              }}
              className={`inline-flex items-center justify-center h-10 px-4 font-black text-sm rounded-2xl transition-all shadow-md transform hover:-translate-y-0.5 active:scale-95 cursor-pointer ${
                isOverrideEnabled 
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-orange-500/25' 
                  : 'bg-gradient-to-r from-slate-100 to-slate-200 border border-slate-300 text-slate-700 hover:from-slate-200 hover:to-slate-300'
              }`}
              title="Admin Settings & Overrides"
            >
              <Settings className={`w-4 h-4 mr-2 ${isOverrideEnabled ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              Admin Control
            </button>

            {/* Logout */}
            <button 
              onClick={handleLogout}
              className="inline-flex items-center justify-center h-10 w-10 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 hover:border-red-200 transition-all shadow-sm border border-red-100 active:scale-95 cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Banner */}
        <StatsBanner 
          totalUniqueMedicines={displayedStats.totalUniqueMedicines}
          totalStockValue={displayedStats.totalStockValue}
          shortExpiryCount={displayedStats.shortExpiryCount}
          lowStockCount={displayedStats.lowStockCount}
          dailySell={displayedStats.dailySell}
          dailyProfit={displayedStats.dailyProfit}
          filterMode={filterMode}
          onFilterChange={setFilterMode}
        />

        {/* Dynamic Table Area */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-lg shadow-slate-100/50 p-2">
          {filterMode === 'sold-today' ? (
            <SalesTable items={todaySales} />
          ) : (
            <InventoryTable 
              items={filteredInventory} 
              onAddBatch={(medId) => setActiveBatchModalMedId(medId)}
            />
          )}
        </div>
      </div>

      {/* Right Sliding Notifications Drawer */}
      {isNotificationsOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end print:hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            onClick={() => setIsNotificationsOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
          ></div>
          
          {/* Drawer Body */}
          <div className="relative w-full max-w-md h-full bg-white/95 backdrop-blur-xl shadow-2xl border-l border-slate-200/50 flex flex-col z-10 transform animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-teal-500/10 text-teal-600 rounded-xl flex items-center justify-center shadow-inner">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight">Active Alerts</h2>
                  <p className="text-xs font-semibold text-slate-500">{totalAlerts} issues require attention</p>
                </div>
              </div>
              <button 
                onClick={() => setIsNotificationsOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
              {totalAlerts === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 border border-emerald-100 shadow-inner animate-pulse">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="font-bold text-slate-800 text-base">All Systems Nominal</p>
                  <p className="text-xs text-slate-400 text-center px-8 mt-1.5 leading-relaxed">No expired batches, short expiry alerts, or critical low-stock items detected.</p>
                </div>
              ) : (
                <NotificationsPanel 
                  batches={dynamicUrgentBatches} 
                  lowStockAlerts={dynamicLowStockAlerts} 
                />
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-slate-100">
              <button
                onClick={() => setIsNotificationsOpen(false)}
                className="w-full py-3.5 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white rounded-2xl font-bold text-sm shadow-lg shadow-slate-900/10 transition-all active:scale-[0.98]"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals & Sub-Screens */}
      <PointOfSale 
        isOpen={isPosOpen}
        onClose={() => setIsPosOpen(false)}
        inventory={inventory}
        posQuickCashNotes={posQuickCashNotes}
      />
      <AddMedicineModal 
        isOpen={isAddMedicineOpen} 
        onClose={() => {
          setIsAddMedicineOpen(false);
          setScannedBarcodeForNew(undefined);
        }} 
        existingCategories={categories}
        initialBarcode={scannedBarcodeForNew}
        existingMedicines={inventory}
        onSelectExistingMedicine={(medId) => {
          setIsAddMedicineOpen(false);
          setActiveBatchModalMedId(medId);
        }}
      />
      
      <AddBatchModal
        isOpen={!!activeBatchModalMedId}
        onClose={() => setActiveBatchModalMedId(null)}
        medicineId={activeBatchModalMedId || ''}
        medicineName={activeMedName}
        stripsPerBox={activeMedStripsPerBox}
      />

      <ScanModeModal
        isOpen={isScanModeOpen}
        onClose={() => setIsScanModeOpen(false)}
        onScan={handleScanBarcode}
      />
      <ImportDbModal
        isOpen={isImportDbOpen}
        onClose={() => setIsImportDbOpen(false)}
      />

      {/* Admin Login Authentication Modal */}
      {isAdminLoginOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[140] flex items-center justify-center p-4 print:hidden animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-sm rounded-[2.5rem] border border-white/50 shadow-2xl overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 text-center border-b border-slate-200/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10 relative">
              <button 
                onClick={() => setIsAdminLoginOpen(false)}
                className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 bg-white/50 hover:bg-white p-2 rounded-full transition-all border border-slate-200/50"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20 transform rotate-3">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Admin Authentication</h3>
              <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider mt-1">Enter credentials to access settings</p>
            </div>

            {/* Login Form */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                setAdminLoginError('');
                if (adminUsername === 'pixetechglobel' && adminPassword === 'meddemo4u') {
                  setIsAdminAuthenticated(true);
                  setIsAdminLoginOpen(false);
                  setIsAdminOpen(true);
                } else {
                  setAdminLoginError('Invalid username or password. Access denied.');
                }
              }}
              className="p-6 space-y-4"
            >
              {adminLoginError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in shake-x duration-300">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  {adminLoginError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
                <input 
                  type="text"
                  value={adminUsername}
                  onChange={e => setAdminUsername(e.target.value)}
                  placeholder="Enter admin username"
                  className="w-full text-slate-800 caret-slate-800 font-bold bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:outline-none transition-all"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <input 
                    type={showAdminPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full text-slate-800 caret-slate-800 font-bold bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:outline-none transition-all"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={!adminUsername || !adminPassword}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-500/20 transition-all transform hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {(
                  <>
                    <Lock className="w-4 h-4" />
                    Unlock Admin Panel
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Control Panel Modal */}
      {isAdminOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[130] flex items-center justify-center p-4 print:hidden animate-in fade-in duration-200">
          <div className="bg-white/90 backdrop-blur-xl w-full max-w-lg rounded-[2.5rem] border border-white/50 shadow-2xl overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 text-center border-b border-slate-200/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10 flex-shrink-0 relative">
              <button 
                onClick={() => { setIsAdminOpen(false); setIsAdminAuthenticated(false); }}
                className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 bg-white/50 hover:bg-white p-2 rounded-full transition-all border border-slate-200/50"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20 transform rotate-3">
                <Settings className="w-8 h-8 text-white animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Admin Settings & Controls</h3>
              <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mt-1">Override Statistics & Wipe System Data</p>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1 space-y-6">
              
              {/* SECTION 1: Overrides toggle */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">Enable Display Overrides</h4>
                    <p className="text-[11px] text-slate-400 font-medium">Override standard dashboard values</p>
                  </div>
                  <button
                    onClick={() => setIsOverrideEnabled(!isOverrideEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                      isOverrideEnabled ? 'bg-amber-500' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isOverrideEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {isOverrideEnabled && (
                  <div className="pt-2 border-t border-dashed border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-3 duration-200">
                    <div className="flex items-center justify-between p-2 bg-amber-50 rounded-xl border border-amber-100">
                      <span className="text-xs font-bold text-amber-800">Set All Stat Cards to Zero</span>
                      <button
                        onClick={() => {
                          const toZero = !overrideStatsToZero;
                          setOverrideStatsToZero(toZero);
                          if (toZero) {
                            setCustomStats({
                              uniqueMedicines: '0',
                              shortExpiry: '0',
                              lowStock: '0',
                              stockValue: '0',
                              dailySell: '0',
                              dailyProfit: '0'
                            });
                          }
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                          overrideStatsToZero ? 'bg-amber-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            overrideStatsToZero ? 'translate-x-4.5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {!overrideStatsToZero && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Unique Meds</label>
                          <input 
                            type="number"
                            placeholder="e.g. 15"
                            value={customStats.uniqueMedicines}
                            onChange={e => setCustomStats(prev => ({ ...prev, uniqueMedicines: e.target.value }))}
                            className="w-full text-slate-800 font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Expiry Alerts</label>
                          <input 
                            type="number"
                            placeholder="e.g. 2"
                            value={customStats.shortExpiry}
                            onChange={e => setCustomStats(prev => ({ ...prev, shortExpiry: e.target.value }))}
                            className="w-full text-slate-800 font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Low Stock</label>
                          <input 
                            type="number"
                            placeholder="e.g. 9"
                            value={customStats.lowStock}
                            onChange={e => setCustomStats(prev => ({ ...prev, lowStock: e.target.value }))}
                            className="w-full text-slate-800 font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Stock Value (Rs.)</label>
                          <input 
                            type="number"
                            placeholder="e.g. 200161"
                            value={customStats.stockValue}
                            onChange={e => setCustomStats(prev => ({ ...prev, stockValue: e.target.value }))}
                            className="w-full text-slate-800 font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Daily Sell (Rs.)</label>
                          <input 
                            type="number"
                            placeholder="e.g. 676.2"
                            value={customStats.dailySell}
                            onChange={e => setCustomStats(prev => ({ ...prev, dailySell: e.target.value }))}
                            className="w-full text-slate-800 font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Daily Profit (Rs.)</label>
                          <input 
                            type="number"
                            placeholder="e.g. 157.2"
                            value={customStats.dailyProfit}
                            onChange={e => setCustomStats(prev => ({ ...prev, dailyProfit: e.target.value }))}
                            className="w-full text-slate-800 font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 2: Custom Thresholds & POS Cash Settings */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
                <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                  Alert & POS Settings
                </h4>
                
                <div className="space-y-4 pt-1">
                  {/* Low stock slider */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Low Stock Threshold</label>
                      <span className="text-xs font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">{lowStockThreshold} box(es)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range"
                        min="1"
                        max="20"
                        value={lowStockThreshold}
                        onChange={e => updateLowStockThreshold(Number(e.target.value))}
                        className="w-full accent-amber-500 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Expiry slider */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Expiry Alert Period</label>
                      <span className="text-xs font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">{expiryAlertMonths} month(s)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range"
                        min="1"
                        max="24"
                        value={expiryAlertMonths}
                        onChange={e => updateExpiryAlertMonths(Number(e.target.value))}
                        className="w-full accent-amber-500 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Comma-separated POS Cash denominations */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">POS Quick Cash Notes</label>
                    <input 
                      type="text"
                      placeholder="e.g. 50, 100, 500, 1000, 5000"
                      value={posQuickCashNotes.join(', ')}
                      onChange={e => {
                        const val = e.target.value;
                        const notes = val.split(',').map(s => s.trim()).filter(s => s !== '' && !isNaN(Number(s)));
                        updatePosQuickCashNotes(notes);
                      }}
                      className="w-full text-slate-800 font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">Define comma-separated note values shown in POS Quick Cash buttons.</p>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Data Export Backup */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-3">
                <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  Database Export Backup
                </h4>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Export all currently registered medicines, configurations, category listings, and stock batch histories directly into a JSON backup file.
                </p>
                <button
                  onClick={handleExportDatabase}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5 transition-all transform hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                >
                  <Database className="w-4 h-4 text-blue-200" />
                  Export Database Backup (.JSON)
                </button>
              </div>

              {/* SECTION 4: Reset Data (Make actual database zero) */}
              <div className="bg-red-50/50 p-5 rounded-2xl border border-red-200/60 shadow-sm space-y-3.5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  <h4 className="font-extrabold text-red-950 text-sm">Dangerous Zone: Reset Database</h4>
                </div>
                <p className="text-[11px] text-red-800 font-semibold leading-relaxed">
                  Clicking the button below deletes all medicines, active stock batches, purchase rates, categories, and checkout sales transactions permanently. This action cannot be undone.
                </p>
                <button
                  onClick={async () => {
                    if (confirm('Are you absolutely sure you want to delete ALL medicines, batches, sales, and categories in the database? This cannot be undone.')) {
                      try {
                        await clearAllSystemData();
                        alert('System database wiped successfully. All values are now zero!');
                        setIsAdminOpen(false);
                        setIsAdminAuthenticated(false);
                      } catch (err: any) {
                        alert(err.message || 'Wipe failed.');
                      }
                    }
                  }}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs shadow-md shadow-red-500/10 flex items-center justify-center gap-1.5 transition-all transform hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear & Wipe All Database Data
                </button>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
              <button
                onClick={() => { setIsAdminOpen(false); setIsAdminAuthenticated(false); }}
                className="w-full py-3.5 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white rounded-2xl font-bold text-sm shadow-lg shadow-slate-900/10 transition-all active:scale-[0.98] cursor-pointer"
              >
                Close Control Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

