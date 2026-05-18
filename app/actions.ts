'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getDashboardData() {
  const medicines = await prisma.medicine.count();
  
  const batches = await prisma.batch.findMany({
    include: { medicine: true }
  });

  let totalStockValue = 0;
  let shortExpiryCount = 0;
  let expiredCount = 0;
  
  const now = new Date();
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setDate(now.getDate() + 180);

  const medicineStockMap: Record<string, number> = {};

  for (const batch of batches) {
    totalStockValue += batch.quantity * batch.purchasePrice;
    
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
  const allMedicines = await prisma.medicine.findMany();
  for (const med of allMedicines) {
    const stock = medicineStockMap[med.id] || 0;
    if (stock < 3) {
      lowStockCount++;
    }
  }

  // Calculate Daily Sell and Profit
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todaySales = await prisma.sale.findMany({
    where: {
      createdAt: {
        gte: startOfDay,
      }
    },
    include: {
      items: {
        include: {
          batch: true
        }
      }
    }
  });

  let dailySell = 0;
  let dailyProfit = 0;

  for (const sale of todaySales) {
    dailySell += sale.total;
    for (const item of sale.items) {
      const profit = (item.price - item.batch.purchasePrice) * item.quantity;
      dailyProfit += profit;
    }
  }

  return {
    totalUniqueMedicines: medicines,
    totalStockValue,
    expiredCount,
    shortExpiryCount,
    lowStockCount,
    dailySell,
    dailyProfit
  };
}

export async function getTodaySalesDetails() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todaySales = await prisma.sale.findMany({
    where: {
      createdAt: {
        gte: startOfDay,
      }
    },
    include: {
      items: {
        include: {
          medicine: true,
          batch: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Flatten the sales items into a single array for the table
  const salesItemsList = [];
  
  for (const sale of todaySales) {
    for (const item of sale.items) {
      salesItemsList.push({
        id: item.id,
        saleId: sale.id,
        time: sale.createdAt,
        medicineName: item.medicine.name,
        genericFormula: item.medicine.genericFormula,
        batchNumber: item.batch.batchNumber,
        quantity: item.quantity,
        salePrice: item.price,
        purchasePrice: item.batch.purchasePrice,
        revenue: item.price * item.quantity,
        profit: (item.price - item.batch.purchasePrice) * item.quantity
      });
    }
  }

  return salesItemsList;
}

export async function getInventoryData() {
  const medicines = await prisma.medicine.findMany({
    include: {
      category: true,
      batches: {
        orderBy: { expiryDate: 'asc' }
      }
    }
  });

  return medicines.map((med: any) => {
    let totalStock = 0;
    let nearestExpiry: Date | null = null;
    let avgPurchasePrice = 0;
    let avgRetailPrice = 0;

    if (med.batches.length > 0) {
      nearestExpiry = med.batches[0].expiryDate;
      totalStock = med.batches.reduce((sum: number, b: any) => sum + b.quantity, 0);
      
      // Calculate weighted averages or just take the latest batch's prices.
      // We'll just take the latest batch for pricing simplicity if not specified.
      const latestBatch = med.batches[med.batches.length - 1];
      avgPurchasePrice = latestBatch.purchasePrice;
      avgRetailPrice = latestBatch.retailPrice;
    }

    let profitMargin = 0;
    if (avgRetailPrice > 0) {
      profitMargin = ((avgRetailPrice - avgPurchasePrice) / avgRetailPrice) * 100;
    }

    return {
      id: med.id,
      name: med.name,
      genericFormula: med.genericFormula,
      categoryName: med.category.name,
      minStockLevel: med.minStockLevel,
      rackLocation: med.rackLocation,
      totalStock,
      nearestExpiry,
      purchasePrice: avgPurchasePrice,
      retailPrice: avgRetailPrice,
      profitMargin,
      batches: med.batches
    };
  });
}

export async function getCategories() {
  return await prisma.category.findMany({ orderBy: { name: 'asc' } });
}

export async function getMedicinesList() {
  return await prisma.medicine.findMany({ orderBy: { name: 'asc' } });
}

export async function addMedicineAndCategory(data: {
  medicineName: string;
  genericFormula: string;
  categoryName: string;
  minStockLevel: number;
  rackLocation?: string;
  barcode?: string;
}) {
  const category = await prisma.category.upsert({
    where: { name: data.categoryName },
    update: {},
    create: { name: data.categoryName }
  });

  await prisma.medicine.create({
    data: {
      name: data.medicineName,
      genericFormula: data.genericFormula,
      categoryId: category.id,
      minStockLevel: data.minStockLevel,
      rackLocation: data.rackLocation || null,
      barcode: data.barcode || null
    }
  });

  revalidatePath('/');
}

export async function addBatch(data: {
  medicineId: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  purchasePrice: number;
  retailPrice: number;
  quantity: number;
}) {
  await prisma.batch.create({
    data: {
      medicineId: data.medicineId,
      batchNumber: data.batchNumber,
      expiryDate: new Date(data.expiryDate),
      purchasePrice: data.purchasePrice,
      retailPrice: data.retailPrice,
      quantity: data.quantity
    }
  });

  revalidatePath('/');
}

export async function checkoutSale(cart: { medicineId: string; batchId: string; quantity: number; price: number }[]) {
  const total = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);

  // Perform inside a transaction
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        total,
        items: {
          create: cart.map(item => ({
            medicineId: item.medicineId,
            batchId: item.batchId,
            quantity: item.quantity,
            price: item.price
          }))
        }
      }
    });

    for (const item of cart) {
      const batch = await tx.batch.findUnique({ where: { id: item.batchId } });
      if (!batch || batch.quantity < item.quantity) {
        throw new Error(`Insufficient stock for batch ${item.batchId}`);
      }
      await tx.batch.update({
        where: { id: item.batchId },
        data: { quantity: batch.quantity - item.quantity }
      });
    }
  });

  revalidatePath('/');
}

