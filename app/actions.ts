// Client-side Local Storage Database Actions for Farhad Medicos
import { localDb } from '@/lib/localDb';

export async function getDashboardData() {
  try {
    const medicines = localDb.getMedicines();
    const batches = localDb.getBatches();
    const sales = localDb.getSales();

    const totalMedicines = medicines.length;

    let totalStockValue = 0;
    let shortExpiryCount = 0;
    let expiredCount = 0;

    const now = new Date();
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setDate(now.getDate() + 180);

    const medicineStockMap: Record<string, number> = {};

    for (const batch of batches) {
      const med = medicines.find(m => m.id === batch.medicineId);
      if (!med) continue;

      const stripsPerBox = med.stripsPerBox || 1;
      totalStockValue += batch.quantity * (batch.purchasePrice / stripsPerBox);

      const expiry = new Date(batch.expiryDate);
      if (expiry <= now) {
        expiredCount++;
      } else if (expiry <= sixMonthsFromNow) {
        shortExpiryCount++;
      }

      if (!medicineStockMap[batch.medicineId]) {
        medicineStockMap[batch.medicineId] = 0;
      }
      medicineStockMap[batch.medicineId] += batch.quantity;
    }

    let lowStockCount = 0;
    for (const med of medicines) {
      const stockUnits = medicineStockMap[med.id] || 0;
      const thresholdUnits = (med.stripsPerBox || 1) * (med.minStockLevel || 0);
      if (stockUnits < Math.max(3, thresholdUnits)) {
        lowStockCount++;
      }
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let dailySell = 0;
    let dailyProfit = 0;

    for (const sale of sales) {
      const saleDate = new Date(sale.createdAt);
      if (saleDate >= startOfDay) {
        dailySell += sale.total;
        
        const items = Object.values(sale.items || {});
        for (const item of items) {
          const med = medicines.find(m => m.id === item.medicineId);
          const batch = batches.find(b => b.id === item.batchId);
          if (!med || !batch) continue;

          const stripsPerBox = med.stripsPerBox || 1;
          const profit = (item.price - (batch.purchasePrice / stripsPerBox)) * item.quantity;
          dailyProfit += profit;
        }
      }
    }

    return {
      totalUniqueMedicines: totalMedicines,
      totalStockValue,
      expiredCount,
      shortExpiryCount,
      lowStockCount,
      dailySell,
      dailyProfit
    };
  } catch (error) {
    console.error('Error in getDashboardData:', error);
    return {
      totalUniqueMedicines: 0,
      totalStockValue: 0,
      expiredCount: 0,
      shortExpiryCount: 0,
      lowStockCount: 0,
      dailySell: 0,
      dailyProfit: 0
    };
  }
}

export async function getTodaySalesDetails() {
  try {
    const sales = localDb.getSales();
    const medicines = localDb.getMedicines();
    const batches = localDb.getBatches();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaySales = sales
      .filter(sale => new Date(sale.createdAt) >= startOfDay)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const salesItemsList: any[] = [];

    for (const sale of todaySales) {
      const items = Object.values(sale.items || {});
      for (const item of items) {
        const med = medicines.find(m => m.id === item.medicineId);
        const batch = batches.find(b => b.id === item.batchId);
        if (!med || !batch) continue;

        const stripsPerBox = med.stripsPerBox || 1;
        const boxes = Math.floor(item.quantity / stripsPerBox);
        const strips = item.quantity % stripsPerBox;
        const displayQuantity = boxes > 0 ? `${boxes} box(es)${strips > 0 ? ' + ' + strips + ' strip(s)' : ''}` : `${strips} strip(s)`;
        const stripUnitPrice = item.price;
        const boxUnitPrice = stripUnitPrice * stripsPerBox;

        const purchasePricePerStrip = batch.purchasePrice / stripsPerBox;
        salesItemsList.push({
          id: item.id,
          saleId: sale.id,
          time: new Date(sale.createdAt),
          medicineName: med.name,
          genericFormula: med.genericFormula,
          batchNumber: batch.batchNumber,
          quantity: item.quantity,
          unit: item.unit,
          displayQuantity,
          unitPrice: item.unit === 'BOX' ? boxUnitPrice : stripUnitPrice,
          salePrice: stripUnitPrice,
          purchasePrice: purchasePricePerStrip,
          revenue: stripUnitPrice * item.quantity,
          profit: (stripUnitPrice - purchasePricePerStrip) * item.quantity
        });
      }
    }

    return salesItemsList;
  } catch (error) {
    console.error('Error in getTodaySalesDetails:', error);
    return [];
  }
}

export async function getInventoryData() {
  try {
    const medicines = localDb.getMedicines();
    const categories = localDb.getCategories();
    const batches = localDb.getBatches();

    return medicines.map(med => {
      const category = categories.find(c => c.id === med.categoryId) || { name: 'General' };
      const medBatches = batches
        .filter(b => b.medicineId === med.id)
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

      let totalStock = 0;
      let nearestExpiry: string | null = null;
      let avgPurchasePrice = 0;
      let avgRetailPrice = 0;

      if (medBatches.length > 0) {
        nearestExpiry = medBatches[0].expiryDate;
        totalStock = medBatches.reduce((sum, b) => sum + b.quantity, 0);

        const latestBatch = medBatches[medBatches.length - 1];
        avgPurchasePrice = latestBatch.purchasePrice;
        avgRetailPrice = latestBatch.retailPrice;
      }

      let profitMargin = 0;
      if (avgRetailPrice > 0) {
        profitMargin = ((avgRetailPrice - avgPurchasePrice) / avgRetailPrice) * 100;
      }

      const stripsPerBox = med.stripsPerBox || 1;
      const boxes = Math.floor(totalStock / stripsPerBox);
      const strips = totalStock % stripsPerBox;
      const boxPurchasePrice = avgPurchasePrice;
      const boxRetailPrice = avgRetailPrice;

      return {
        id: med.id,
        name: med.name,
        genericFormula: med.genericFormula,
        categoryName: category.name,
        minStockLevel: med.minStockLevel,
        rackLocation: med.rackLocation || null,
        totalStockUnits: totalStock,
        displayStock: { boxes, strips },
        stripsPerBox,
        defaultSellingUnit: med.defaultSellingUnit,
        nearestExpiry: nearestExpiry ? new Date(nearestExpiry) : null,
        purchasePrice: avgPurchasePrice / stripsPerBox,
        retailPrice: avgRetailPrice / stripsPerBox,
        boxPurchasePrice,
        boxRetailPrice,
        profitMargin,
        batches: medBatches.map(b => ({
          ...b,
          expiryDate: new Date(b.expiryDate)
        }))
      };
    });
  } catch (error) {
    console.error('Error in getInventoryData:', error);
    return [];
  }
}

export async function getCategories() {
  try {
    return localDb.getCategories().sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in getCategories:', error);
    return [];
  }
}

function triggerUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('local-db-update'));
  }
}

