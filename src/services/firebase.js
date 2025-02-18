import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const syncTable = async (tableCode, data) => {
  try {
    console.log('🔼 Pushing data to cloud:', { tableCode, data });
    await setDoc(doc(db, 'tables', tableCode), data);
    console.log('✅ Successfully pushed data to cloud');
    return true;
  } catch (error) {
    console.error('❌ Error syncing table:', error);
    return false;
  }
};

export const getTableData = async (tableCode) => {
  try {
    console.log('🔽 Getting data from cloud:', { tableCode });
    const docRef = doc(db, 'tables', tableCode);
    const docSnap = await getDoc(docRef);
    const data = docSnap.exists() ? docSnap.data() : null;
    console.log('✅ Received data from cloud:', data);
    return data;
  } catch (error) {
    console.error('❌ Error getting table data:', error);
    return null;
  }
};

export const subscribeToTable = (tableCode, callback) => {
  const docRef = doc(db, 'tables', tableCode);
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    }
  });
}; 