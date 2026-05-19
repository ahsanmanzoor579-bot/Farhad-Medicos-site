'use client';

import { useEffect, useState } from 'react';
import Dashboard from '@/components/dashboard/Dashboard';
import { getDashboardData, getInventoryData, getCategories, getTodaySalesDetails } from './actions';
import { localDb } from '@/lib/localDb';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [todaySales, setTodaySales] = useState<any[]>([]);
  const [urgentBatches, setUrgentBatches] = useState<any[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);

  // Function to refresh all data from localStorage
  const refreshData = async () => {
    try {
      const [dStats, dInventory, dCategories, dTodaySales] = await Promise.all([
        getDashboardData(),
        getInventoryData(),
        getCategories(),
        getTodaySalesDetails()
      ]);

      setStats(dStats);
      setInventory(dInventory);
      setCategories(dCategories);
      setTodaySales(dTodaySales);

      // Calculate Urgent Batches (Expiring in 6 months) and Low Stock Alerts locally in the browser
      const now = new Date();
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setDate(now.getDate() + 180);

      const allBatches = localDb.getBatches();
      const allMedicines = localDb.getMedicines();

      const urgent = allBatches
        .filter(b => {
          const expiry = new Date(b.expiryDate);
          return expiry <= sixMonthsFromNow;
        })
        .map(b => {
          const med = allMedicines.find(m => m.id === b.medicineId);
          return {
            id: b.id,
            medicineName: med?.name || 'Unknown',
            batchNumber: b.batchNumber,
            expiryDate: new Date(b.expiryDate)
          };
        });

      setUrgentBatches(urgent);

      // Low stock alerts
      const stockMap = new Map<string, number>();
      for (const b of allBatches) {
        stockMap.set(b.medicineId, (stockMap.get(b.medicineId) || 0) + b.quantity);
      }

      const lowStock = allMedicines
        .filter(med => {
          const stock = stockMap.get(med.id) || 0;
          return stock < 2; // threshold of 2 units/strips
        })
        .map((med, index) => ({
          id: `ls-${index}`,
          medicineName: med.name,
          quantity: stockMap.get(med.id) || 0
        }));

      setLowStockAlerts(lowStock);
    } catch (err) {
      console.error('Failed to load local database', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();

    // Set up an event listener to refresh state whenever actions occur (like modals closing)
    const handleStorageChange = () => {
      refreshData();
    };

    window.addEventListener('storage', handleStorageChange);
    // Custom event to trigger update on the same tab
    window.addEventListener('local-db-update', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-db-update', handleStorageChange);
    };
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400 font-medium">Loading local medicine database...</p>
        </div>
      </div>
    );
  }

  return (
    <main>
      <Dashboard 
        stats={stats} 
        inventory={inventory} 
        categories={categories}
        urgentBatches={urgentBatches}
        lowStockAlerts={lowStockAlerts}
        todaySales={todaySales}
      />
    </main>
  );
}
