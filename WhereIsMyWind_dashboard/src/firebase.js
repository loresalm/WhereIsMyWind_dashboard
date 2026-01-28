// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
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
      const docId = doc.id;
      
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

// ============ SAILING PERFORMANCE FUNCTIONS ============

/**
 * Load sailing performance points from Firebase
 * These contain pre-aggregated performance data with angle bins and speed ratios
 * @returns {Promise<Array>} Array of sailing performance point objects
 */
export async function loadSailingPerformancePoints() {
  try {
    console.log('🔄 Loading sailing performance points from Firestore...');
    
    const performanceRef = collection(db, 'sailing_performance_points');
    const snapshot = await getDocs(performanceRef);
    
    const points = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Validate the point has required data
      if (data.lat !== undefined && data.lon !== undefined && data.angle_bin !== undefined) {
        points.push({
          id: doc.id,
          angle_bin: data.angle_bin,
          boat_heading: data.boat_heading || 0,
          boat_speed: data.boat_speed || 0,
          date: data.date || '',
          end_time: data.end_time || '',
          gpx_path: data.gpx_path || '',
          lat: data.lat,
          lon: data.lon,
          speed_ratio: data.speed_ratio || 0,
          start_time: data.start_time || '',
          wind_boat_angle: data.wind_boat_angle || 0,
          wind_dir: data.wind_dir || 0,
          wind_speed: data.wind_speed || 0
        });
      }
    });
    
    console.log(`✅ Loaded ${points.length} sailing performance points from Firestore`);
    return points;
  } catch (error) {
    console.error('❌ Error loading sailing performance points:', error);
    throw error;
  }
}

export { db };