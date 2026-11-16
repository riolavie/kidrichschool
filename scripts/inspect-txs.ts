import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function main() {
  const classId = 'C-26061';
  const cDoc = await getDoc(doc(db, 'classes', classId));
  console.log(`Class ${classId}:`, cDoc.data());

  const txSnap = await getDocs(collection(db, 'classes', classId, 'transactions'));
  console.log(`Total transactions in ${classId}: ${txSnap.size}`);
  const txList = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Group by student
  const byStudent: Record<string, any[]> = {};
  txList.forEach((t: any) => {
    const key = t.studentName || t.studentId || 'unknown';
    if (!byStudent[key]) byStudent[key] = [];
    byStudent[key].push(t);
  });

  console.log('Students with transactions:');
  for (const [sKey, txs] of Object.entries(byStudent)) {
    console.log(`\n=== Student: ${sKey} (${txs.length} transactions) ===`);
    txs.forEach((t: any) => {
      console.log(`  [${t.timestamp}] [${t.type}] amount=${t.amount} | ${t.description} (studentId=${t.studentId})`);
    });
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
