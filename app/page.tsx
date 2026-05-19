import Dashboard from '@/components/dashboard/Dashboard';
import { getDashboardData, getInventoryData, getCategories, getTodaySalesDetails, getAlertsData } from './actions';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [stats, inventory, categories, todaySales, alerts] = await Promise.all([
    getDashboardData(),
    getInventoryData(),
    getCategories(),
    getTodaySalesDetails(),
    getAlertsData()
  ]);

  return (
    <main>
      <Dashboard 
        stats={stats} 
        inventory={inventory} 
        categories={categories}
        urgentBatches={alerts.urgentBatches}
        lowStockAlerts={alerts.lowStockAlerts}
        todaySales={todaySales}
      />
    </main>
  );
}
