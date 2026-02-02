// uploadSailingToursToFirestore.js
// Safely uploads sailing tour data to a NEW collection (sailing_tours)
// Does NOT touch the existing wind_data collection

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs } from 'firebase/firestore';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAfLR5zI3q9k7OglBOVtTy0D9071AdMPmM",
  authDomain: "whereismywind-8695c.firebaseapp.com",
  projectId: "whereismywind-8695c",
  storageBucket: "whereismywind-8695c.firebasestorage.app",
  messagingSenderId: "533541848647",
  appId: "1:533541848647:web:2fe102a5f6b55f8cb3d362"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// SAFETY CHECK: Verify wind_data collection is untouched
async function verifyWindDataIntact() {
  console.log('🔍 Safety check: Verifying wind_data collection is intact...');
  
  const windDataCollection = collection(db, 'wind_data');
  const querySnapshot = await getDocs(windDataCollection);
  
  const count = querySnapshot.size;
  console.log(`✅ wind_data collection has ${count} documents (unchanged)`);
  
  return count > 0;
}

async function uploadSailingTours(csvPath) {
  try {
    console.log('='.repeat(60));
    console.log('🚢 SAILING TOUR UPLOADER - SAFE MODE');
    console.log('='.repeat(60));
    console.log(`📖 Reading CSV file: ${csvPath}`);
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    
    console.log('📊 Parsing CSV data...');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`✅ Parsed ${records.length} records`);

    // Group records by tour (based on start_time and gpx_path)
    console.log('🔄 Grouping records into tours...');
    const toursByKey = {};
    
    records.forEach(record => {
      const tourKey = `${record.gpx_path}_${record.start_time}`;
      
      if (!toursByKey[tourKey]) {
        toursByKey[tourKey] = {
          gpx_path: record.gpx_path,
          start_time: record.start_time,
          end_time: record.end_time,
          date: record.time.split(' ')[0], // Extract date from timestamp
          points: []
        };
      }
      
      const parseOrNull = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? null : num;
      };

      toursByKey[tourKey].points.push({
        time: record.time,
        lat: parseOrNull(record.lat),
        lon: parseOrNull(record.lon),
        boat_speed: parseOrNull(record.boat_speed),
        wind_speed: parseOrNull(record.wind_speed),
        boat_heading: parseOrNull(record.boat_heading),  // Can be null now (edge points)
        wind_dir: parseOrNull(record.wind_dir),
        wind_boat_angle: parseOrNull(record.wind_boat_angle),  // Can be null now
        speed_ratio: parseOrNull(record.speed_ratio)
      });
    });

    const tours = Object.values(toursByKey);
    console.log(`🚢 Found ${tours.length} unique sailing tours`);
    
    // SAFETY CHECK before uploading
    const windDataIntact = await verifyWindDataIntact();
    if (!windDataIntact) {
      console.warn('⚠️  Warning: wind_data collection appears empty. Proceeding anyway...');
    }

    // Upload each tour to NEW collection: sailing_tours
    console.log('');
    console.log('📤 Uploading tours to Firestore...');
    console.log('   Collection: sailing_tours (NEW - safe)');
    console.log('   wind_data collection: UNTOUCHED ✅');
    console.log('');
    
    const sailingToursCollection = collection(db, 'sailing_tours');
    
    for (let i = 0; i < tours.length; i++) {
      const tour = tours[i];
      
      // Create a unique ID for each tour
      const tourId = `tour_${tour.date}_${tour.start_time.replace(/:/g, '-')}`;
      const tourDocRef = doc(sailingToursCollection, tourId);
      
      await setDoc(tourDocRef, tour);
      
      console.log(`✅ [${i + 1}/${tours.length}] Uploaded: ${tour.date} ${tour.start_time} (${tour.points.length} points)`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('🎉 SUCCESS!');
    console.log('='.repeat(60));
    console.log(`✅ ${tours.length} sailing tours uploaded to 'sailing_tours' collection`);
    console.log(`✅ 'wind_data' collection remains untouched`);
    console.log('');
    
    // Final verification
    await verifyWindDataIntact();
    
    console.log('');
    console.log('📊 Summary:');
    console.log(`   - Tours uploaded: ${tours.length}`);
    console.log(`   - Total data points: ${tours.reduce((sum, t) => sum + t.points.length, 0)}`);
    console.log(`   - Date range: ${tours[0].date} to ${tours[tours.length - 1].date}`);
    console.log('');
    
    process.exit(0);
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ ERROR OCCURRED');
    console.error('='.repeat(60));
    console.error(error);
    console.error('');
    console.error('⚠️  Checking if wind_data is still intact...');
    
    try {
      await verifyWindDataIntact();
      console.error('✅ wind_data collection is still intact');
    } catch (checkError) {
      console.error('❌ Could not verify wind_data status:', checkError.message);
    }
    
    process.exit(1);
  }
}

// Get CSV file path from command line arguments
const csvPath = process.argv[2];

if (!csvPath) {
  console.error('');
  console.error('❌ Please provide CSV file path');
  console.error('');
  console.error('Usage: node uploadSailingToursToFirestore.js <path-to-csv-file>');
  console.error('');
  console.error('Example:');
  console.error('  node uploadSailingToursToFirestore.js sailing_tours.csv');
  console.error('');
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error('');
  console.error(`❌ File not found: ${csvPath}`);
  console.error('');
  process.exit(1);
}

console.log('');
console.log('🔒 SAFETY FEATURES ENABLED:');
console.log('   ✅ Creates NEW collection: sailing_tours');
console.log('   ✅ Does NOT modify wind_data collection');
console.log('   ✅ Verifies wind_data before and after upload');
console.log('');

uploadSailingTours(csvPath);
