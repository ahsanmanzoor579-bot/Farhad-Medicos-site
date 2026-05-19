import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  let credential;

  if (serviceAccountEnv) {
    try {
      // Parse the JSON string from environment variable
      const serviceAccount = JSON.parse(serviceAccountEnv);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', e);
      throw e;
    }
  } else {
    // Fallback to local JSON file for development
    const fs = require('fs');
    const path = require('path');
    const serviceAccountPath = path.join(process.cwd(), 'medicine-app-63cce-firebase-adminsdk-fbsvc-d215f07266.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      credential = admin.credential.cert(serviceAccount);
    } else {
      console.error('Firebase Service Account file not found locally and FIREBASE_SERVICE_ACCOUNT environment variable is not defined.');
      throw new Error('Missing Firebase credentials.');
    }
  }

  admin.initializeApp({
    credential,
    databaseURL: 'https://medicine-app-63cce-default-rtdb.firebaseio.com'
  });
}

export const db = admin.database();

