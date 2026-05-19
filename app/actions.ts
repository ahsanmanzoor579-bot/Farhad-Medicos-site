'use server';

import { db } from '@/lib/firebase';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

const emptyStats = {
  totalUniqueMedicines: 0,
  totalStockValue: 0,
  expiredCount: 0,
  shortExpiryCount: 0,
  lowStockCount: 0,
  dailySell: 0,
  dailyProfit: 0,
};

function demoCategories() {
  return [
    { id: 'demo-cat-1', name: 'General' },
  ];
}

function demoInventory() {
  return [
    {
      id: 'demo-med-1',
      name: 'Demo Medicine',
      genericFormula: 'Sample Formula',
      categoryName: 'General',
      minStockLevel: 10,
      rackLocation: 'A1',
      totalStockUnits: 0,
      displayStock: { boxes: 0, strips: 0 },
      stripsPerBox: 1,
      defaultSellingUnit: 'BOX',
      nearestExpiry: null,
      purchasePrice: 0,
      retailPrice: 0,
      boxPurchasePrice: 0,
      boxRetailPrice: 0,
      profitMargin: 0,
      batches: [],
    },
  ];
}

export async function getDashboardData() {
  try {
    const [medicinesSnap, batchesSnap, salesSnap] = await Promise.all([
      db.ref('medicines').once('value'),
      db.ref('batches').once('value'),
      db.ref('sales').once('value')
    ]);

    const medicinesMap = medicinesSnap.val() || {};
    const batchesMap = batchesSnap.val() || {};
    const salesMap = salesSnap.val() || {};

    const totalMedicines = Object.keys(medicinesMap).length;

    let totalStockValue = 0;
    let shortExpiryCount = 0;
    let expiredCount = 0;

    const now = new Date();
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setDate(now.getDate() + 180);

    const medicineStockMap: Record<string, number> = {};

    const batches = Object.values(batchesMap) as any[];
    for (const batch of batches) {
      const med = medicinesMap[batch.medicineId];
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
    const allMedicines = Object.values(medicinesMap) as any[];
    for (const med of allMedicines) {
      const stockUnits = medicineStockMap[med.id] || 0;
      const thresholdUnits = (med.stripsPerBox || 1) * (med.minStockLevel || 0);
      if (stockUnits < Math.max(3, thresholdUnits)) {
        lowStockCount++;
      }
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const sales = Object.values(salesMap) as any[];
    let dailySell = 0;
    let dailyProfit = 0;

    for (const sale of sales) {
      const saleDate = new Date(sale.createdAt);
      if (saleDate >= startOfDay) {
        dailySell += sale.total;
        
        const items = sale.items ? Object.values(sale.items) : [];
        for (const item of items as any[]) {
          const med = medicinesMap[item.medicineId];
          const batch = batchesMap[item.batchId];
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
    return emptyStats;
  }
}

export async function getTodaySalesDetails() {
  try {
    const [salesSnap, medicinesSnap, batchesSnap] = await Promise.all([
      db.ref('sales').once('value'),
      db.ref('medicines').once('value'),
      db.ref('batches').once('value')
    ]);

    const salesMap = salesSnap.val() || {};
    const medicinesMap = medicinesSnap.val() || {};
    const batchesMap = batchesSnap.val() || {};

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaySales = (Object.values(salesMap) as any[])
      .filter((sale: any) => new Date(sale.createdAt) >= startOfDay)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const salesItemsList: any[] = [];

    for (const sale of todaySales) {
      const items = sale.items ? Object.values(sale.items) : [];
      for (const item of items as any[]) {
        const med = medicinesMap[item.medicineId];
        const batch = batchesMap[item.batchId];
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
    const [medicinesSnap, categoriesSnap, batchesSnap] = await Promise.all([
      db.ref('medicines').once('value'),
      db.ref('categories').once('value'),
      db.ref('batches').once('value')
    ]);

    const medicinesMap = medicinesSnap.val() || {};
    const categoriesMap = categoriesSnap.val() || {};
    const batchesMap = batchesSnap.val() || {};

    const medicines = Object.values(medicinesMap) as any[];
    const batches = Object.values(batchesMap) as any[];

    return medicines.map((med: any) => {
      const category = categoriesMap[med.categoryId] || { name: 'General' };
      const medBatches = batches
        .filter((b: any) => b.medicineId === med.id)
        .sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

      let totalStock = 0;
      let nearestExpiry: string | null = null;
      let avgPurchasePrice = 0;
      let avgRetailPrice = 0;

      if (medBatches.length > 0) {
        nearestExpiry = medBatches[0].expiryDate;
        totalStock = medBatches.reduce((sum: number, b: any) => sum + b.quantity, 0);

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
        rackLocation: med.rackLocation,
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
    return demoInventory();
  }
}

export async function getCategories() {
  try {
    const snapshot = await db.ref('categories').once('value');
    const categoriesMap = snapshot.val() || {};
    return Object.values(categoriesMap).sort((a: any, b: any) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in getCategories:', error);
    return demoCategories();
  }
}

export async function getMedicinesList() {
  try {
    const snapshot = await db.ref('medicines').once('value');
    const medicinesMap = snapshot.val() || {};
    return Object.values(medicinesMap).sort((a: any, b: any) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in getMedicinesList:', error);
    return [];
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
  try {
    const categoriesSnap = await db.ref('categories').once('value');
    const categoriesMap = categoriesSnap.val() || {};
    let category = (Object.values(categoriesMap) as any[]).find((c: any) => c.name === data.categoryName) as any;

    const updates: Record<string, any> = {};
    let categoryId = category?.id;

    if (!category) {
      categoryId = randomUUID();
      category = { id: categoryId, name: data.categoryName };
      updates[`categories/${categoryId}`] = category;
    }

    const strips = typeof data.stripsPerBox === 'number' ? data.stripsPerBox : 1;
    if (!Number.isInteger(strips) || strips < 1) {
      throw new Error('Invalid value for stripsPerBox. It must be a whole number >= 1.');
    }

    const medicineId = randomUUID();
    const medicine = {
      id: medicineId,
      name: data.medicineName,
      genericFormula: data.genericFormula,
      categoryId: categoryId,
      minStockLevel: data.minStockLevel,
      rackLocation: data.rackLocation || null,
      barcode: data.barcode || null,
      stripsPerBox: strips,
      defaultSellingUnit: data.defaultSellingUnit || 'BOX',
      createdAt: new Date().toISOString()
    };
    updates[`medicines/${medicineId}`] = medicine;

    if (data.initialBatch) {
      const b = data.initialBatch;
      const unit = b.unit || 'BOX';
      const quantityInStrips = unit === 'BOX' ? b.quantity * strips : b.quantity;
      const batchId = randomUUID();
      const batch = {
        id: batchId,
        medicineId: medicineId,
        batchNumber: b.batchNumber,
        expiryDate: new Date(b.expiryDate).toISOString(),
        purchasePrice: b.purchasePrice,
        retailPrice: b.retailPrice,
        quantity: quantityInStrips,
        createdAt: new Date().toISOString()
      };
      updates[`batches/${batchId}`] = batch;
    }

    await db.ref().update(updates);
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error in addMedicineAndCategory action:', error);
    return { success: false, error: error?.message || 'Failed to add medicine due to a server error.' };
  }
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
  const medicineSnap = await db.ref(`medicines/${data.medicineId}`).once('value');
  const medicine = medicineSnap.val();
  if (!medicine) {
    throw new Error(`Invalid medicine for batch ${data.medicineId}`);
  }

  const stripsPerBox = medicine.stripsPerBox || 1;
  const unit = data.unit || 'BOX';
  const quantity = unit === 'BOX' ? data.quantity * stripsPerBox : data.quantity;
  const purchasePrice = data.purchasePrice;
  const retailPrice = data.retailPrice;

  const batchId = randomUUID();
  const batch = {
    id: batchId,
    medicineId: data.medicineId,
    batchNumber: data.batchNumber,
    expiryDate: new Date(data.expiryDate).toISOString(),
    purchasePrice,
    retailPrice,
    quantity,
    createdAt: new Date().toISOString()
  };

  await db.ref(`batches/${batchId}`).set(batch);
  revalidatePath('/');
}

export async function checkoutSale(cart: { medicineId: string; batchId: string; quantity: number; price: number; unit?: 'BOX' | 'STRIP' }[]) {
  let txError: any = null;
  try {
    await db.ref().transaction((currentData) => {
      if (currentData === null) {
        return currentData;
      }
      
      if (!currentData.batches) currentData.batches = {};
      if (!currentData.medicines) currentData.medicines = {};
      if (!currentData.sales) currentData.sales = {};
      
      const total = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const saleId = randomUUID();
      
      const saleItems: Record<string, any> = {};
      
      for (const item of cart) {
        const batch = currentData.batches[item.batchId];
        const medicine = currentData.medicines[item.medicineId];
        if (!batch || !medicine) {
          txError = new Error(`Invalid batch or medicine for batch ${item.batchId}`);
          return;
        }

        const unitsToDeduct = item.quantity;

        if (batch.quantity < unitsToDeduct) {
          txError = new Error(`Insufficient stock for batch ${item.batchId}. Available: ${batch.quantity}, Required: ${unitsToDeduct}`);
          return;
        }

        batch.quantity -= unitsToDeduct;
        
        const itemId = randomUUID();
        saleItems[itemId] = {
          id: itemId,
          saleId,
          medicineId: item.medicineId,
          batchId: item.batchId,
          quantity: item.quantity,
          unit: item.unit || 'STRIP',
          price: item.price
        };
      }

      currentData.sales[saleId] = {
        id: saleId,
        total,
        createdAt: new Date().toISOString(),
        items: saleItems
      };

      return currentData;
    });
    
    if (txError) {
      throw txError;
    }
  } catch (error: any) {
    console.error('Error in checkoutSale:', error);
    throw new Error(error.message || 'Checkout transaction failed');
  }

  revalidatePath('/');
}

export async function importPakistaniMedicines() {
  try {
    const categories = [
      'Painkillers', 'Antibiotics', 'Allergy', 'Gastrointestinal', 'Vitamins', 'Cough & Cold', 'Diabetes',
      'Cardiology', 'Neurology/Psychiatry', 'Pulmonology', 'Dermatology'
    ];

    const categoriesSnap = await db.ref('categories').once('value');
    const categoriesMap = categoriesSnap.val() || {};
    
    const updates: Record<string, any> = {};
    const createdCategories: Record<string, string> = {};

    for (const catName of categories) {
      let cat = (Object.values(categoriesMap) as any[]).find((c: any) => c.name === catName) as any;
      if (!cat) {
        const catId = randomUUID();
        cat = { id: catId, name: catName };
        updates[`categories/${catId}`] = cat;
        categoriesMap[catId] = cat;
      }
      createdCategories[catName] = cat.id;
    }

    const medicinesSnap = await db.ref('medicines').once('value');
    const medicinesMap = medicinesSnap.val() || {};
    
    const batchesSnap = await db.ref('batches').once('value');
    const batchesMap = batchesSnap.val() || {};

    const medicines = [
      { name: 'Panadol Advance', generic: 'Paracetamol 500mg', cat: 'Painkillers', barcode: '8961122000018' },
      { name: 'Panadol Extra', generic: 'Paracetamol + Caffeine', cat: 'Painkillers', barcode: '8961122000019' },
      { name: 'Brufen 400mg', generic: 'Ibuprofen', cat: 'Painkillers', barcode: '8961122000032' },
      { name: 'Synflex 550mg', generic: 'Naproxen Sodium', cat: 'Painkillers', barcode: '8961122000033' },
      { name: 'Nuberol Forte', generic: 'Paracetamol + Orphenadrine', cat: 'Painkillers', barcode: '8961122000034' },
      { name: 'Disprin', generic: 'Aspirin', cat: 'Painkillers', barcode: '8961122000094' },
      { name: 'Ponstan', generic: 'Mefenamic Acid', cat: 'Painkillers', barcode: '8961122000124' },
      { name: 'Voltral 50mg', generic: 'Diclofenac Sodium', cat: 'Painkillers', barcode: '8961122000125' },
      { name: 'Caflam 50mg', generic: 'Diclofenac Potassium', cat: 'Painkillers', barcode: '8961122000126' },
      { name: 'Augmentin 625mg', generic: 'Amoxicillin + Clavulanate', cat: 'Antibiotics', barcode: '8961122000025' },
      { name: 'Augmentin 1g', generic: 'Amoxicillin + Clavulanate', cat: 'Antibiotics', barcode: '8961122000026' },
      { name: 'Cravit 500mg', generic: 'Levofloxacin', cat: 'Antibiotics', barcode: '8961122000027' },
      { name: 'Leflox 500mg', generic: 'Levofloxacin', cat: 'Antibiotics', barcode: '8961122000028' },
      { name: 'Velosef 500mg', generic: 'Cephradine', cat: 'Antibiotics', barcode: '8961122000029' },
      { name: 'Azomax 500mg', generic: 'Azithromycin', cat: 'Antibiotics', barcode: '8961122000030' },
      { name: 'Novidat 500mg', generic: 'Ciprofloxacin', cat: 'Antibiotics', barcode: '8961122000031' },
      { name: 'Flagyl 400mg', generic: 'Metronidazole', cat: 'Gastrointestinal', barcode: '8961122000049' },
      { name: 'Risek 40mg', generic: 'Omeprazole', cat: 'Gastrointestinal', barcode: '8961122000070' },
      { name: 'Risek 20mg', generic: 'Omeprazole', cat: 'Gastrointestinal', barcode: '8961122000071' },
      { name: 'Nexum 40mg', generic: 'Esomeprazole', cat: 'Gastrointestinal', barcode: '8961122000072' },
      { name: 'Gaviscon Liquid', generic: 'Sodium Alginate', cat: 'Gastrointestinal', barcode: '8961122000073' },
      { name: 'Motilium 10mg', generic: 'Domperidone', cat: 'Gastrointestinal', barcode: '8961122000074' },
      { name: 'Gravinate', generic: 'Dimenhydrinate', cat: 'Gastrointestinal', barcode: '8961122000075' },
      { name: 'Arinac', generic: 'Ibuprofen + Pseudoephedrine', cat: 'Allergy', barcode: '8961122000056' },
      { name: 'Rigix', generic: 'Cetirizine', cat: 'Allergy', barcode: '8961122000063' },
      { name: 'Softin', generic: 'Loratadine', cat: 'Allergy', barcode: '8961122000064' },
      { name: 'Fexet 120mg', generic: 'Fexofenadine', cat: 'Allergy', barcode: '8961122000065' },
      { name: 'Corex D', generic: 'Dextromethorphan', cat: 'Cough & Cold', barcode: '8961122000100' },
      { name: 'Hydryllin', generic: 'Aminophylline + Diphenhydramine', cat: 'Cough & Cold', barcode: '8961122000101' },
      { name: 'Pulmonol', generic: 'Cough Syrup', cat: 'Cough & Cold', barcode: '8961122000102' },
      { name: 'Glucophage 500mg', generic: 'Metformin', cat: 'Diabetes', barcode: '8961122000117' },
      { name: 'Getryl 1mg', generic: 'Glimepiride', cat: 'Diabetes', barcode: '8961122000118' },
      { name: 'Getryl 2mg', generic: 'Glimepiride', cat: 'Diabetes', barcode: '8961122000119' },
      { name: 'Amaryl 2mg', generic: 'Glimepiride', cat: 'Diabetes', barcode: '8961122000120' },
      { name: 'Mixtard 30/70', generic: 'Insulin Human', cat: 'Diabetes', barcode: '8961122000121' },
      { name: 'Concor 5mg', generic: 'Bisoprolol', cat: 'Cardiology', barcode: '8961122000127' },
      { name: 'Lipget 10mg', generic: 'Atorvastatin', cat: 'Cardiology', barcode: '8961122000128' },
      { name: 'Lipget 20mg', generic: 'Atorvastatin', cat: 'Cardiology', barcode: '8961122000129' },
      { name: 'Angised', generic: 'Glyceryl Trinitrate', cat: 'Cardiology', barcode: '8961122000130' },
      { name: 'Norvasc 5mg', generic: 'Amlodipine', cat: 'Cardiology', barcode: '8961122000131' },
      { name: 'Lexotanil 3mg', generic: 'Bromazepam', cat: 'Neurology/Psychiatry', barcode: '8961122000132' },
      { name: 'Xanax 0.5mg', generic: 'Alprazolam', cat: 'Neurology/Psychiatry', barcode: '8961122000133' },
      { name: 'Epival 250mg', generic: 'Divalproex Sodium', cat: 'Neurology/Psychiatry', barcode: '8961122000134' },
      { name: 'Ventolin Inhaler', generic: 'Salbutamol', cat: 'Pulmonology', barcode: '8961122000135' },
      { name: 'Singulair 10mg', generic: 'Montelukast', cat: 'Pulmonology', barcode: '8961122000136' },
      { name: 'Myteka 10mg', generic: 'Montelukast', cat: 'Pulmonology', barcode: '8961122000137' },
      { name: 'Fucidin Cream', generic: 'Fusidic Acid', cat: 'Dermatology', barcode: '8961122000138' },
      { name: 'Betnovate Cream', generic: 'Betamethasone Valerate', cat: 'Dermatology', barcode: '8961122000139' },
      { name: 'Polyfax Ointment', generic: 'Polymyxin B + Bacitracin', cat: 'Dermatology', barcode: '8961122000140' },
      { name: 'Surbex Z', generic: 'Multivitamin', cat: 'Vitamins', barcode: '8961122000087' },
      { name: 'Sangobion', generic: 'Iron + Vitamins', cat: 'Vitamins', barcode: '8961122000088' },
      { name: 'CAC 1000 Plus', generic: 'Calcium + Vitamin D', cat: 'Vitamins', barcode: '8961122000089' },
      { name: 'Zain', generic: 'Zinc Sulfate', cat: 'Vitamins', barcode: '8961122000090' }
    ];

    for (const med of medicines) {
      let dbMed = (Object.values(medicinesMap) as any[]).find((m: any) => m.barcode === med.barcode) as any;
      let medId = dbMed?.id;
      if (!dbMed) {
        medId = randomUUID();
        dbMed = {
          id: medId,
          name: med.name,
          genericFormula: med.generic,
          categoryId: createdCategories[med.cat],
          minStockLevel: 10,
          barcode: med.barcode,
          stripsPerBox: 1,
          defaultSellingUnit: 'BOX',
          createdAt: new Date().toISOString()
        };
        updates[`medicines/${medId}`] = dbMed;
        medicinesMap[medId] = dbMed;
      }

      const medBatches = (Object.values(batchesMap) as any[]).filter((b: any) => b.medicineId === medId);
      if (medBatches.length === 0) {
        const defaultExpiry = new Date();
        defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 2);
        
        const batchId = randomUUID();
        const newBatch = {
          id: batchId,
          medicineId: medId,
          batchNumber: `B-${med.barcode.slice(-4)}`,
          expiryDate: defaultExpiry.toISOString(),
          quantity: 100,
          purchasePrice: 100,
          retailPrice: 150,
          createdAt: new Date().toISOString()
        };
        updates[`batches/${batchId}`] = newBatch;
        batchesMap[batchId] = newBatch;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }

    revalidatePath('/');
  } catch (error) {
    console.error('Error in importPakistaniMedicines:', error);
  }
}

export async function getAlertsData() {
  try {
    const [batchesSnap, medicinesSnap] = await Promise.all([
      db.ref('batches').once('value'),
      db.ref('medicines').once('value')
    ]);

    const batchesMap = batchesSnap.val() || {};
    const medicinesMap = medicinesSnap.val() || {};

    const now = new Date();
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setDate(now.getDate() + 180);

    const batches = Object.values(batchesMap) as any[];

    const urgentBatches = batches
      .filter((b: any) => {
        const expiry = new Date(b.expiryDate);
        return expiry <= sixMonthsFromNow;
      })
      .map((b: any) => {
        const med = medicinesMap[b.medicineId] || { name: 'Unknown' };
        return {
          id: b.id,
          medicineName: med.name,
          batchNumber: b.batchNumber,
          expiryDate: new Date(b.expiryDate)
        };
      });

    const stockMap = new Map<string, { name: string; quantity: number }>();
    for (const b of batches) {
      const med = medicinesMap[b.medicineId];
      if (!med) continue;
      if (!stockMap.has(b.medicineId)) {
        stockMap.set(b.medicineId, { name: med.name, quantity: 0 });
      }
      const record = stockMap.get(b.medicineId);
      if (record) {
        record.quantity += b.quantity;
      }
    }

    const lowStockAlerts = Array.from(stockMap.values())
      .filter(v => v.quantity < 2)
      .map((v, i) => ({ id: `ls-${i}`, medicineName: v.name, quantity: v.quantity }));

    return { urgentBatches, lowStockAlerts };
  } catch (error) {
    console.error('Error in getAlertsData:', error);
    return { urgentBatches: [], lowStockAlerts: [] };
  }
}
