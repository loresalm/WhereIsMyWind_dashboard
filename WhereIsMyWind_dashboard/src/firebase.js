// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

// ============ WIND DATA FUNCTIONS ============

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

// ============ SAILING TOUR FUNCTIONS ============

/**
 * Load all sailing tours from Firestore
 * @returns {Promise<Array>} Array of sailing tour objects
 */
export async function loadSailingTours() {
  try {
    console.log('🔄 Loading sailing tours from Firestore...');
    
    const sailingToursCollection = collection(db, 'sailing_tours');
    const querySnapshot = await getDocs(sailingToursCollection);
    
    const tours = [];
    
    querySnapshot.forEach((doc) => {
      const tourData = doc.data();
      tours.push({
        id: doc.id,
        ...tourData
      });
    });
    
    console.log(`✅ Loaded ${tours.length} sailing tours from Firestore`);
    return tours;
    
  } catch (error) {
    console.error('❌ Error loading sailing tours:', error);
    console.error('Error details:', error.message);
    throw error;
  }
}

/**
 * Get sailing tour dates and groupings
 * @returns {Promise<{minDate: string, maxDate: string, dateGroups: Array}>}
 */
export async function getSailingTourDates() {
  try {
    const tours = await loadSailingTours();
    
    if (tours.length === 0) {
      console.warn('⚠️ No sailing tours found in Firestore');
      return {
        minDate: null,
        maxDate: null,
        dateGroups: []
      };
    }

    const dates = tours.map(tour => new Date(tour.date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    // Group tours by date
    const dateGroups = {};
    tours.forEach(tour => {
      if (!dateGroups[tour.date]) {
        dateGroups[tour.date] = {
          date: tour.date,
          tours: []
        };
      }
      dateGroups[tour.date].tours.push({
        id: tour.id,
        start_time: tour.start_time,
        end_time: tour.end_time,
        points: tour.points?.length || 0
      });
    });
    
    const sortedDateGroups = Object.values(dateGroups).sort((a, b) => 
      a.date.localeCompare(b.date)
    );
    
    console.log(`✅ Sailing tour date range: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`);
    console.log(`✅ Found ${sortedDateGroups.length} unique dates with tours`);
    
    return {
      minDate: minDate.toISOString().split('T')[0],
      maxDate: maxDate.toISOString().split('T')[0],
      dateGroups: sortedDateGroups
    };
  } catch (error) {
    console.error('Error getting sailing tour dates:', error);
    return {
      minDate: null,
      maxDate: null,
      dateGroups: []
    };
  }
}

// ============ MOCK DATA FUNCTIONS ============

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

/**
 * Generate mock sailing tours for testing
 * @returns {Array} Array of mock sailing tour objects
 */
export function generateMockSailingTours() {
  console.log('📝 Generating mock sailing tours...');
  const mockTours = [];
  const startDate = new Date('2025-10-01');
  
  // Generate 10 mock tours
  for (let i = 0; i < 10; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + Math.floor(i / 2)); // 2 tours per day
    
    const startHour = 14 + (i % 2) * 2;
    const points = [];
    
    // Generate tour path (spiral around Wannsee)
    const centerLat = 52.43769983;
    const centerLon = 13.17099437;
    const numPoints = 50 + Math.floor(Math.random() * 30);
    
    for (let j = 0; j < numPoints; j++) {
      const angle = (j / numPoints) * Math.PI * 4;
      const radius = 0.002 * (1 + j / numPoints);
      
      points.push({
        time: `${date.toISOString().split('T')[0]} ${startHour}:${j.toString().padStart(2, '0')}:00`,
        lat: centerLat + Math.sin(angle) * radius,
        lon: centerLon + Math.cos(angle) * radius,
        boat_speed: 0.5 + Math.random() * 1.5,
        wind_speed: 3 + Math.random() * 5,
        boat_heading: (angle * 180 / Math.PI) % 360,
        wind_dir: 30 + Math.random() * 60,
        wind_boat_angle: Math.random() * 90,
        speed_ratio: 0.1 + Math.random() * 0.3
      });
    }
    
    mockTours.push({
      id: `mock_tour_${i}`,
      date: date.toISOString().split('T')[0],
      start_time: `${startHour}:00:00`,
      end_time: `${startHour + 1}:00:00`,
      gpx_path: `mock_tour_${i}.gpx`,
      points
    });
  }
  
  console.log(`✅ Generated ${mockTours.length} mock sailing tours`);
  return mockTours;
}

/**
 * Get mock sailing tour date range
 * @returns {Object} Mock sailing tour date range
 */
export function getMockSailingDateRange() {
  const tours = generateMockSailingTours();
  const dates = tours.map(t => new Date(t.date));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  
  const dateGroups = {};
  tours.forEach(tour => {
    if (!dateGroups[tour.date]) {
      dateGroups[tour.date] = {
        date: tour.date,
        tours: []
      };
    }
    dateGroups[tour.date].tours.push({
      id: tour.id,
      start_time: tour.start_time,
      end_time: tour.end_time,
      points: tour.points.length
    });
  });
  
  return {
    minDate: minDate.toISOString().split('T')[0],
    maxDate: maxDate.toISOString().split('T')[0],
    dateGroups: Object.values(dateGroups).sort((a, b) => a.date.localeCompare(b.date))
  };
}

export { db };