export async function addMedicineAndCategory(data: {
  medicineName: string;
  genericFormula: string;
  categoryName: string;
  minStockLevel: number;
  rackLocation?: string;
  barcode?: string;
  stripsPerBox?: number;
  defaultSellingUnit?: 'BOX' | 'STRIP';
  initialBatch?: {
    batchNumber: string;
    expiryDate: string;
    purchasePrice: number;
    retailPrice: number;
    quantity: number;
    unit?: 'BOX' | 'STRIP';
  };
}) {
  const med = localDb.addMedicine({
    name: data.medicineName,
    genericFormula: data.genericFormula,
    categoryName: data.categoryName,
    minStockLevel: data.minStockLevel,
    rackLocation: data.rackLocation,
    barcode: data.barcode,
    stripsPerBox: data.stripsPerBox,
    defaultSellingUnit: data.defaultSellingUnit
  });

  if (data.initialBatch) {
    const b = data.initialBatch;
    const unit = b.unit || 'BOX';
    const strips = data.stripsPerBox || 1;
    const quantityInStrips = unit === 'BOX' ? b.quantity * strips : b.quantity;
    
    localDb.addBatch({
      medicineId: med.id,
      batchNumber: b.batchNumber,
      expiryDate: new Date(b.expiryDate).toISOString(),
      purchasePrice: b.purchasePrice,
      retailPrice: b.retailPrice,
      quantity: quantityInStrips
    });
  }
  
  triggerUpdate();
}

