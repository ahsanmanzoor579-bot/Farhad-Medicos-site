import { Package, Coins, AlertTriangle, PackageMinus, TrendingUp, Wallet } from 'lucide-react';

type StatsBannerProps = {
  totalUniqueMedicines: number;
  totalStockValue: number;
  shortExpiryCount: number;
  lowStockCount: number;
  dailySell: number;
  dailyProfit: number;
  filterMode: string;
  onFilterChange: (mode: string) => void;
};

export default function StatsBanner({
  totalUniqueMedicines,
  totalStockValue,
  shortExpiryCount,
  lowStockCount,
  dailySell,
  dailyProfit,
  filterMode,
  onFilterChange
}: StatsBannerProps) {
  
  const getCardClass = (mode: string, baseGradient: string, shadowColor: string) => {
    const isActive = filterMode === mode;
    return `relative overflow-hidden ${baseGradient} p-6 rounded-3xl shadow-lg ${shadowColor} text-white transform transition-all duration-300 cursor-pointer ${
      isActive ? 'ring-4 ring-white ring-offset-2 scale-105 shadow-2xl' : 'hover:-translate-y-1 hover:shadow-xl opacity-90 hover:opacity-100'
    }`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
      
      {/* ROW 1: Inventory Stats */}
      <div 
        className={getCardClass('all', 'bg-gradient-to-br from-blue-500 to-indigo-600', 'shadow-blue-500/20')}
        onClick={() => onFilterChange('all')}
      >
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10 pointer-events-none blur-2xl"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-blue-100 font-medium">Unique Medicines</p>
            <h3 className="text-3xl font-extrabold mt-1 tracking-tight">{totalUniqueMedicines}</h3>
          </div>
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
            <Package className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>
      
      <div 
        className={getCardClass('short-expiry', 'bg-gradient-to-br from-amber-400 to-orange-500', 'shadow-orange-500/20')}
        onClick={() => onFilterChange('short-expiry')}
      >
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10 pointer-events-none blur-2xl"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-orange-50 font-medium">Short Expiry Alerts</p>
            <h3 className="text-3xl font-extrabold mt-1 tracking-tight">{shortExpiryCount}</h3>
          </div>
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      <div 
        className={getCardClass('low-stock', 'bg-gradient-to-br from-rose-400 to-red-500', 'shadow-red-500/20')}
        onClick={() => onFilterChange('low-stock')}
      >
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10 pointer-events-none blur-2xl"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-red-50 font-medium">Low Stock Alerts</p>
            <h3 className="text-3xl font-extrabold mt-1 tracking-tight">{lowStockCount}</h3>
          </div>
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
            <PackageMinus className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      {/* ROW 2: Financial Stats */}
      <div 
        className={getCardClass('total-stock', 'bg-gradient-to-br from-slate-600 to-slate-800', 'shadow-slate-500/20')}
        onClick={() => onFilterChange('total-stock')}
      >
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10 pointer-events-none blur-2xl"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-slate-300 font-medium">Total Stock Value</p>
            <h3 className="text-3xl font-extrabold mt-1 tracking-tight">Rs. {totalStockValue.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
            <Coins className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      <div 
        className={getCardClass('sold-today', 'bg-gradient-to-br from-emerald-400 to-teal-500', 'shadow-teal-500/20')}
        onClick={() => onFilterChange('sold-today')}
      >
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10 pointer-events-none blur-2xl"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-emerald-50 font-medium">Daily Sell (Today)</p>
            <h3 className="text-3xl font-extrabold mt-1 tracking-tight">Rs. {dailySell.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
            <Wallet className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      <div 
        className={getCardClass('sold-today', 'bg-gradient-to-br from-purple-500 to-fuchsia-600', 'shadow-purple-500/20')}
        onClick={() => onFilterChange('sold-today')}
      >
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10 pointer-events-none blur-2xl"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-purple-100 font-medium">Daily Profit (Today)</p>
            <h3 className="text-3xl font-extrabold mt-1 tracking-tight">Rs. {dailyProfit.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

    </div>
  );
}
