import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function main() {
  console.log('Fetching classes...');
  const classesSnap = await getDocs(collection(db, 'classes'));
  console.log(`Found ${classesSnap.size} classes:`);
  for (const cDoc of classesSnap.docs) {
    const classData = cDoc.data();
    console.log(`\n--- Class ${cDoc.id} (${classData.className}) ---`);
    console.log(`Current Round: ${classData.currentRound}, Total Rounds: ${classData.totalRounds}, Deposit Rate: ${classData.depositInterestRate}`);
    console.log(`Stocks:`, classData.stocks?.map((s: any) => `${s.name}: ${s.currentPrice}원`));

    // Students
    const studentsSnap = await getDocs(collection(db, 'classes', cDoc.id, 'students'));
    console.log(`Students count: ${studentsSnap.size}`);
    studentsSnap.docs.slice(0, 5).forEach(sDoc => {
      const s = sDoc.data();
      console.log(`  Student ${sDoc.id} (${s.number}번 ${s.name}): cash=${s.cash}, savings=${s.savings}, stocks=${JSON.stringify(s.stockShares)}, coupons=${s.couponsOwned?.length || 0}`);
      if (s.roundHistory) {
        console.log(`    roundHistory:`, JSON.stringify(s.roundHistory));
      } else {
        console.log(`    roundHistory: NONE`);
      }
    });

    // Transactions
    const txSnap = await getDocs(collection(db, 'classes', cDoc.id, 'transactions'));
    console.log(`Transactions count: ${txSnap.size}`);
    txSnap.docs.forEach(tDoc => {
      const t = tDoc.data();
      console.log(`  Tx [${t.id || tDoc.id}]: studentId="${t.studentId}", name="${t.studentName}", type=${t.type}, amount=${t.amount}, desc="${t.description}", time=${t.timestamp}`);
    });
  }
}

main().catch(console.error);
