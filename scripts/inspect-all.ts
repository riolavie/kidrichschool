import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function main() {
  const classesSnap = await getDocs(collection(db, 'classes'));
  for (const cDoc of classesSnap.docs) {
    const classData = cDoc.data();
    console.log(`\n========================================`);
    console.log(`Class ID: ${cDoc.id}, Name: ${classData.className}, Round: ${classData.currentRound}`);
    
    const txSnap = await getDocs(collection(db, 'classes', cDoc.id, 'transactions'));
    console.log(`Transactions in ${cDoc.id}: ${txSnap.size}`);
    if (txSnap.size > 0) {
      console.log('Sample transactions:');
      txSnap.docs.slice(0, 15).forEach(t => console.log(' ', JSON.stringify(t.data())));
    }

    const studentsSnap = await getDocs(collection(db, 'classes', cDoc.id, 'students'));
    console.log(`Students in ${cDoc.id}: ${studentsSnap.size}`);
    studentsSnap.docs.slice(0, 5).forEach(s => {
      const d = s.data();
      console.log(`  Student ${s.id} (${d.number}번 ${d.name}): cash=${d.cash}, savings=${d.savings}, stocks=${JSON.stringify(d.stockShares)}, roundHistory=${JSON.stringify(d.roundHistory)}`);
    });
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
