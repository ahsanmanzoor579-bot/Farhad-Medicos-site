// Client-side Local Storage Database for Farhad Medicos
import { randomUUID } from 'crypto';

// Types
export interface Category {
  id: string;
  name: string;
}

export interface Medicine {
  id: string;
  name: string;
  genericFormula: string;
  categoryId: string;
  minStockLevel: number;
  rackLocation?: string | null;
  barcode?: string | null;
  stripsPerBox: number;
  defaultSellingUnit: 'BOX' | 'STRIP';
  createdAt: string;
}

export interface Batch {
  id: string;
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
  purchasePrice: number;
  retailPrice: number;
  quantity: number; // in smallest units (strips)
  createdAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  medicineId: string;
  batchId: string;
  quantity: number;
  unit: 'BOX' | 'STRIP';
  price: number; // strip unit price
}

export interface Sale {
  id: string;
  total: number;
  createdAt: string;
  items: Record<string, SaleItem>;
}

// Initial Seed Data
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Tablets' },
  { id: 'cat-2', name: 'Syrups' },
  { id: 'cat-3', name: 'Injections' },
];

const DEFAULT_MEDICINES: Medicine[] = [
  {
    id: 'med-1',
    name: 'Panadol 500mg',
    genericFormula: 'Paracetamol',
    categoryId: 'cat-1',
    minStockLevel: 5,
    rackLocation: 'A-12',
    barcode: '123456789',
    stripsPerBox: 10,
    defaultSellingUnit: 'STRIP',
    createdAt: new Date().toISOString()
  },
  {
    id: 'med-2',
    name: 'Brufen Syrup',
    genericFormula: 'Ibuprofen',
    categoryId: 'cat-2',
    minStockLevel: 3,
    rackLocation: 'B-3',
    barcode: '987654321',
    stripsPerBox: 1,
    defaultSellingUnit: 'BOX',
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_BATCHES: Batch[] = [
  {
    id: 'batch-1',
    medicineId: 'med-1',
    batchNumber: 'P2025',
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    purchasePrice: 200, // per box
    retailPrice: 250, // per box
    quantity: 50, // strips
    createdAt: new Date().toISOString()
  },
  {
    id: 'batch-2',
    medicineId: 'med-2',
    batchNumber: 'B1099',
    expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 3 months
    purchasePrice: 90,
    retailPrice: 110,
    quantity: 15,
    createdAt: new Date().toISOString()
  }
];

// Helper to check and initialize store
function getStore<T>(key: string, defaultData: T[]): T[] {
  if (typeof window === 'undefined') return defaultData;
  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(defaultData));
    return defaultData;
  }
  return JSON.parse(raw);
}

function saveStore<T>(key: string, data: T[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(data));
  }
}

// Client Database Methods
export const localDb = {
  getCategories(): Category[] {
    return getStore('categories', DEFAULT_CATEGORIES);
  },
  
  getMedicines(): Medicine[] {
    return getStore('medicines', DEFAULT_MEDICINES);
  },

  getBatches(): Batch[] {
    return getStore('batches', DEFAULT_BATCHES);
  },

  getSales(): Sale[] {
    return getStore('sales', []);
  },

  // Save Operations
  addCategory(name: string): Category {
    const categories = this.getCategories();
    let cat = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!cat) {
      cat = { id: `cat-${Date.now()}`, name };
      categories.push(cat);
      saveStore('categories', categories);
    }
    return cat;
  },

  addMedicine(data: {
    name: string;
    genericFormula: string;
    categoryName: string;
    minStockLevel: number;
    rackLocation?: string;
    barcode?: string;
    stripsPerBox?: number;
    defaultSellingUnit?: 'BOX' | 'STRIP';
  }): Medicine {
    const cat = this.addCategory(data.categoryName);
    const medicines = this.getMedicines();
    
    const med: Medicine = {
      id: `med-${Date.now()}`,
      name: data.name,
      genericFormula: data.genericFormula,
      categoryId: cat.id,
      minStockLevel: data.minStockLevel,
      rackLocation: data.rackLocation || null,
      barcode: data.barcode || null,
      stripsPerBox: data.stripsPerBox || 1,
      defaultSellingUnit: data.defaultSellingUnit || 'BOX',
      createdAt: new Date().toISOString()
    };

    medicines.push(med);
    saveStore('medicines', medicines);
    return med;
  },

  addBatch(data: {
    medicineId: string;
    batchNumber: string;
    expiryDate: string;
    purchasePrice: number;
    retailPrice: number;
    quantity: number;
  }): Batch {
    const batches = this.getBatches();
    const batch: Batch = {
      id: `batch-${Date.now()}`,
      medicineId: data.medicineId,
      batchNumber: data.batchNumber,
      expiryDate: data.expiryDate,
      purchasePrice: data.purchasePrice,
      retailPrice: data.retailPrice,
      quantity: data.quantity,
      createdAt: new Date().toISOString()
    };
    batches.push(batch);
    saveStore('batches', batches);
    return batch;
  },

  checkoutSale(items: Array<{
    medicineId: string;
    batchId: string;
    quantity: number;
    unit: 'BOX' | 'STRIP';
    price: number;
  }>): Sale {
    const sales = this.getSales();
    const batches = this.getBatches();

    const saleId = `sale-${Date.now()}`;
    const itemsRecord: Record<string, SaleItem> = {};
    let total = 0;

    items.forEach((item, index) => {
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

      // Deduct stock from batch
      const batch = batches.find(b => b.id === item.batchId);
      if (batch) {
        batch.quantity = Math.max(0, batch.quantity - item.quantity);
      }
    });

    const newSale: Sale = {
      id: saleId,
      total,
      createdAt: new Date().toISOString(),
      items: itemsRecord
    };

    sales.push(newSale);
    saveStore('sales', sales);
    saveStore('batches', batches);

    return newSale;
  },

  deleteMedicine(id: string): void {
    const medicines = this.getMedicines().filter(m => m.id !== id);
    const batches = this.getBatches().filter(b => b.medicineId !== id);
    saveStore('medicines', medicines);
    saveStore('batches', batches);
  },

  deleteBatch(id: string): void {
    const batches = this.getBatches().filter(b => b.id !== id);
    saveStore('batches', batches);
  }
};
