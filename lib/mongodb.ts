import { MongoClient, Db } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('Please add your MONGODB_URI environment variable to your .env file');
  }

  // If the database connection is already cached, use it
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // Set up connection options
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(); // This connects to the default database specified in the connection string URI

  // Cache the connection
  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
