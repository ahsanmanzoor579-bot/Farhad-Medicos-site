import Dashboard from '@/components/Dashboard';
import { getDashboardData, getInventoryData, getCategories, getTodaySalesDetails } from './actions';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [stats, inventory, categories, todaySales] = await Promise.all([
    getDashboardData(),
    getInventoryData(),
    getCategories(),
    getTodaySalesDetails()
  ]);

  // Fetch batches for urgent notifications
  const now = new Date();
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setDate(now.getDate() + 180);

  const urgentBatchesData = await prisma.batch.findMany({
    where: {
      expiryDate: {
        lte: sixMonthsFromNow
      }
    },
    include: {
      medicine: true
    }
  });

  const urgentBatches = urgentBatchesData.map(b => ({
    id: b.id,
    medicineName: b.medicine.name,
    batchNumber: b.batchNumber,
    expiryDate: b.expiryDate
  }));

  // Calculate low stock alerts (quantity < 2)
  const allBatches = await prisma.batch.findMany({ include: { medicine: true } });
  const stockMap = new Map();
  for(const b of allBatches) {
      if(!stockMap.has(b.medicineId)) {
          stockMap.set(b.medicineId, { name: b.medicine.name, quantity: 0 });
      }
      stockMap.get(b.medicineId).quantity += b.quantity;
  }
  
  const lowStockAlerts = Array.from(stockMap.values())
    .filter(v => v.quantity < 2)
    .map((v, i) => ({ id: `ls-${i}`, medicineName: v.name, quantity: v.quantity }));

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
