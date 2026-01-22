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
 * Get the available date range from Firestore
 * @returns {Promise<{minDate: string, maxDate: string, availableDates: string[]}>}
 */
export async function getAvailableDateRange() {
  try {
    console.log('🔄 Fetching available date range from Firestore...');
    
    const windDataCollection = collection(db, 'wind_data');
    const querySnapshot = await getDocs(windDataCollection);
    
    const dates = [];
    querySnapshot.forEach((doc) => {
      const docId = doc.id;
      const dateData = doc.data();
      
      // Use the document ID as the date (format: YYYY-MM-DD)
      // or fall back to the date field in the data
      const dateStr = dateData.date || docId;
      
      // Validate it's a proper date format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        dates.push(dateStr);
      }
    });
    
    if (dates.length === 0) {
      console.warn('⚠️ No valid dates found in Firestore');
      return { minDate: null, maxDate: null, availableDates: [] };
    }
    
    // Sort dates to find min and max
    dates.sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    
    console.log(`✅ Available date range: ${minDate} to ${maxDate} (${dates.length} dates)`);
    
    return {
      minDate,
      maxDate,
      availableDates: dates
    };
    
  } catch (error) {
    console.error('❌ Error fetching date range:', error);
    throw error;
  }
}

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

/**
 * Get mock date range for development/testing
 * @returns {Object} Mock date range
 */
export function getMockDateRange() {
  return {
    minDate: '2025-05-10',
    maxDate: '2026-01-20',
    availableDates: generateMockAvailableDates('2025-05-10', '2026-01-20')
  };
}

/**
 * Generate array of dates between start and end
 * @param {string} start - Start date YYYY-MM-DD
 * @param {string} end - End date YYYY-MM-DD
 * @returns {string[]} Array of date strings
 */
function generateMockAvailableDates(start, end) {
  const dates = [];
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  
  return dates;
}

export { db };