export async function addBatch(data: {
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
  purchasePrice: number;
  retailPrice: number;
  quantity: number;
  unit?: 'BOX' | 'STRIP';
}) {
  const medicines = localDb.getMedicines();
  const med = medicines.find(m => m.id === data.medicineId);
  if (!med) throw new Error('Medicine not found.');

  const stripsPerBox = med.stripsPerBox || 1;
  const unit = data.unit || 'BOX';
  const quantity = unit === 'BOX' ? data.quantity * stripsPerBox : data.quantity;

  localDb.addBatch({
    medicineId: data.medicineId,
    batchNumber: data.batchNumber,
    expiryDate: new Date(data.expiryDate).toISOString(),
    purchasePrice: data.purchasePrice,
    retailPrice: data.retailPrice,
    quantity
  });

  triggerUpdate();
}

export async function checkoutSale(items: Array<{
  medicineId: string;
  batchId: string;
  quantity: number;
  unit: 'BOX' | 'STRIP';
  price: number;
}>) {
  localDb.checkoutSale(items);
  triggerUpdate();
}

export async function deleteMedicine(id: string) {
  localDb.deleteMedicine(id);
  triggerUpdate();
}

export async function deleteBatch(id: string) {
  localDb.deleteBatch(id);
  triggerUpdate();
}

export async function importPakistaniMedicines() {
  try {
    const categories = [
      'Painkillers', 'Antibiotics', 'Gastrointestinal', 'Allergy', 
      'Cough & Cold', 'Diabetes', 'Cardiology', 'Neurology/Psychiatry', 
      'Pulmonology', 'Dermatology', 'Vitamins'
    ];

    for (const catName of categories) {
      localDb.addCategory(catName);
    }

    const medicines = [
      { name: 'Ponstan 250mg', generic: 'Mefenamic Acid', cat: 'Painkillers', barcode: '8961122000124' },
      { name: 'Voltral 50mg', generic: 'Diclofenac Sodium', cat: 'Painkillers', barcode: '8961122000125' },
      { name: 'Caflam 50mg', generic: 'Diclofenac Potassium', cat: 'Painkillers', barcode: '8961122000126' },
      { name: 'Augmentin 625mg', generic: 'Amoxicillin + Clavulanate', cat: 'Antibiotics', barcode: '8961122000025' },
      { name: 'Cravit 500mg', generic: 'Levofloxacin', cat: 'Antibiotics', barcode: '8961122000027' },
      { name: 'Flagyl 400mg', generic: 'Metronidazole', cat: 'Gastrointestinal', barcode: '8961122000049' },
      { name: 'Risek 20mg', generic: 'Omeprazole', cat: 'Gastrointestinal', barcode: '8961122000071' },
      { name: 'Nexum 40mg', generic: 'Esomeprazole', cat: 'Gastrointestinal', barcode: '8961122000072' },
      { name: 'Arinac', generic: 'Ibuprofen + Pseudoephedrine', cat: 'Allergy', barcode: '8961122000056' },
      { name: 'Rigix', generic: 'Cetirizine', cat: 'Allergy', barcode: '8961122000063' },
      { name: 'Surbex Z', generic: 'Multivitamin', cat: 'Vitamins', barcode: '8961122000087' }
    ];

    const currentMeds = localDb.getMedicines();
    const currentBatches = localDb.getBatches();

    for (const med of medicines) {
      let dbMed = currentMeds.find(m => m.barcode === med.barcode);
      if (!dbMed) {
        dbMed = localDb.addMedicine({
          name: med.name,
          genericFormula: med.generic,
          categoryName: med.cat,
          minStockLevel: 10,
          barcode: med.barcode,
          stripsPerBox: 10,
          defaultSellingUnit: 'STRIP'
        });
      }

      const medBatches = currentBatches.filter(b => b.medicineId === dbMed!.id);
      if (medBatches.length === 0) {
        localDb.addBatch({
          medicineId: dbMed!.id,
          batchNumber: `B-${med.barcode.slice(-4)}`,
          expiryDate: new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000).toISOString(),
          purchasePrice: 200,
          retailPrice: 250,
          quantity: 100
        });
      }
    }

    triggerUpdate();
  } catch (error) {
    console.error('Error in importPakistaniMedicines:', error);
  }
}
