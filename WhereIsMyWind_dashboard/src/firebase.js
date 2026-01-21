// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Load all wind data from Firestore
 * @returns {Promise<Array>} Array of wind data records
 */
export async function loadWindData() {
  try {
    console.log('🔄 Loading data from Firestore...');
    
    // Get all documents from the wind_data collection
    const windDataCollection = collection(db, 'wind_data');
    const querySnapshot = await getDocs(windDataCollection);
    
    const data = [];
    
    querySnapshot.forEach((doc) => {
      const dateData = doc.data();
      const docId = doc.id; // This should be the date like "2026-01-07"
      
      console.log(`📅 Processing document: ${docId}`, dateData);
      
      if (dateData && dateData.records) {
        // Handle both array and object formats for records
        const records = Array.isArray(dateData.records) 
          ? dateData.records 
          : Object.values(dateData.records);
        
        records.forEach(record => {
          // Skip empty or invalid records
          if (record && record.Time) {
            data.push({
              date: dateData.date || docId,
              location: dateData.location || 'wannsee',
              Time: record.Time,
              'Wind Direction': record['Wind Direction'],
              'Wind Speed (kts)': parseFloat(record['Wind Speed (kts)']) || 0,
              'Wind Gusts (kts)': parseFloat(record['Wind Gusts (kts)']) || 0,
              Temperature: parseFloat(record.Temperature) || 0
            });
          }
        });
      }
    });
    
    console.log(`✅ Loaded ${data.length} wind data records from Firestore`);
    return data;
    
  } catch (error) {
    console.error('❌ Error loading Firestore data:', error);
    console.error('Error details:', error.message);
    throw error;
  }
}

/**
 * Generate mock data for development/testing
 * @returns {Array} Array of mock wind data records
 */
export function generateMockData() {
  const data = [];
  const start = new Date('2025-05-10');
  const end = new Date('2026-01-20');
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    for (let hour = 0; hour < 24; hour++) {
      data.push({
        date: d.toISOString().split('T')[0],
        location: 'wannsee',
        Time: `${hour.toString().padStart(2, '0')}:00`,
        'Wind Direction': `${Math.floor(Math.random() * 360)}°`,
        'Wind Speed (kts)': parseFloat((Math.random() * 20).toFixed(1)),
        'Wind Gusts (kts)': parseFloat((Math.random() * 30).toFixed(1)),
        Temperature: parseFloat((Math.random() * 30 - 10).toFixed(1))
      });
    }
  }
  
  console.log(`📊 Generated ${data.length} mock data records`);
  return data;
}

export { db };