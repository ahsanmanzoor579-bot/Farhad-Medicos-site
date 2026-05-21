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
    const { db } = await connectToDatabase();
    const batchesCol = db.collection('batches');
    const medicinesCol = db.collection('medicines');
    const salesCol = db.collection('sales');

    // Ensure indexes for speed (no-op if already exist)
    await batchesCol.createIndex({ medicineId: 1 }).catch(() => {});
    await batchesCol.createIndex({ expiryDate: 1 }).catch(() => {});
    await salesCol.createIndex({ createdAt: 1 }).catch(() => {});

    const now = new Date();
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setDate(now.getDate() + 180);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaySalesDetails = await getTodaySalesDetails();
    let dailySell = 0;
    let dailyProfit = 0;
    for (const item of todaySalesDetails) {
      dailySell += item.revenue;
      dailyProfit += item.profit;
    }

    const [totalMedicines, batchStats] = await Promise.all([
      medicinesCol.countDocuments(),
      batchesCol.aggregate([
        {
          $lookup: {
            from: 'medicines',
            localField: 'medicineId',
            foreignField: '_id',
            as: 'medicine'
          }
        },
        { $unwind: { path: '$medicine', preserveNullAndEmptyArrays: true } },
        {
          $facet: {
            expired: [
              { $match: { expiryDate: { $lte: now.toISOString() } } },
              { $count: 'count' }
            ],
            shortExpiry: [
              { $match: { expiryDate: { $gt: now.toISOString(), $lte: sixMonthsFromNow.toISOString() } } },
              { $count: 'count' }
            ],
            stockValue: [
              {
                $group: {
                  _id: null,
                  total: {
                    $sum: {
                      $multiply: [
                        '$quantity',
                        { $divide: ['$purchasePrice', { $cond: [{ $ifNull: ['$medicine.stripsPerBox', false] }, '$medicine.stripsPerBox', 1] }] }
                      ]
                    }
                  }
                }
              }
            ]
          }
        }
      ]).toArray()
    ]);

    const stats = batchStats[0] || {};
    return {
      totalUniqueMedicines: totalMedicines,
      totalStockValue: stats.stockValue?.[0]?.total || 0,
      expiredCount: stats.expired?.[0]?.count || 0,
      shortExpiryCount: stats.shortExpiry?.[0]?.count || 0,
      lowStockCount: 0,
      dailySell,
      dailyProfit
    };
  } catch (error) {
    console.error('Error in getDashboardData:', error);
    return { totalUniqueMedicines: 0, totalStockValue: 0, expiredCount: 0, shortExpiryCount: 0, lowStockCount: 0, dailySell: 0, dailyProfit: 0 };
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

    // Collect only the IDs we need
    const neededMedIds = new Set<string>();
    const neededBatchIds = new Set<string>();
    for (const sale of todaySales as any[]) {
      const items = sale.items ? Object.values(sale.items) : [];
      for (const item of items as any[]) {
        if (item.medicineId) neededMedIds.add(item.medicineId);
        if (item.batchId) neededBatchIds.add(item.batchId);
      }
    }

    // Fetch only needed docs
    const [medicines, batches] = await Promise.all([
      neededMedIds.size > 0 ? medicinesCol.find({ _id: { $in: [...neededMedIds] } }).toArray() : [],
      neededBatchIds.size > 0 ? batchesCol.find({ _id: { $in: [...neededBatchIds] } }).toArray() : []
    ]);

    const medicinesMap = (medicines as any[]).reduce((acc: any, med: any) => {
      acc[med._id] = med;
      return acc;
    }, {});

    const batchesMap = (batches as any[]).reduce((acc: any, b: any) => {
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
    const { db } = await connectToDatabase();

    const [medicines, categories, batchStats] = await Promise.all([
      db.collection('medicines').find({}, { 
        projection: { 
          name: 1, 
          genericFormula: 1, 
          categoryId: 1, 
          minStockLevel: 1, 
          rackLocation: 1, 
          stripsPerBox: 1, 
          defaultSellingUnit: 1 
        } 
      }).toArray(),
      db.collection('categories').find({}, { projection: { name: 1 } }).toArray(),
      db.collection('batches').aggregate([
        {
          $group: {
            _id: '$medicineId',
            totalStock: { $sum: '$quantity' },
            nearestExpiry: { $min: '$expiryDate' },
            latestPurchasePrice: { $last: '$purchasePrice' },
            latestRetailPrice: { $last: '$retailPrice' },
            batches: {
              $push: {
                id: '$_id',
                batchNumber: '$batchNumber',
                expiryDate: '$expiryDate',
                quantity: '$quantity',
                purchasePrice: '$purchasePrice',
                retailPrice: '$retailPrice'
              }
            }
          }
        }
      ]).toArray()
    ]);

    const categoriesMap = categories.reduce((acc: any, cat: any) => {
      acc[cat._id.toString()] = cat.name;
      return acc;
    }, {});

    const batchStatsMap = batchStats.reduce((acc: any, stat: any) => {
      acc[stat._id] = stat;
      return acc;
    }, {});

    return medicines.map((med: any) => {
      const catName = categoriesMap[med.categoryId?.toString()] || 'General';
      const stats = batchStatsMap[med._id.toString()] || {};

      const stripsPerBox = med.stripsPerBox || 1;
      const totalStock = stats.totalStock || 0;
      const boxes = Math.floor(totalStock / stripsPerBox);
      const strips = totalStock % stripsPerBox;
      const purchasePrice = stats.latestPurchasePrice || 0;
      const retailPrice = stats.latestRetailPrice || 0;
      const profitMargin = retailPrice > 0 ? ((retailPrice - purchasePrice) / retailPrice) * 100 : 0;

      return {
        id: med._id.toString(),
        name: med.name,
        genericFormula: med.genericFormula,
        categoryName: catName,
        minStockLevel: med.minStockLevel,
        rackLocation: med.rackLocation || null,
        totalStockUnits: totalStock,
        displayStock: { boxes, strips },
        stripsPerBox,
        defaultSellingUnit: med.defaultSellingUnit,
        nearestExpiry: stats.nearestExpiry ? new Date(stats.nearestExpiry) : null,
        purchasePrice: purchasePrice / stripsPerBox,
        retailPrice: retailPrice / stripsPerBox,
        boxPurchasePrice: purchasePrice,
        boxRetailPrice: retailPrice,
        profitMargin,
        batches: stats.batches || []
      };
    });
  } catch (error) {
    console.error('Error in getInventoryData:', error);
    return [];
  }
}

// On-demand batch loading for expanded rows
export async function getMedicineBatches(medicineId: string) {
  try {
    const batchesCol = await getCollection('batches');
    const batches = await batchesCol
      .find({ medicineId })
      .sort({ expiryDate: 1 })
      .toArray();

    return batches.map((b: any) => ({
      id: b._id,
      batchNumber: b.batchNumber,
      expiryDate: new Date(b.expiryDate),
      quantity: b.quantity,
      purchasePrice: b.purchasePrice,
      retailPrice: b.retailPrice
    }));
  } catch (error) {
    console.error('Error in getMedicineBatches:', error);
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

  const category = await categoriesCol.findOne({ name: data.categoryName });
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
    const salesCol = await getCollection('sales');

    // 1. Remove all previous data first
    await medicinesCol.deleteMany({});
    await batchesCol.deleteMany({});
    await salesCol.deleteMany({});
    await categoriesCol.deleteMany({});

    // 2. Define categories
    const categoriesList = [
      'Painkillers & Analgesics', 'Antibiotics', 'Gastrointestinal', 'Allergy & Antihistamines', 
      'Cough & Cold', 'Diabetes & Endocrine', 'Cardiology & BP', 'Neurology & Psychiatry', 
      'Pulmonology & Respiratory', 'Dermatology', 'Vitamins & Supplements',
      'Anti-Inflammatory', 'Urology', 'Gynecology & Hormones', 'Eye & ENT',
      'Muscle Relaxants', 'Anti-Infective', 'Hepatology', 'Oncology Support', 'General Medicine'
    ];

    const categoryMap: Record<string, string> = {};
    const categoryInserts = categoriesList.map(name => ({ _id: randomUUID(), name }));
    await categoriesCol.insertMany(categoryInserts);
    for (const cat of categoryInserts) {
      categoryMap[cat.name] = cat._id;
    }

    // 3. Real Pakistani brand medicines with generics and categories
    const realMedicines: Array<{brand: string; generic: string; category: string; dosages: string[]}> = [
      // Painkillers & Analgesics
      { brand: 'Panadol', generic: 'Paracetamol', category: 'Painkillers & Analgesics', dosages: ['500mg', '650mg', '1g', 'Extra', 'CF'] },
      { brand: 'Disprin', generic: 'Aspirin', category: 'Painkillers & Analgesics', dosages: ['300mg', '75mg', '150mg'] },
      { brand: 'Brufen', generic: 'Ibuprofen', category: 'Painkillers & Analgesics', dosages: ['200mg', '400mg', '600mg', '800mg'] },
      { brand: 'Ponstan', generic: 'Mefenamic Acid', category: 'Painkillers & Analgesics', dosages: ['250mg', '500mg', 'Forte'] },
      { brand: 'Voltral', generic: 'Diclofenac Sodium', category: 'Painkillers & Analgesics', dosages: ['25mg', '50mg', '75mg', 'SR 100mg', 'Emulgel'] },
      { brand: 'Cataflam', generic: 'Diclofenac Potassium', category: 'Painkillers & Analgesics', dosages: ['25mg', '50mg'] },
      { brand: 'Arcoxia', generic: 'Etoricoxib', category: 'Painkillers & Analgesics', dosages: ['60mg', '90mg', '120mg'] },
      { brand: 'Tramal', generic: 'Tramadol', category: 'Painkillers & Analgesics', dosages: ['50mg', '100mg', 'SR'] },
      { brand: 'Nurofen', generic: 'Ibuprofen', category: 'Painkillers & Analgesics', dosages: ['200mg', '400mg', 'Plus'] },
      { brand: 'Novafen', generic: 'Ibuprofen + Paracetamol', category: 'Painkillers & Analgesics', dosages: ['200mg', '400mg'] },
      { brand: 'Toradol', generic: 'Ketorolac', category: 'Painkillers & Analgesics', dosages: ['10mg', '30mg'] },
      { brand: 'Celebrex', generic: 'Celecoxib', category: 'Painkillers & Analgesics', dosages: ['100mg', '200mg'] },
      { brand: 'Nims', generic: 'Nimesulide', category: 'Painkillers & Analgesics', dosages: ['100mg'] },
      { brand: 'Progesic', generic: 'Paracetamol + Orphenadrine', category: 'Painkillers & Analgesics', dosages: ['450mg', 'DS'] },
      { brand: 'Myoril', generic: 'Thiocolchicoside', category: 'Muscle Relaxants', dosages: ['4mg', '8mg'] },
      { brand: 'Flexon', generic: 'Ibuprofen + Paracetamol', category: 'Painkillers & Analgesics', dosages: ['400mg'] },

      // Antibiotics
      { brand: 'Augmentin', generic: 'Amoxicillin + Clavulanate', category: 'Antibiotics', dosages: ['375mg', '625mg', '1g', 'DS', 'Syrup'] },
      { brand: 'Amoxil', generic: 'Amoxicillin', category: 'Antibiotics', dosages: ['250mg', '500mg', 'Syrup'] },
      { brand: 'Flagyl', generic: 'Metronidazole', category: 'Antibiotics', dosages: ['200mg', '400mg', 'Syrup'] },
      { brand: 'Azomax', generic: 'Azithromycin', category: 'Antibiotics', dosages: ['250mg', '500mg', 'Syrup'] },
      { brand: 'Klaricid', generic: 'Clarithromycin', category: 'Antibiotics', dosages: ['250mg', '500mg', 'XL'] },
      { brand: 'Cipesta', generic: 'Ciprofloxacin', category: 'Antibiotics', dosages: ['250mg', '500mg', '750mg'] },
      { brand: 'Tavanic', generic: 'Levofloxacin', category: 'Antibiotics', dosages: ['250mg', '500mg', '750mg'] },
      { brand: 'Velosef', generic: 'Cephradine', category: 'Antibiotics', dosages: ['250mg', '500mg', 'Syrup'] },
      { brand: 'Cefspan', generic: 'Cefixime', category: 'Antibiotics', dosages: ['200mg', '400mg', 'Syrup'] },
      { brand: 'Zinnat', generic: 'Cefuroxime', category: 'Antibiotics', dosages: ['125mg', '250mg', '500mg'] },
      { brand: 'Unasyn', generic: 'Ampicillin + Sulbactam', category: 'Antibiotics', dosages: ['375mg', '750mg'] },
      { brand: 'Dalacin C', generic: 'Clindamycin', category: 'Antibiotics', dosages: ['150mg', '300mg'] },
      { brand: 'Vibramycin', generic: 'Doxycycline', category: 'Antibiotics', dosages: ['100mg'] },
      { brand: 'Lincocin', generic: 'Lincomycin', category: 'Antibiotics', dosages: ['500mg'] },
      { brand: 'Erythrocin', generic: 'Erythromycin', category: 'Antibiotics', dosages: ['250mg', '500mg'] },
      { brand: 'Bactrim', generic: 'Co-Trimoxazole', category: 'Antibiotics', dosages: ['DS', '480mg'] },
      { brand: 'Ospamox', generic: 'Amoxicillin', category: 'Antibiotics', dosages: ['250mg', '500mg', '1g'] },
      { brand: 'Fortum', generic: 'Ceftazidime', category: 'Antibiotics', dosages: ['500mg', '1g'] },
      { brand: 'Rocephin', generic: 'Ceftriaxone', category: 'Antibiotics', dosages: ['250mg', '500mg', '1g'] },
      { brand: 'Tazact', generic: 'Piperacillin + Tazobactam', category: 'Antibiotics', dosages: ['4.5g'] },
      { brand: 'Meronem', generic: 'Meropenem', category: 'Antibiotics', dosages: ['500mg', '1g'] },
      { brand: 'Invanz', generic: 'Ertapenem', category: 'Antibiotics', dosages: ['1g'] },
      { brand: 'Novobiocin', generic: 'Novobiocin', category: 'Antibiotics', dosages: ['250mg'] },

      // Gastrointestinal
      { brand: 'Risek', generic: 'Omeprazole', category: 'Gastrointestinal', dosages: ['20mg', '40mg', 'MUPS'] },
      { brand: 'Nexium', generic: 'Esomeprazole', category: 'Gastrointestinal', dosages: ['20mg', '40mg'] },
      { brand: 'Pariet', generic: 'Rabeprazole', category: 'Gastrointestinal', dosages: ['10mg', '20mg'] },
      { brand: 'Losec', generic: 'Omeprazole', category: 'Gastrointestinal', dosages: ['10mg', '20mg', '40mg'] },
      { brand: 'Pantocar', generic: 'Pantoprazole', category: 'Gastrointestinal', dosages: ['20mg', '40mg'] },
      { brand: 'Motilium', generic: 'Domperidone', category: 'Gastrointestinal', dosages: ['10mg', 'Syrup'] },
      { brand: 'Maxolon', generic: 'Metoclopramide', category: 'Gastrointestinal', dosages: ['10mg', 'Syrup'] },
      { brand: 'Buscopan', generic: 'Hyoscine Butylbromide', category: 'Gastrointestinal', dosages: ['10mg', 'Plus'] },
      { brand: 'Imodium', generic: 'Loperamide', category: 'Gastrointestinal', dosages: ['2mg'] },
      { brand: 'Duphalac', generic: 'Lactulose', category: 'Gastrointestinal', dosages: ['Syrup', '10g'] },
      { brand: 'Gaviscon', generic: 'Alginate + Antacid', category: 'Gastrointestinal', dosages: ['Advance', 'Double Action', 'Syrup'] },
      { brand: 'Mucaine', generic: 'Aluminium + Magnesium + Oxetacaine', category: 'Gastrointestinal', dosages: ['Gel', 'Syrup'] },
      { brand: 'Ranitidine', generic: 'Ranitidine', category: 'Gastrointestinal', dosages: ['150mg', '300mg'] },
      { brand: 'Zantac', generic: 'Ranitidine', category: 'Gastrointestinal', dosages: ['150mg', '300mg'] },
      { brand: 'Perinorm', generic: 'Metoclopramide', category: 'Gastrointestinal', dosages: ['5mg', '10mg'] },

      // Allergy & Antihistamines
      { brand: 'Rigix', generic: 'Cetirizine', category: 'Allergy & Antihistamines', dosages: ['10mg', '5mg', 'Syrup'] },
      { brand: 'Claritine', generic: 'Loratadine', category: 'Allergy & Antihistamines', dosages: ['10mg', 'Syrup'] },
      { brand: 'Fexet', generic: 'Fexofenadine', category: 'Allergy & Antihistamines', dosages: ['60mg', '120mg', '180mg'] },
      { brand: 'Aerius', generic: 'Desloratadine', category: 'Allergy & Antihistamines', dosages: ['5mg', 'Syrup'] },
      { brand: 'Xyzal', generic: 'Levocetirizine', category: 'Allergy & Antihistamines', dosages: ['5mg', 'Syrup'] },
      { brand: 'Phenergan', generic: 'Promethazine', category: 'Allergy & Antihistamines', dosages: ['10mg', '25mg', 'Syrup'] },
      { brand: 'Atarax', generic: 'Hydroxyzine', category: 'Allergy & Antihistamines', dosages: ['10mg', '25mg'] },
      { brand: 'Singulair', generic: 'Montelukast', category: 'Allergy & Antihistamines', dosages: ['4mg', '5mg', '10mg'] },
      { brand: 'Zaditen', generic: 'Ketotifen', category: 'Allergy & Antihistamines', dosages: ['1mg', 'Syrup'] },
      { brand: 'Telfast', generic: 'Fexofenadine', category: 'Allergy & Antihistamines', dosages: ['30mg', '60mg', '120mg', '180mg'] },

      // Cough & Cold
      { brand: 'Benylin', generic: 'Diphenhydramine', category: 'Cough & Cold', dosages: ['DM', 'Chesty', 'Dry', 'Syrup'] },
      { brand: 'Corex', generic: 'Chlorpheniramine + Codeine', category: 'Cough & Cold', dosages: ['Syrup', 'DX'] },
      { brand: 'Robitussin', generic: 'Guaifenesin', category: 'Cough & Cold', dosages: ['DM', 'Chesty', 'Syrup'] },
      { brand: 'Prospan', generic: 'Ivy Leaf Extract', category: 'Cough & Cold', dosages: ['Syrup', 'Forte'] },
      { brand: 'Rhinathiol', generic: 'Carbocisteine', category: 'Cough & Cold', dosages: ['Syrup', '375mg'] },
      { brand: 'Sinecod', generic: 'Butamirate Citrate', category: 'Cough & Cold', dosages: ['Syrup', 'Forte'] },
      { brand: 'Actifed', generic: 'Triprolidine + Pseudoephedrine', category: 'Cough & Cold', dosages: ['Syrup', 'Plus'] },
      { brand: 'Sudafed', generic: 'Pseudoephedrine', category: 'Cough & Cold', dosages: ['30mg', '60mg'] },

      // Diabetes & Endocrine
      { brand: 'Glucophage', generic: 'Metformin', category: 'Diabetes & Endocrine', dosages: ['500mg', '850mg', '1000mg', 'XR'] },
      { brand: 'Amaryl', generic: 'Glimepiride', category: 'Diabetes & Endocrine', dosages: ['1mg', '2mg', '3mg', '4mg'] },
      { brand: 'Daonil', generic: 'Glibenclamide', category: 'Diabetes & Endocrine', dosages: ['2.5mg', '5mg'] },
      { brand: 'Januvia', generic: 'Sitagliptin', category: 'Diabetes & Endocrine', dosages: ['25mg', '50mg', '100mg'] },
      { brand: 'Galvus', generic: 'Vildagliptin', category: 'Diabetes & Endocrine', dosages: ['50mg', 'Met'] },
      { brand: 'Jardiance', generic: 'Empagliflozin', category: 'Diabetes & Endocrine', dosages: ['10mg', '25mg'] },
      { brand: 'Forxiga', generic: 'Dapagliflozin', category: 'Diabetes & Endocrine', dosages: ['5mg', '10mg'] },
      { brand: 'Victoza', generic: 'Liraglutide', category: 'Diabetes & Endocrine', dosages: ['Pen'] },
      { brand: 'Lantus', generic: 'Insulin Glargine', category: 'Diabetes & Endocrine', dosages: ['Solostar'] },
      { brand: 'Humalog', generic: 'Insulin Lispro', category: 'Diabetes & Endocrine', dosages: ['Kwikpen'] },
      { brand: 'Mixtard', generic: 'Insulin Mixed', category: 'Diabetes & Endocrine', dosages: ['30/70', '50/50'] },
      { brand: 'Eltroxin', generic: 'Levothyroxine', category: 'Diabetes & Endocrine', dosages: ['25mcg', '50mcg', '100mcg'] },
      { brand: 'Actos', generic: 'Pioglitazone', category: 'Diabetes & Endocrine', dosages: ['15mg', '30mg'] },

      // Cardiology & BP
      { brand: 'Concor', generic: 'Bisoprolol', category: 'Cardiology & BP', dosages: ['2.5mg', '5mg', '10mg'] },
      { brand: 'Tenormin', generic: 'Atenolol', category: 'Cardiology & BP', dosages: ['25mg', '50mg', '100mg'] },
      { brand: 'Norvasc', generic: 'Amlodipine', category: 'Cardiology & BP', dosages: ['2.5mg', '5mg', '10mg'] },
      { brand: 'Cozaar', generic: 'Losartan', category: 'Cardiology & BP', dosages: ['25mg', '50mg', '100mg'] },
      { brand: 'Diovan', generic: 'Valsartan', category: 'Cardiology & BP', dosages: ['40mg', '80mg', '160mg'] },
      { brand: 'Capoten', generic: 'Captopril', category: 'Cardiology & BP', dosages: ['12.5mg', '25mg', '50mg'] },
      { brand: 'Zestril', generic: 'Lisinopril', category: 'Cardiology & BP', dosages: ['5mg', '10mg', '20mg'] },
      { brand: 'Tritace', generic: 'Ramipril', category: 'Cardiology & BP', dosages: ['1.25mg', '2.5mg', '5mg', '10mg'] },
      { brand: 'Lasix', generic: 'Furosemide', category: 'Cardiology & BP', dosages: ['20mg', '40mg'] },
      { brand: 'Aldactone', generic: 'Spironolactone', category: 'Cardiology & BP', dosages: ['25mg', '50mg', '100mg'] },
      { brand: 'Plavix', generic: 'Clopidogrel', category: 'Cardiology & BP', dosages: ['75mg'] },
      { brand: 'Ecosprin', generic: 'Aspirin', category: 'Cardiology & BP', dosages: ['75mg', '150mg'] },
      { brand: 'Lipitor', generic: 'Atorvastatin', category: 'Cardiology & BP', dosages: ['10mg', '20mg', '40mg', '80mg'] },
      { brand: 'Crestor', generic: 'Rosuvastatin', category: 'Cardiology & BP', dosages: ['5mg', '10mg', '20mg', '40mg'] },
      { brand: 'Lopressor', generic: 'Metoprolol', category: 'Cardiology & BP', dosages: ['25mg', '50mg', '100mg'] },
      { brand: 'Cardura', generic: 'Doxazosin', category: 'Cardiology & BP', dosages: ['1mg', '2mg', '4mg'] },
      { brand: 'Aprovel', generic: 'Irbesartan', category: 'Cardiology & BP', dosages: ['75mg', '150mg', '300mg'] },
      { brand: 'Micardis', generic: 'Telmisartan', category: 'Cardiology & BP', dosages: ['20mg', '40mg', '80mg'] },
      { brand: 'Adalat', generic: 'Nifedipine', category: 'Cardiology & BP', dosages: ['10mg', '20mg', 'LA 30mg', 'LA 60mg'] },
      { brand: 'Diltiazem', generic: 'Diltiazem', category: 'Cardiology & BP', dosages: ['30mg', '60mg', '90mg'] },
      { brand: 'Isordil', generic: 'Isosorbide Dinitrate', category: 'Cardiology & BP', dosages: ['5mg', '10mg'] },
      { brand: 'Lanoxin', generic: 'Digoxin', category: 'Cardiology & BP', dosages: ['0.25mg'] },
      { brand: 'Coversyl', generic: 'Perindopril', category: 'Cardiology & BP', dosages: ['2mg', '4mg', '8mg'] },

      // Neurology & Psychiatry
      { brand: 'Tegretol', generic: 'Carbamazepine', category: 'Neurology & Psychiatry', dosages: ['200mg', '400mg', 'CR'] },
      { brand: 'Lyrica', generic: 'Pregabalin', category: 'Neurology & Psychiatry', dosages: ['25mg', '50mg', '75mg', '150mg', '300mg'] },
      { brand: 'Neurontin', generic: 'Gabapentin', category: 'Neurology & Psychiatry', dosages: ['100mg', '300mg', '400mg', '600mg'] },
      { brand: 'Zoloft', generic: 'Sertraline', category: 'Neurology & Psychiatry', dosages: ['25mg', '50mg', '100mg'] },
      { brand: 'Cipralex', generic: 'Escitalopram', category: 'Neurology & Psychiatry', dosages: ['5mg', '10mg', '20mg'] },
      { brand: 'Prozac', generic: 'Fluoxetine', category: 'Neurology & Psychiatry', dosages: ['20mg', '40mg'] },
      { brand: 'Lexotanil', generic: 'Bromazepam', category: 'Neurology & Psychiatry', dosages: ['1.5mg', '3mg', '6mg'] },
      { brand: 'Xanax', generic: 'Alprazolam', category: 'Neurology & Psychiatry', dosages: ['0.25mg', '0.5mg', '1mg'] },
      { brand: 'Valium', generic: 'Diazepam', category: 'Neurology & Psychiatry', dosages: ['2mg', '5mg', '10mg'] },
      { brand: 'Rivotril', generic: 'Clonazepam', category: 'Neurology & Psychiatry', dosages: ['0.5mg', '2mg'] },
      { brand: 'Zyprexa', generic: 'Olanzapine', category: 'Neurology & Psychiatry', dosages: ['2.5mg', '5mg', '10mg'] },
      { brand: 'Risperdal', generic: 'Risperidone', category: 'Neurology & Psychiatry', dosages: ['1mg', '2mg', '3mg', '4mg'] },
      { brand: 'Abilify', generic: 'Aripiprazole', category: 'Neurology & Psychiatry', dosages: ['5mg', '10mg', '15mg'] },
      { brand: 'Seroquel', generic: 'Quetiapine', category: 'Neurology & Psychiatry', dosages: ['25mg', '100mg', '200mg', '300mg'] },
      { brand: 'Depakote', generic: 'Valproate Sodium', category: 'Neurology & Psychiatry', dosages: ['250mg', '500mg', 'CR'] },
      { brand: 'Keppra', generic: 'Levetiracetam', category: 'Neurology & Psychiatry', dosages: ['250mg', '500mg', '1000mg'] },
      { brand: 'Topamax', generic: 'Topiramate', category: 'Neurology & Psychiatry', dosages: ['25mg', '50mg', '100mg'] },
      { brand: 'Stilnox', generic: 'Zolpidem', category: 'Neurology & Psychiatry', dosages: ['5mg', '10mg'] },
      { brand: 'Largactil', generic: 'Chlorpromazine', category: 'Neurology & Psychiatry', dosages: ['25mg', '50mg', '100mg'] },

      // Pulmonology & Respiratory
      { brand: 'Ventolin', generic: 'Salbutamol', category: 'Pulmonology & Respiratory', dosages: ['Inhaler', '2mg', '4mg', 'Nebulizer', 'Syrup'] },
      { brand: 'Seretide', generic: 'Fluticasone + Salmeterol', category: 'Pulmonology & Respiratory', dosages: ['125', '250', 'Evohaler'] },
      { brand: 'Symbicort', generic: 'Budesonide + Formoterol', category: 'Pulmonology & Respiratory', dosages: ['80/4.5', '160/4.5', '320/9'] },
      { brand: 'Spiriva', generic: 'Tiotropium', category: 'Pulmonology & Respiratory', dosages: ['Handihaler', 'Respimat'] },
      { brand: 'Atrovent', generic: 'Ipratropium', category: 'Pulmonology & Respiratory', dosages: ['Nebulizer', 'Inhaler'] },
      { brand: 'Pulmicort', generic: 'Budesonide', category: 'Pulmonology & Respiratory', dosages: ['Respules', 'Turbuhaler'] },
      { brand: 'Flixotide', generic: 'Fluticasone', category: 'Pulmonology & Respiratory', dosages: ['50mcg', '125mcg', '250mcg'] },
      { brand: 'Theophylline', generic: 'Theophylline', category: 'Pulmonology & Respiratory', dosages: ['100mg', '200mg', '300mg'] },

      // Dermatology
      { brand: 'Betnovate', generic: 'Betamethasone', category: 'Dermatology', dosages: ['Cream', 'Ointment', 'N', 'C'] },
      { brand: 'Dermovate', generic: 'Clobetasol', category: 'Dermatology', dosages: ['Cream', 'Ointment'] },
      { brand: 'Fucidin', generic: 'Fusidic Acid', category: 'Dermatology', dosages: ['Cream', 'H', 'Ointment'] },
      { brand: 'Canesten', generic: 'Clotrimazole', category: 'Dermatology', dosages: ['Cream 1%', 'Solution'] },
      { brand: 'Lamisil', generic: 'Terbinafine', category: 'Dermatology', dosages: ['250mg', 'Cream'] },
      { brand: 'Daktarin', generic: 'Miconazole', category: 'Dermatology', dosages: ['Cream', 'Gel', 'Powder'] },
      { brand: 'Panderm', generic: 'Clobetasol + Neomycin + Nystatin', category: 'Dermatology', dosages: ['Cream', 'NM'] },
      { brand: 'Fungizone', generic: 'Amphotericin B', category: 'Dermatology', dosages: ['Cream'] },

      // Vitamins & Supplements
      { brand: 'Surbex Z', generic: 'Multivitamin + Zinc', category: 'Vitamins & Supplements', dosages: ['Tablet', 'Plus'] },
      { brand: 'Caltrate', generic: 'Calcium + Vitamin D', category: 'Vitamins & Supplements', dosages: ['600mg', 'Plus'] },
      { brand: 'Centrum', generic: 'Multivitamin', category: 'Vitamins & Supplements', dosages: ['Silver', 'Advance', 'Women'] },
      { brand: 'Fefol', generic: 'Iron + Folic Acid', category: 'Vitamins & Supplements', dosages: ['Spansule', 'Z'] },
      { brand: 'Neurobion', generic: 'Vitamin B Complex', category: 'Vitamins & Supplements', dosages: ['Forte', 'Injection'] },
      { brand: 'Celin', generic: 'Ascorbic Acid', category: 'Vitamins & Supplements', dosages: ['500mg', '1000mg'] },
      { brand: 'D-Rise', generic: 'Cholecalciferol', category: 'Vitamins & Supplements', dosages: ['1000IU', '2000IU', '50000IU'] },
      { brand: 'Ferrous Sulphate', generic: 'Ferrous Sulphate', category: 'Vitamins & Supplements', dosages: ['200mg', '325mg'] },
      { brand: 'Evion', generic: 'Vitamin E', category: 'Vitamins & Supplements', dosages: ['200mg', '400mg', '600mg'] },
      { brand: 'Sangobion', generic: 'Iron Complex', category: 'Vitamins & Supplements', dosages: ['Capsule'] },
      { brand: 'Osteocare', generic: 'Calcium + Magnesium + Zinc + D3', category: 'Vitamins & Supplements', dosages: ['Tablet', 'Syrup'] },

      // Anti-Inflammatory
      { brand: 'Prednisolone', generic: 'Prednisolone', category: 'Anti-Inflammatory', dosages: ['5mg', '10mg', '20mg', '40mg'] },
      { brand: 'Medrol', generic: 'Methylprednisolone', category: 'Anti-Inflammatory', dosages: ['4mg', '8mg', '16mg'] },
      { brand: 'Dexamethasone', generic: 'Dexamethasone', category: 'Anti-Inflammatory', dosages: ['0.5mg', '4mg'] },
      { brand: 'Hydrocortisone', generic: 'Hydrocortisone', category: 'Anti-Inflammatory', dosages: ['10mg', '20mg', 'Cream'] },

      // Urology
      { brand: 'Proscar', generic: 'Finasteride', category: 'Urology', dosages: ['5mg'] },
      { brand: 'Flomax', generic: 'Tamsulosin', category: 'Urology', dosages: ['0.4mg'] },
      { brand: 'Viagra', generic: 'Sildenafil', category: 'Urology', dosages: ['25mg', '50mg', '100mg'] },
      { brand: 'Cialis', generic: 'Tadalafil', category: 'Urology', dosages: ['5mg', '10mg', '20mg'] },
      { brand: 'Urimax', generic: 'Tamsulosin', category: 'Urology', dosages: ['0.2mg', '0.4mg'] },

      // Gynecology & Hormones
      { brand: 'Primolut N', generic: 'Norethisterone', category: 'Gynecology & Hormones', dosages: ['5mg'] },
      { brand: 'Duphaston', generic: 'Dydrogesterone', category: 'Gynecology & Hormones', dosages: ['10mg'] },
      { brand: 'Marvelon', generic: 'Desogestrel + Ethinyl Estradiol', category: 'Gynecology & Hormones', dosages: ['Tablet'] },
      { brand: 'Provera', generic: 'Medroxyprogesterone', category: 'Gynecology & Hormones', dosages: ['5mg', '10mg'] },
      { brand: 'Diane 35', generic: 'Cyproterone + Ethinyl Estradiol', category: 'Gynecology & Hormones', dosages: ['Tablet'] },

      // Eye & ENT
      { brand: 'Tobrex', generic: 'Tobramycin', category: 'Eye & ENT', dosages: ['Eye Drops', 'Ointment'] },
      { brand: 'Refresh', generic: 'Carboxymethylcellulose', category: 'Eye & ENT', dosages: ['Tears', 'Plus'] },
      { brand: 'Visine', generic: 'Tetrahydrozoline', category: 'Eye & ENT', dosages: ['Eye Drops'] },
      { brand: 'Patanol', generic: 'Olopatadine', category: 'Eye & ENT', dosages: ['0.1%', '0.2%'] },
      { brand: 'Maxitrol', generic: 'Dexamethasone + Neomycin + Polymyxin', category: 'Eye & ENT', dosages: ['Eye Drops', 'Ointment'] },
      { brand: 'Otrivin', generic: 'Xylometazoline', category: 'Eye & ENT', dosages: ['Nasal Drops', 'Spray', 'Pediatric'] },
      { brand: 'Nasivion', generic: 'Oxymetazoline', category: 'Eye & ENT', dosages: ['0.01%', '0.025%', '0.05%'] },

      // Hepatology
      { brand: 'Livolin', generic: 'Phospholipids + B Vitamins', category: 'Hepatology', dosages: ['Forte'] },
      { brand: 'Hepamerz', generic: 'L-Ornithine L-Aspartate', category: 'Hepatology', dosages: ['Granules', 'Injection'] },
      { brand: 'Ursofalk', generic: 'Ursodeoxycholic Acid', category: 'Hepatology', dosages: ['250mg', '500mg'] },
      { brand: 'Sylimarin', generic: 'Silymarin', category: 'Hepatology', dosages: ['140mg', '70mg'] },

      // General Medicine
      { brand: 'Gravinate', generic: 'Dimenhydrinate', category: 'General Medicine', dosages: ['50mg', 'Syrup'] },
      { brand: 'Plasil', generic: 'Metoclopramide', category: 'General Medicine', dosages: ['10mg'] },
      { brand: 'Stemetil', generic: 'Prochlorperazine', category: 'General Medicine', dosages: ['5mg'] },
      { brand: 'Metformin', generic: 'Metformin HCl', category: 'Diabetes & Endocrine', dosages: ['500mg', '850mg', '1000mg'] },
      { brand: 'Amlodipine', generic: 'Amlodipine Besylate', category: 'Cardiology & BP', dosages: ['2.5mg', '5mg', '10mg'] },
      { brand: 'Atorvastatin', generic: 'Atorvastatin Calcium', category: 'Cardiology & BP', dosages: ['10mg', '20mg', '40mg'] },
      { brand: 'Omeprazole', generic: 'Omeprazole', category: 'Gastrointestinal', dosages: ['10mg', '20mg', '40mg'] },
      { brand: 'Ciprofloxacin', generic: 'Ciprofloxacin HCl', category: 'Antibiotics', dosages: ['250mg', '500mg', '750mg'] },
      { brand: 'Cetirizine', generic: 'Cetirizine Dihydrochloride', category: 'Allergy & Antihistamines', dosages: ['5mg', '10mg'] },
      { brand: 'Loratadine', generic: 'Loratadine', category: 'Allergy & Antihistamines', dosages: ['10mg', 'Syrup'] },
    ];

    const medicinesList: any[] = [];
    const batchesList: any[] = [];
    const totalToGenerate = 10000;
    let count = 0;
    const now = new Date();

    // Phase 1: Generate from real brands × dosages
    for (const entry of realMedicines) {
      for (const dosage of entry.dosages) {
        if (count >= totalToGenerate) break;
        const fullName = `${entry.brand} ${dosage}`;
        const categoryId = categoryMap[entry.category] || categoryMap['General Medicine'];
        const medId = randomUUID();
        const barcodeString = `896${String(count).padStart(10, '0')}`;

        const basePurchasePrice = 50 + Math.floor(Math.random() * 800);
        const retailPrice = Math.round(basePurchasePrice * (1.15 + Math.random() * 0.25));
        const stripsPerBox = [1, 7, 10, 14, 20, 28, 30][count % 7];

        medicinesList.push({
          _id: medId,
          name: fullName,
          genericFormula: entry.generic,
          categoryId: categoryId,
          minStockLevel: 5 + Math.floor(Math.random() * 15),
          barcode: barcodeString,
          stripsPerBox,
          defaultSellingUnit: count % 3 === 0 ? 'STRIP' : 'BOX',
          createdAt: now.toISOString()
        });

        // Varied expiry for realism
        let expiryDate: Date;
        const rand = Math.random();
        if (rand < 0.03) {
          // ~3% expired
          expiryDate = new Date(now.getTime() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000);
        } else if (rand < 0.10) {
          // ~7% short expiry (1-6 months)
          expiryDate = new Date(now.getTime() + Math.floor(30 + Math.random() * 150) * 24 * 60 * 60 * 1000);
        } else {
          // healthy (6 months - 3 years)
          expiryDate = new Date(now.getTime() + Math.floor(180 + Math.random() * 900) * 24 * 60 * 60 * 1000);
        }

        batchesList.push({
          _id: randomUUID(),
          medicineId: medId,
          batchNumber: `PK-${String(1000 + count).padStart(6, '0')}`,
          expiryDate: expiryDate.toISOString(),
          purchasePrice: basePurchasePrice,
          retailPrice,
          quantity: 10 + Math.floor(Math.random() * 500),
          createdAt: now.toISOString()
        });

        count++;
      }
      if (count >= totalToGenerate) break;
    }

    // Phase 2: Fill remaining with variations (additional manufacturers/generics)
    const pkManufacturers = [
      'Getz', 'Hilton', 'Searle', 'Sami', 'AGP', 'Martin Dow', 'Highnoon', 'PharmEvo',
      'CCL', 'Ferozsons', 'Schazoo', 'Platinum', 'Shaigan', 'Tabros', 'Wilsons', 'Bosch',
      'Barrett', 'Genome', 'Global', 'Helix', 'Indus', 'Mega', 'Nabiqasim', 'Pacific',
      'Pharmatec', 'Remington', 'Zafa', 'Atco', 'Herbion', 'Macter', 'Medinet',
      'Don Valley', 'Continental', 'BF Biosciences', 'Brookes', 'Cirin', 'Maple', 'Opal',
      'Star', 'Horizon', 'Valor', 'Allied', 'Rayner', 'Axis', 'Best', 'Swiss'
    ];
    const genericCompounds = [
      'Paracetamol', 'Amoxicillin', 'Azithromycin', 'Metformin', 'Losartan', 'Amlodipine',
      'Atorvastatin', 'Omeprazole', 'Pantoprazole', 'Cetirizine', 'Ciprofloxacin',
      'Cefixime', 'Diclofenac', 'Ibuprofen', 'Metoprolol', 'Ramipril', 'Rosuvastatin',
      'Escitalopram', 'Sertraline', 'Pregabalin', 'Gabapentin', 'Montelukast',
      'Fexofenadine', 'Levofloxacin', 'Doxycycline', 'Clarithromycin', 'Fluconazole',
      'Salbutamol', 'Prednisolone', 'Domperidone', 'Ranitidine', 'Famotidine',
      'Esomeprazole', 'Rabeprazole', 'Bisoprolol', 'Telmisartan', 'Irbesartan',
      'Hydrochlorothiazide', 'Furosemide', 'Spironolactone', 'Clopidogrel', 'Aspirin',
      'Glimepiride', 'Sitagliptin', 'Pioglitazone', 'Insulin Glargine', 'Levothyroxine',
      'Carbamazepine', 'Valproic Acid', 'Levetiracetam', 'Topiramate', 'Alprazolam',
      'Lorazepam', 'Fluoxetine', 'Quetiapine', 'Olanzapine', 'Risperidone',
      'Tamsulosin', 'Sildenafil', 'Tadalafil', 'Finasteride', 'Norethisterone',
      'Dydrogesterone', 'Vitamin D3', 'Folic Acid', 'Ferrous Sulphate', 'Zinc Sulphate'
    ];
    const dosages = ['5mg', '10mg', '20mg', '25mg', '40mg', '50mg', '75mg', '100mg', '150mg', '200mg', '250mg', '500mg', '625mg', '1g'];

    while (count < totalToGenerate) {
      const mfr = pkManufacturers[count % pkManufacturers.length];
      const generic = genericCompounds[count % genericCompounds.length];
      const dosage = dosages[count % dosages.length];
      const fullName = `${mfr}-${generic.split(' ')[0]} ${dosage}`;
      const categoryName = categoriesList[count % categoriesList.length];
      const categoryId = categoryMap[categoryName];

      const medId = randomUUID();
      const barcodeString = `896${String(count).padStart(10, '0')}`;

      const basePurchasePrice = 30 + Math.floor(Math.random() * 600);
      const retailPrice = Math.round(basePurchasePrice * (1.12 + Math.random() * 0.30));
      const stripsPerBox = [10, 14, 20, 28, 30][count % 5];

      medicinesList.push({
        _id: medId,
        name: fullName,
        genericFormula: generic,
        categoryId: categoryId,
        minStockLevel: 3 + Math.floor(Math.random() * 12),
        barcode: barcodeString,
        stripsPerBox,
        defaultSellingUnit: count % 2 === 0 ? 'STRIP' : 'BOX',
        createdAt: now.toISOString()
      });

      // Removed batch generation to keep inventory catalog purely empty of stock

      count++;
    }

    // Bulk insert in chunks of 2,500 to optimize network throughput
    const chunkSize = 2500;
    for (let i = 0; i < medicinesList.length; i += chunkSize) {
      const medChunk = medicinesList.slice(i, i + chunkSize);
      await medicinesCol.insertMany(medChunk);
    }

    revalidatePath('/');
  } catch (error) {
    console.error('Error in importPakistaniMedicines:', error);
  }
}

export async function importCustomMedicines(medicines: Array<{
  name: string;
  genericFormula: string;
  categoryName: string;
  minStockLevel?: number;
  rackLocation?: string;
  barcode?: string;
  stripsPerBox?: number;
  defaultSellingUnit?: 'BOX' | 'STRIP';
  batchNumber?: string;
  expiryDate?: string;
  purchasePrice?: number;
  retailPrice?: number;
  quantity?: number;
  unit?: 'BOX' | 'STRIP';
}>) {
  try {
    const categoriesCol = await getCollection('categories');
    const medicinesCol = await getCollection('medicines');
    const batchesCol = await getCollection('batches');

    for (const med of medicines) {
      if (!med.name || !med.genericFormula || !med.categoryName) continue;

      // Find or create category
      const category = await categoriesCol.findOne({ name: med.categoryName });
      let categoryId = category?._id;
      if (!category) {
        categoryId = randomUUID();
        await categoriesCol.insertOne({ _id: categoryId, name: med.categoryName });
      }

      // Check if medicine already exists by barcode or name
      let dbMed = null;
      if (med.barcode) {
        dbMed = await medicinesCol.findOne({ barcode: med.barcode });
      }
      if (!dbMed) {
        dbMed = await medicinesCol.findOne({ name: med.name });
      }

      let medicineId = dbMed?._id;
      const strips = typeof med.stripsPerBox === 'number' ? med.stripsPerBox : 10;

      if (!dbMed) {
        medicineId = randomUUID();
        await medicinesCol.insertOne({
          _id: medicineId,
          name: med.name,
          genericFormula: med.genericFormula,
          categoryId: categoryId,
          minStockLevel: typeof med.minStockLevel === 'number' ? med.minStockLevel : 10,
          rackLocation: med.rackLocation || null,
          barcode: med.barcode || null,
          stripsPerBox: strips,
          defaultSellingUnit: med.defaultSellingUnit || 'BOX',
          createdAt: new Date().toISOString()
        });
      }

      // Add batch if batch information is provided
      if (med.batchNumber && med.expiryDate && typeof med.purchasePrice === 'number' && typeof med.retailPrice === 'number' && typeof med.quantity === 'number') {
        const unit = med.unit || 'BOX';
        const quantityInStrips = unit === 'BOX' ? med.quantity * strips : med.quantity;

        // Check if this batch already exists for this medicine to prevent duplicate batch imports
        const existingBatch = await batchesCol.findOne({ medicineId, batchNumber: med.batchNumber });
        if (!existingBatch) {
          await batchesCol.insertOne({
            _id: randomUUID(),
            medicineId: medicineId,
            batchNumber: med.batchNumber,
            expiryDate: new Date(med.expiryDate).toISOString(),
            purchasePrice: med.purchasePrice,
            retailPrice: med.retailPrice,
            quantity: quantityInStrips,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    revalidatePath('/');
  } catch (error) {
    console.error('Error in importCustomMedicines:', error);
    throw new Error('Failed to import custom medicines database.');
  }
}

export async function clearAllSystemData() {
  try {
    const medicinesCol = await getCollection('medicines');
    const batchesCol = await getCollection('batches');
    const salesCol = await getCollection('sales');
    const categoriesCol = await getCollection('categories');

    await medicinesCol.deleteMany({});
    await batchesCol.deleteMany({});
    await salesCol.deleteMany({});
    await categoriesCol.deleteMany({});

    revalidatePath('/');
  } catch (error) {
    console.error('Error in clearAllSystemData:', error);
    throw new Error('Failed to wipe system data.');
  }
}
