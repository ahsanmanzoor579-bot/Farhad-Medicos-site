require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { connectToDatabase } = require('./lib/mongodb');

async function getCollection(name) {
  const { db } = await connectToDatabase();
  return db.collection(name);
}

async function testInventory() {
  console.time('DB Connect');
  const { db } = await connectToDatabase();
  console.timeEnd('DB Connect');

  console.time('fetch medicines');
  const medicines = await db.collection('medicines').find({}, { 
    projection: { name: 1, genericFormula: 1, categoryId: 1, minStockLevel: 1, rackLocation: 1, stripsPerBox: 1, defaultSellingUnit: 1 } 
  }).toArray();
  console.timeEnd('fetch medicines');

  console.time('fetch categories');
  const categories = await db.collection('categories').find({}, { projection: { name: 1 } }).toArray();
  console.timeEnd('fetch categories');

  console.time('aggregate batches');
  const batchStats = await db.collection('batches').aggregate([
    {
      $group: {
        _id: '$medicineId',
        totalStock: { $sum: '$quantity' },
        nearestExpiry: { $min: '$expiryDate' },
        latestPurchasePrice: { $last: '$purchasePrice' },
        latestRetailPrice: { $last: '$retailPrice' }
      }
    }
  ]).toArray();
  console.timeEnd('aggregate batches');

  console.time('dashboard aggregate 1');
  const now = new Date();
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setDate(now.getDate() + 180);
  await db.collection('batches').aggregate([
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
          { $group: { _id: null, total: { $sum: { $multiply: ['$quantity', '$purchasePrice'] } } } }
        ]
      }
    }
  ]).toArray();
  console.timeEnd('dashboard aggregate 1');

  process.exit(0);
}

testInventory();
