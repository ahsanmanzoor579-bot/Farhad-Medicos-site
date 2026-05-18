'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StatsBanner from './StatsBanner';
import NotificationsPanel from './NotificationsPanel';
import InventoryTable from './InventoryTable';
import SalesTable from './SalesTable';
import AddMedicineModal from './modals/AddMedicineModal';
import AddBatchModal from './modals/AddBatchModal';
import ScanModeModal from './modals/ScanModeModal';
import PointOfSale from './PointOfSale';
import { PlusCircle, ShoppingBag, Database, LogOut, Activity, ScanBarcode } from 'lucide-react';
import { importPakistaniMedicines } from '@/app/actions';

type DashboardProps = {
  stats: any;
  inventory: any[];
  categories: any[];
  urgentBatches: any[];
  lowStockAlerts: { id: string; medicineName: string; quantity: number }[];
  todaySales: any[];
};

export default function Dashboard({ stats, inventory, categories, urgentBatches, lowStockAlerts, todaySales }: DashboardProps) {
  const [isAddMedicineOpen, setIsAddMedicineOpen] = useState(false);
  const [isPosOpen, setIsPosOpen] = useState(false);
  const [isScanModeOpen, setIsScanModeOpen] = useState(false);
  const [scannedBarcodeForNew, setScannedBarcodeForNew] = useState<string | undefined>(undefined);
  const [activeBatchModalMedId, setActiveBatchModalMedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [filterMode, setFilterMode] = useState<string>('all');
  const router = useRouter();

  const activeMedName = activeBatchModalMedId 
    ? inventory.find(m => m.id === activeBatchModalMedId)?.name || ''
    : '';
  const activeMedStripsPerBox = activeBatchModalMedId
    ? inventory.find(m => m.id === activeBatchModalMedId)?.stripsPerBox || 1
    : 1;

  const handleImport = async () => {
    setImporting(true);
    try {
      await importPakistaniMedicines();
      alert('Medicines imported successfully! You can now open the POS Checkout to see them.');
    } catch (e) {
      console.error(e);
      alert('Import failed. Please check the logs.');
    } finally {
      setImporting(false);
    }
  };

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
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setDate(now.getDate() + 180);
      return new Date(item.nearestExpiry) <= sixMonthsFromNow;
    }
    
    if (filterMode === 'low-stock') {
      const totalUnits = item.totalStockUnits || 0;
      const stripsPerBox = item.stripsPerBox || 1;
      // interpret min stock as boxes -> units
      const thresholdUnits = (item.minStockLevel || 0) * stripsPerBox;
      return totalUnits > 0 && totalUnits <= Math.max(3, thresholdUnits);
    }
    
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-blue-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8 relative z-10 print:hidden">
        
        {/* Colorful Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/60 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-tr from-teal-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-md">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-teal-700 to-blue-800 tracking-tight">
                Farhad Medicos
              </h1>
              <p className="text-blue-600/80 font-medium mt-0.5">Premium Inventory Management</p>
            </div>
          </div>
          
          <div className="flex gap-3 flex-wrap">
            <button 
              onClick={handleImport}
              disabled={importing}
              className="inline-flex items-center justify-center px-4 py-2.5 bg-white text-teal-700 font-bold rounded-2xl hover:bg-teal-50 transition-all shadow-sm border border-teal-100"
            >
              <Database className="w-5 h-5 mr-2" />
              {importing ? 'Importing...' : 'Import DB'}
            </button>
            <button 
              onClick={() => {
                setScannedBarcodeForNew(undefined);
                setIsAddMedicineOpen(true);
              }}
              className="inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold rounded-2xl hover:from-slate-700 hover:to-slate-800 transition-all shadow-md"
            >
              <PlusCircle className="w-5 h-5 mr-2" />
              Add Medicine
            </button>
            <button 
              onClick={() => setIsScanModeOpen(true)}
              className="inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 font-bold rounded-2xl hover:from-blue-200 hover:to-blue-300 transition-all shadow-md border border-blue-300 transform hover:-translate-y-0.5"
            >
              <ScanBarcode className="w-5 h-5 mr-2" />
              Scan to Add
            </button>
            <button 
              onClick={() => setIsPosOpen(true)}
              className="inline-flex items-center justify-center px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-md transform hover:-translate-y-0.5"
            >
              <ShoppingBag className="w-5 h-5 mr-2" />
              POS Checkout
            </button>
            <button 
              onClick={handleLogout}
              className="inline-flex items-center justify-center px-4 py-2.5 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-all shadow-sm border border-red-100"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Banner */}
        <StatsBanner 
          totalUniqueMedicines={stats.totalUniqueMedicines}
          totalStockValue={stats.totalStockValue}
          shortExpiryCount={stats.shortExpiryCount}
          lowStockCount={stats.lowStockCount}
          dailySell={stats.dailySell}
          dailyProfit={stats.dailyProfit}
          filterMode={filterMode}
          onFilterChange={setFilterMode}
        />

        {/* Dynamic Table Area */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/50 shadow-sm p-2">
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

      {/* Modals & Sub-Screens */}
      <PointOfSale 
        isOpen={isPosOpen}
        onClose={() => setIsPosOpen(false)}
        inventory={inventory}
      />
      <AddMedicineModal 
        isOpen={isAddMedicineOpen} 
        onClose={() => {
          setIsAddMedicineOpen(false);
          setScannedBarcodeForNew(undefined);
        }} 
        existingCategories={categories}
        initialBarcode={scannedBarcodeForNew}
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
    </div>
  );
}
