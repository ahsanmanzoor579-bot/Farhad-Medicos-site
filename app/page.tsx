import Dashboard from '@/components/dashboard/Dashboard';
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

  let urgentBatches: { id: string; medicineName: string; batchNumber: string; expiryDate: Date }[] = [];
  let lowStockAlerts: { id: string; medicineName: string; quantity: number }[] = [];

  try {
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

    urgentBatches = urgentBatchesData.map(b => ({
      id: b.id,
      medicineName: b.medicine.name,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate
    }));

    const allBatches = await prisma.batch.findMany({ include: { medicine: true } });
    const stockMap = new Map<string, { name: string; quantity: number }>();
    for (const b of allBatches) {
      if (!stockMap.has(b.medicineId)) {
        stockMap.set(b.medicineId, { name: b.medicine.name, quantity: 0 });
      }
      const record = stockMap.get(b.medicineId);
      if (record) {
        record.quantity += b.quantity;
      }
    }

    lowStockAlerts = Array.from(stockMap.values())
      .filter(v => v.quantity < 2)
      .map((v, i) => ({ id: `ls-${i}`, medicineName: v.name, quantity: v.quantity }));
  } catch {
    urgentBatches = [];
    lowStockAlerts = [];
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
