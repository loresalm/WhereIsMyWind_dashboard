// downloadWindData.js
// Downloads all wind data from Firestore wind_data collection to CSV file
// Safe read-only operation - does NOT modify any data

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import { stringify } from 'csv-stringify/sync';

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

async function downloadWindData(outputPath) {
  try {
    console.log('='.repeat(60));
    console.log('💨 WIND DATA DOWNLOADER - READ-ONLY MODE');
    console.log('='.repeat(60));
    console.log('');
    console.log('🔍 Fetching wind data from Firestore...');
    console.log('   Collection: wind_data');
    console.log('   Operation: READ-ONLY (safe)');
    console.log('');
    
    // Get all documents from the wind_data collection
    const windDataCollection = collection(db, 'wind_data');
    const querySnapshot = await getDocs(windDataCollection);
    
    console.log(`✅ Found ${querySnapshot.size} documents in wind_data collection`);
    console.log('');
    console.log('📊 Processing records...');
    
    const allRecords = [];
    let totalRecords = 0;
    
    querySnapshot.forEach((doc) => {
      const dateData = doc.data();
      const docId = doc.id; // This should be the date like "2026-01-07"
      
      if (dateData && dateData.records) {
        // Handle both array and object formats for records
        const records = Array.isArray(dateData.records) 
          ? dateData.records 
          : Object.values(dateData.records);
        
        records.forEach(record => {
          // Skip empty or invalid records
          if (record && record.Time) {
            allRecords.push({
              date: dateData.date || docId,
              location: dateData.location || 'wannsee',
              time: record.Time,
              wind_direction: record['Wind Direction'],
              wind_speed_kts: parseFloat(record['Wind Speed (kts)']) || 0,
              wind_gusts_kts: parseFloat(record['Wind Gusts (kts)']) || 0,
              temperature: parseFloat(record.Temperature) || 0
            });
            totalRecords++;
          }
        });
        
        console.log(`   📅 ${docId}: ${records.length} records`);
      }
    });
    
    if (allRecords.length === 0) {
      console.log('');
      console.log('⚠️  No records found to export');
      process.exit(0);
    }
    
    console.log('');
    console.log(`✅ Processed ${totalRecords} total records`);
    console.log('');
    console.log('💾 Converting to CSV format...');
    
    // Convert to CSV
    const csv = stringify(allRecords, {
      header: true,
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'location', header: 'Location' },
        { key: 'time', header: 'Time' },
        { key: 'wind_direction', header: 'Wind Direction' },
        { key: 'wind_speed_kts', header: 'Wind Speed (kts)' },
        { key: 'wind_gusts_kts', header: 'Wind Gusts (kts)' },
        { key: 'temperature', header: 'Temperature' }
      ]
    });
    
    console.log('💾 Writing to file...');
    console.log(`   Output: ${outputPath}`);
    
    // Write to file
    fs.writeFileSync(outputPath, csv);
    
    const fileSize = (fs.statSync(outputPath).size / 1024).toFixed(2);
    
    console.log('');
    console.log('='.repeat(60));
    console.log('🎉 SUCCESS!');
    console.log('='.repeat(60));
    console.log('');
    console.log('📊 Export Summary:');
    console.log(`   - Records exported: ${totalRecords}`);
    console.log(`   - Unique dates: ${querySnapshot.size}`);
    console.log(`   - File size: ${fileSize} KB`);
    console.log(`   - Output file: ${outputPath}`);
    console.log('');
    console.log('📁 CSV Columns:');
    console.log('   1. Date - Date of the record (YYYY-MM-DD)');
    console.log('   2. Location - Location name (e.g., wannsee)');
    console.log('   3. Time - Time of day (HH:MM)');
    console.log('   4. Wind Direction - Direction in degrees or compass');
    console.log('   5. Wind Speed (kts) - Wind speed in knots');
    console.log('   6. Wind Gusts (kts) - Wind gust speed in knots');
    console.log('   7. Temperature - Temperature reading');
    console.log('');
    console.log('✅ You can now open the file in Excel, Google Sheets, or any CSV viewer');
    console.log('');
    
    // Calculate some basic statistics
    const dates = [...new Set(allRecords.map(r => r.date))].sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const avgWindSpeed = (allRecords.reduce((sum, r) => sum + r.wind_speed_kts, 0) / allRecords.length).toFixed(2);
    const maxWindSpeed = Math.max(...allRecords.map(r => r.wind_speed_kts)).toFixed(2);
    
    console.log('📈 Data Statistics:');
    console.log(`   - Date range: ${minDate} to ${maxDate}`);
    console.log(`   - Average wind speed: ${avgWindSpeed} kts`);
    console.log(`   - Maximum wind speed: ${maxWindSpeed} kts`);
    console.log('');
    
    process.exit(0);
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ ERROR OCCURRED');
    console.error('='.repeat(60));
    console.error('');
    console.error('Error details:', error.message);
    console.error('');
    
    if (error.code === 'permission-denied') {
      console.error('💡 Tip: Check your Firestore security rules');
      console.error('   Make sure read access is enabled for wind_data collection');
    }
    
    console.error('');
    process.exit(1);
  }
}

// Get output file path from command line or use default
const outputPath = process.argv[2] || 'wind_data_export.csv';

console.log('');
console.log('🔒 READ-ONLY OPERATION:');
console.log('   ✅ Only reads data from Firestore');
console.log('   ✅ Does NOT modify any data');
console.log('   ✅ Safe to run anytime');
console.log('');

downloadWindData(outputPath);