export async function importPakistaniMedicines() {
  const categories = [
    'Painkillers', 'Antibiotics', 'Allergy', 'Gastrointestinal', 'Vitamins', 'Cough & Cold', 'Diabetes',
    'Cardiology', 'Neurology/Psychiatry', 'Pulmonology', 'Dermatology'
  ];
  const createdCategories: Record<string, string> = {};

  for (const catName of categories) {
    const cat = await prisma.category.upsert({
      where: { name: catName },
      update: {},
      create: { name: catName }
    });
    createdCategories[catName] = cat.id;
  }

  const medicines = [
    // Painkillers & NSAIDs
    { name: 'Panadol Advance', generic: 'Paracetamol 500mg', cat: 'Painkillers', barcode: '8961122000018' },
    { name: 'Panadol Extra', generic: 'Paracetamol + Caffeine', cat: 'Painkillers', barcode: '8961122000019' },
    { name: 'Brufen 400mg', generic: 'Ibuprofen', cat: 'Painkillers', barcode: '8961122000032' },
    { name: 'Synflex 550mg', generic: 'Naproxen Sodium', cat: 'Painkillers', barcode: '8961122000033' },
    { name: 'Nuberol Forte', generic: 'Paracetamol + Orphenadrine', cat: 'Painkillers', barcode: '8961122000034' },
    { name: 'Disprin', generic: 'Aspirin', cat: 'Painkillers', barcode: '8961122000094' },
    { name: 'Ponstan', generic: 'Mefenamic Acid', cat: 'Painkillers', barcode: '8961122000124' },
    { name: 'Voltral 50mg', generic: 'Diclofenac Sodium', cat: 'Painkillers', barcode: '8961122000125' },
    { name: 'Caflam 50mg', generic: 'Diclofenac Potassium', cat: 'Painkillers', barcode: '8961122000126' },

    // Antibiotics
    { name: 'Augmentin 625mg', generic: 'Amoxicillin + Clavulanate', cat: 'Antibiotics', barcode: '8961122000025' },
    { name: 'Augmentin 1g', generic: 'Amoxicillin + Clavulanate', cat: 'Antibiotics', barcode: '8961122000026' },
    { name: 'Cravit 500mg', generic: 'Levofloxacin', cat: 'Antibiotics', barcode: '8961122000027' },
    { name: 'Leflox 500mg', generic: 'Levofloxacin', cat: 'Antibiotics', barcode: '8961122000028' },
    { name: 'Velosef 500mg', generic: 'Cephradine', cat: 'Antibiotics', barcode: '8961122000029' },
    { name: 'Azomax 500mg', generic: 'Azithromycin', cat: 'Antibiotics', barcode: '8961122000030' },
    { name: 'Novidat 500mg', generic: 'Ciprofloxacin', cat: 'Antibiotics', barcode: '8961122000031' },

    // Gastrointestinal
    { name: 'Flagyl 400mg', generic: 'Metronidazole', cat: 'Gastrointestinal', barcode: '8961122000049' },
    { name: 'Risek 40mg', generic: 'Omeprazole', cat: 'Gastrointestinal', barcode: '8961122000070' },
    { name: 'Risek 20mg', generic: 'Omeprazole', cat: 'Gastrointestinal', barcode: '8961122000071' },
    { name: 'Nexum 40mg', generic: 'Esomeprazole', cat: 'Gastrointestinal', barcode: '8961122000072' },
    { name: 'Gaviscon Liquid', generic: 'Sodium Alginate', cat: 'Gastrointestinal', barcode: '8961122000073' },
    { name: 'Motilium 10mg', generic: 'Domperidone', cat: 'Gastrointestinal', barcode: '8961122000074' },
    { name: 'Gravinate', generic: 'Dimenhydrinate', cat: 'Gastrointestinal', barcode: '8961122000075' },

    // Allergy, Cough & Cold
    { name: 'Arinac', generic: 'Ibuprofen + Pseudoephedrine', cat: 'Allergy', barcode: '8961122000056' },
    { name: 'Rigix', generic: 'Cetirizine', cat: 'Allergy', barcode: '8961122000063' },
    { name: 'Softin', generic: 'Loratadine', cat: 'Allergy', barcode: '8961122000064' },
    { name: 'Fexet 120mg', generic: 'Fexofenadine', cat: 'Allergy', barcode: '8961122000065' },
    { name: 'Corex D', generic: 'Dextromethorphan', cat: 'Cough & Cold', barcode: '8961122000100' },
    { name: 'Hydryllin', generic: 'Aminophylline + Diphenhydramine', cat: 'Cough & Cold', barcode: '8961122000101' },
    { name: 'Pulmonol', generic: 'Cough Syrup', cat: 'Cough & Cold', barcode: '8961122000102' },

    // Diabetes
    { name: 'Glucophage 500mg', generic: 'Metformin', cat: 'Diabetes', barcode: '8961122000117' },
    { name: 'Getryl 1mg', generic: 'Glimepiride', cat: 'Diabetes', barcode: '8961122000118' },
    { name: 'Getryl 2mg', generic: 'Glimepiride', cat: 'Diabetes', barcode: '8961122000119' },
    { name: 'Amaryl 2mg', generic: 'Glimepiride', cat: 'Diabetes', barcode: '8961122000120' },
    { name: 'Mixtard 30/70', generic: 'Insulin Human', cat: 'Diabetes', barcode: '8961122000121' },

    // Cardiology
    { name: 'Concor 5mg', generic: 'Bisoprolol', cat: 'Cardiology', barcode: '8961122000127' },
    { name: 'Lipget 10mg', generic: 'Atorvastatin', cat: 'Cardiology', barcode: '8961122000128' },
    { name: 'Lipget 20mg', generic: 'Atorvastatin', cat: 'Cardiology', barcode: '8961122000129' },
    { name: 'Angised', generic: 'Glyceryl Trinitrate', cat: 'Cardiology', barcode: '8961122000130' },
    { name: 'Norvasc 5mg', generic: 'Amlodipine', cat: 'Cardiology', barcode: '8961122000131' },

    // Neurology & Psychiatry
    { name: 'Lexotanil 3mg', generic: 'Bromazepam', cat: 'Neurology/Psychiatry', barcode: '8961122000132' },
    { name: 'Xanax 0.5mg', generic: 'Alprazolam', cat: 'Neurology/Psychiatry', barcode: '8961122000133' },
    { name: 'Epival 250mg', generic: 'Divalproex Sodium', cat: 'Neurology/Psychiatry', barcode: '8961122000134' },

    // Pulmonology
    { name: 'Ventolin Inhaler', generic: 'Salbutamol', cat: 'Pulmonology', barcode: '8961122000135' },
    { name: 'Singulair 10mg', generic: 'Montelukast', cat: 'Pulmonology', barcode: '8961122000136' },
    { name: 'Myteka 10mg', generic: 'Montelukast', cat: 'Pulmonology', barcode: '8961122000137' },

    // Dermatology
    { name: 'Fucidin Cream', generic: 'Fusidic Acid', cat: 'Dermatology', barcode: '8961122000138' },
    { name: 'Betnovate Cream', generic: 'Betamethasone Valerate', cat: 'Dermatology', barcode: '8961122000139' },
    { name: 'Polyfax Ointment', generic: 'Polymyxin B + Bacitracin', cat: 'Dermatology', barcode: '8961122000140' },

    // Vitamins & Supplements
    { name: 'Surbex Z', generic: 'Multivitamin', cat: 'Vitamins', barcode: '8961122000087' },
    { name: 'Sangobion', generic: 'Iron + Vitamins', cat: 'Vitamins', barcode: '8961122000088' },
    { name: 'CAC 1000 Plus', generic: 'Calcium + Vitamin D', cat: 'Vitamins', barcode: '8961122000089' },
    { name: 'Zain', generic: 'Zinc Sulfate', cat: 'Vitamins', barcode: '8961122000090' }
  ];

  for (const med of medicines) {
    const dbMed = await prisma.medicine.upsert({
      where: { barcode: med.barcode },
      update: {},
      create: {
        name: med.name,
        genericFormula: med.generic,
        categoryId: createdCategories[med.cat],
        minStockLevel: 10,
        barcode: med.barcode
      }
    });

    const batchCount = await prisma.batch.count({ where: { medicineId: dbMed.id } });
    if (batchCount === 0) {
      const defaultExpiry = new Date();
      defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 2);
      await prisma.batch.create({
        data: {
          medicineId: dbMed.id,
          batchNumber: `B-${med.barcode.slice(-4)}`,
          expiryDate: defaultExpiry.toISOString(),
          quantity: 100,
          purchasePrice: 100,
          retailPrice: 150,
        }
      });
    }
  }

  revalidatePath('/');
}
