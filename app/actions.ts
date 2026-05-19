'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

// Collections Helper
async function getCollection(name: string): Promise<any> {
  const { db } = await connectToDatabase();
  return db.collection(name) as any;
}

export async function getDashboardData() {
  try {
    const medicinesCol = await getCollection('medicines');
    const batchesCol = await getCollection('batches');
    const salesCol = await getCollection('sales');

    const totalMedicines = await medicinesCol.countDocuments();

    const batches = await batchesCol.find({}).toArray();
    const medicinesList = await medicinesCol.find({}).toArray();
    const sales = await salesCol.find({}).toArray();

    const medicinesMap = medicinesList.reduce((acc: any, med: any) => {
      acc[med._id] = med;
      return acc;
    }, {});

    let totalStockValue = 0;
    let shortExpiryCount = 0;
    let expiredCount = 0;

    const now = new Date();
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setDate(now.getDate() + 180);

    const medicineStockMap: Record<string, number> = {};

    for (const batch of batches as any[]) {
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
    for (const med of medicinesList as any[]) {
      const stockUnits = medicineStockMap[med._id] || 0;
      const thresholdUnits = (med.stripsPerBox || 1) * (med.minStockLevel || 0);
      if (stockUnits < Math.max(3, thresholdUnits)) {
        lowStockCount++;
      }
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let dailySell = 0;
    let dailyProfit = 0;

    const batchesMap = batches.reduce((acc: any, b: any) => {
      acc[b._id] = b;
      return acc;
    }, {});

    for (const sale of sales as any[]) {
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
    const salesCol = await getCollection('sales');
    const medicinesCol = await getCollection('medicines');
    const batchesCol = await getCollection('batches');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaySales = await salesCol
      .find({ createdAt: { $gte: startOfDay.toISOString() } })
      .sort({ createdAt: -1 })
      .toArray();

    const medicines = await medicinesCol.find({}).toArray();
    const batches = await batchesCol.find({}).toArray();

    const medicinesMap = medicines.reduce((acc: any, med: any) => {
      acc[med._id] = med;
      return acc;
    }, {});

    const batchesMap = batches.reduce((acc: any, b: any) => {
      acc[b._id] = b;
      return acc;
    }, {});

    const salesItemsList: any[] = [];

    for (const sale of todaySales as any[]) {
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
          id: item.id || randomUUID(),
          saleId: sale._id,
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
    const medicinesCol = await getCollection('medicines');
    const categoriesCol = await getCollection('categories');
    const batchesCol = await getCollection('batches');

    const medicines = await medicinesCol.find({}).toArray();
    const categories = await categoriesCol.find({}).toArray();
    const batches = await batchesCol.find({}).toArray();

    const categoriesMap = categories.reduce((acc: any, cat: any) => {
      acc[cat._id] = cat;
      return acc;
    }, {});

    return medicines.map((med: any) => {
      const category = categoriesMap[med.categoryId] || { name: 'General' };
      const medBatches = batches
        .filter((b: any) => b.medicineId === med._id)
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
        id: med._id,
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
        batches: medBatches.map((b: any) => ({
          ...b,
          id: b._id,
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
    const categoriesCol = await getCollection('categories');
    const list = await categoriesCol.find({}).toArray();
    return list
      .map((c: any) => ({ id: c._id, name: c.name }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in getCategories:', error);
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
  const categoriesCol = await getCollection('categories');
  const medicinesCol = await getCollection('medicines');
  const batchesCol = await getCollection('batches');

  let category = await categoriesCol.findOne({ name: data.categoryName });
  let categoryId = category?._id;

  if (!category) {
    categoryId = randomUUID();
    await categoriesCol.insertOne({ _id: categoryId, name: data.categoryName });
  }

  const strips = typeof data.stripsPerBox === 'number' ? data.stripsPerBox : 1;
  const medicineId = randomUUID();

  await medicinesCol.insertOne({
    _id: medicineId,
    name: data.medicineName,
    genericFormula: data.genericFormula,
    categoryId: categoryId,
    minStockLevel: data.minStockLevel,
    rackLocation: data.rackLocation || null,
    barcode: data.barcode || null,
    stripsPerBox: strips,
    defaultSellingUnit: data.defaultSellingUnit || 'BOX',
    createdAt: new Date().toISOString()
  });

  if (data.initialBatch) {
    const b = data.initialBatch;
    const unit = b.unit || 'BOX';
    const quantityInStrips = unit === 'BOX' ? b.quantity * strips : b.quantity;
    
    await batchesCol.insertOne({
      _id: randomUUID(),
      medicineId: medicineId,
      batchNumber: b.batchNumber,
      expiryDate: new Date(b.expiryDate).toISOString(),
      purchasePrice: b.purchasePrice,
      retailPrice: b.retailPrice,
      quantity: quantityInStrips,
      createdAt: new Date().toISOString()
    });
  }

  revalidatePath('/');
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
  const medicinesCol = await getCollection('medicines');
  const batchesCol = await getCollection('batches');

  const med = await medicinesCol.findOne({ _id: data.medicineId });
  if (!med) throw new Error('Medicine not found.');

  const stripsPerBox = med.stripsPerBox || 1;
  const unit = data.unit || 'BOX';
  const quantity = unit === 'BOX' ? data.quantity * stripsPerBox : data.quantity;

  await batchesCol.insertOne({
    _id: randomUUID(),
    medicineId: data.medicineId,
    batchNumber: data.batchNumber,
    expiryDate: new Date(data.expiryDate).toISOString(),
    purchasePrice: data.purchasePrice,
    retailPrice: data.retailPrice,
    quantity,
    createdAt: new Date().toISOString()
  });

  revalidatePath('/');
}

export async function checkoutSale(items: Array<{
  medicineId: string;
  batchId: string;
  quantity: number;
  unit: 'BOX' | 'STRIP';
  price: number;
}>) {
  const salesCol = await getCollection('sales');
  const batchesCol = await getCollection('batches');

  const saleId = randomUUID();
  let total = 0;
  const itemsRecord: Record<string, any> = {};

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const itemId = `item-${saleId}-${index}`;
    itemsRecord[itemId] = {
      id: itemId,
      saleId,
      medicineId: item.medicineId,
      batchId: item.batchId,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price
    };

    total += item.quantity * item.price;

    // Deduct stock
    await batchesCol.updateOne(
      { _id: item.batchId },
      { $inc: { quantity: -item.quantity } }
    );
  }

  await salesCol.insertOne({
    _id: saleId,
    total,
    items: itemsRecord,
    createdAt: new Date().toISOString()
  });

  revalidatePath('/');
}

export async function deleteMedicine(id: string) {
  const medicinesCol = await getCollection('medicines');
  const batchesCol = await getCollection('batches');
  await medicinesCol.deleteOne({ _id: id });
  await batchesCol.deleteMany({ medicineId: id });
  revalidatePath('/');
}

export async function deleteBatch(id: string) {
  const batchesCol = await getCollection('batches');
  await batchesCol.deleteOne({ _id: id });
  revalidatePath('/');
}

export async function importPakistaniMedicines() {
  try {
    const categoriesCol = await getCollection('categories');
    const medicinesCol = await getCollection('medicines');
    const batchesCol = await getCollection('batches');

    const categories = [
      'Painkillers', 'Antibiotics', 'Gastrointestinal', 'Allergy', 
      'Cough & Cold', 'Diabetes', 'Cardiology', 'Neurology/Psychiatry', 
      'Pulmonology', 'Dermatology', 'Vitamins'
    ];

    const categoryMap: Record<string, string> = {};
    for (const catName of categories) {
      let cat = await categoriesCol.findOne({ name: catName });
      if (!cat) {
        const catId = randomUUID();
        await categoriesCol.insertOne({ _id: catId, name: catName });
        categoryMap[catName] = catId;
      } else {
        categoryMap[catName] = cat._id;
      }
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

    for (const med of medicines) {
      let dbMed = await medicinesCol.findOne({ barcode: med.barcode });
      let medId = dbMed?._id;
      if (!dbMed) {
        medId = randomUUID();
        await medicinesCol.insertOne({
          _id: medId,
          name: med.name,
          genericFormula: med.generic,
          categoryId: categoryMap[med.cat],
          minStockLevel: 10,
          barcode: med.barcode,
          stripsPerBox: 10,
          defaultSellingUnit: 'STRIP',
          createdAt: new Date().toISOString()
        });
      }

      const medBatches = await batchesCol.find({ medicineId: medId }).toArray();
      if (medBatches.length === 0) {
        await batchesCol.insertOne({
          _id: randomUUID(),
          medicineId: medId,
          batchNumber: `B-${med.barcode.slice(-4)}`,
          expiryDate: new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000).toISOString(),
          purchasePrice: 200,
          retailPrice: 250,
          quantity: 100,
          createdAt: new Date().toISOString()
        });
      }
    }

    revalidatePath('/');
  } catch (error) {
    console.error('Error in importPakistaniMedicines:', error);
  }
}
