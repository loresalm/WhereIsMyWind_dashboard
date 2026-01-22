<script>
  import { onMount } from 'svelte';
  import { loadWindData, generateMockData, getAvailableDateRange, getMockDateRange } from './firebase.js';
  import WindRose from './WindRose.svelte';
  import FilterControls from './FilterControls.svelte';

  // State variables
  let windData = [];
  let selectedDays = [0, 1, 2, 3, 4, 5, 6]; // All days selected by default
  let startDate = '';
  let endDate = '';
  let startHour = 1;
  let endHour = 18;
  let loading = false;
  let useMockData = false; // Set to true to use mock data

  // Date range from Firebase
  let minAvailableDate = null;
  let maxAvailableDate = null;
  let availableDates = [];

  // Map will be loaded after component mounts
  let mapLoaded = false;

  // Visualization mode toggle
  let visualizationMode = 'aggregate'; // 'aggregate' or 'hourly'

  // Computed filtered data
  $: filteredData = windData.filter(record => {
    const recordDate = new Date(record.date);
    const recordDay = recordDate.getDay();
    const recordHour = parseInt(record.Time?.split(':')[0] || 0);
    
    return selectedDays.includes(recordDay) &&
           recordDate >= new Date(startDate) &&
           recordDate <= new Date(endDate) &&
           recordHour >= startHour &&
           recordHour <= endHour;
  });

  // Statistics
  $: stats = calculateStats(filteredData);
  $: windRoseData = calculateWindRose(filteredData);
  $: hourlyWindData = calculateHourlyWindRose(filteredData);
  
  // Format selected days for display
  $: selectedDayNames = selectedDays
    .sort((a, b) => a - b)
    .map(i => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i])
    .join(', ');

  function calculateStats(data) {
    if (data.length === 0) return { 
      avg: 0, 
      max: 0, 
      records: 0, 
      scale: [0, 0, 0],
      mainDirection: 'N/A',
      mainDirectionDegrees: 0
    };

    const speeds = data.map(r => r['Wind Speed (kts)'] || 0);
    const max = Math.max(...speeds);

    // Calculate main wind direction
    const directions = data.map(r => {
      const dirStr = r['Wind Direction'];
      return parseInt(dirStr);
    }).filter(d => !isNaN(d));

    let mainDirectionDegrees = 0;
    if (directions.length > 0) {
      // Calculate average direction (circular mean)
      const sinSum = directions.reduce((sum, deg) => sum + Math.sin(deg * Math.PI / 180), 0);
      const cosSum = directions.reduce((sum, deg) => sum + Math.cos(deg * Math.PI / 180), 0);
      mainDirectionDegrees = Math.round((Math.atan2(sinSum, cosSum) * 180 / Math.PI + 360) % 360);
    }

    // Convert degrees to compass direction
    const compassDirections = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(mainDirectionDegrees / 22.5) % 16;
    const mainDirection = compassDirections[index];

    return {
      avg: (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1),
      max: max.toFixed(1),
      records: data.length,
      scale: [
        (max * 0.33).toFixed(1),
        (max * 0.66).toFixed(1),
        max.toFixed(1)
      ],
      mainDirection,
      mainDirectionDegrees
    };
  }

  function calculateWindRose(data) {
    const directions = 16;
    const buckets = new Array(directions).fill(0);
    
    data.forEach(record => {
      const dirStr = record['Wind Direction'];
      const dir = parseInt(dirStr);
      if (!isNaN(dir)) {
        const bucket = Math.floor(((dir + 11.25) % 360) / 22.5);
        buckets[bucket]++;
      }
    });
    
    const max = Math.max(...buckets, 1);
    return buckets.map(count => count / max);
  }

  function calculateHourlyWindRose(data) {
    const directions = 16;
    const hourlyData = [];
    
    // Group data by hour
    for (let hour = startHour; hour <= endHour; hour++) {
      const hourData = data.filter(record => {
        const recordHour = parseInt(record.Time?.split(':')[0] || 0);
        return recordHour === hour;
      });
      
      if (hourData.length === 0) {
        hourlyData.push({
          hour,
          buckets: new Array(directions).fill(0),
          avgSpeed: 0,
          maxSpeed: 0,
          count: 0
        });
        continue;
      }
      
      // Calculate direction distribution
      const buckets = new Array(directions).fill(0);
      let totalSpeed = 0;
      let maxSpeed = 0;
      
      hourData.forEach(record => {
        const dirStr = record['Wind Direction'];
        const dir = parseInt(dirStr);
        const speed = parseFloat(record['Wind Speed (kts)']) || 0;
        
        if (!isNaN(dir)) {
          const bucket = Math.floor(((dir + 11.25) % 360) / 22.5);
          buckets[bucket]++;
        }
        
        totalSpeed += speed;
        maxSpeed = Math.max(maxSpeed, speed);
      });
      
      const max = Math.max(...buckets, 1);
      
      hourlyData.push({
        hour,
        buckets: buckets.map(count => count / max),
        avgSpeed: (totalSpeed / hourData.length).toFixed(1),
        maxSpeed: maxSpeed.toFixed(1),
        count: hourData.length
      });
    }
    
    return hourlyData;
  }

  async function loadDateRange() {
    try {
      let dateRange;
      
      if (useMockData) {
        dateRange = getMockDateRange();
      } else {
        dateRange = await getAvailableDateRange();
      }
      
      minAvailableDate = dateRange.minDate;
      maxAvailableDate = dateRange.maxDate;
      availableDates = dateRange.availableDates;
      
      // Set initial date range if not set
      if (!startDate && minAvailableDate) {
        startDate = minAvailableDate;
      }
      if (!endDate && maxAvailableDate) {
        endDate = maxAvailableDate;
      }
      
      console.log('📅 Date range loaded:', { minAvailableDate, maxAvailableDate, count: availableDates.length });
      
    } catch (error) {
      console.error('Error loading date range:', error);
      // Set fallback dates
      const fallbackRange = getMockDateRange();
      minAvailableDate = fallbackRange.minDate;
      maxAvailableDate = fallbackRange.maxDate;
      availableDates = fallbackRange.availableDates;
      startDate = minAvailableDate;
      endDate = maxAvailableDate;
    }
  }

  async function loadData() {
    loading = true;
    
    try {
      if (useMockData) {
        windData = generateMockData();
      } else {
        windData = await loadWindData();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      console.log('Falling back to mock data');
      windData = generateMockData();
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    // Load date range first
    await loadDateRange();
    
    // Then load wind data
    await loadData();
    
    // Load Leaflet CSS and JS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      initMap();
    };
    document.head.appendChild(script);
  });

  function initMap() {
    // Wannsee coordinates
    const wannseeCenter = [52.442616, 13.164234]; // Latitude, Longitude

    const map = window.L.map('map', {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false
    }).setView(wannseeCenter, 14);

    // Use OpenStreetMap tiles with black & white style
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      className: 'map-tiles'
    }).addTo(map);

    mapLoaded = true;
  }
</script>

<div class="app-container">
  <header class="header">
    <h1>Wannsee Wind</h1>
    <p>Wind Data Visualization • Berlin</p>
    {#if useMockData}
      <p class="mock-indicator">Using mock data</p>
    {/if}
  </header>
  
  <!-- Compact Filter Controls Card -->
  <div class="glass-card filter-card">
    <FilterControls 
      bind:selectedDays
      bind:startDate
      bind:endDate
      bind:startHour
      bind:endHour
      bind:minAvailableDate
      bind:maxAvailableDate
      bind:availableDates
    />
  </div>

  <!-- Map and Stats Card -->
  <div class="glass-card map-card">
    <!-- Descriptive Summary -->
    <div class="data-summary">
      Showing wind data from <strong>{startDate}</strong> to <strong>{endDate}</strong>, 
      between <strong>{startHour}:00</strong> and <strong>{endHour}:00</strong>
      {#if selectedDays.length === 7}
        on <strong>all days</strong>
      {:else if selectedDays.length === 0}
        with <strong>no days selected</strong>
      {:else}
        on <strong>{selectedDayNames}</strong>
      {/if}
    </div>

    <div class="map-container">
      <div id="map" class="map"></div>
      
      <!-- Visualization Mode Toggle -->
      <div class="viz-toggle">
        <button 
          class="toggle-btn"
          class:active={visualizationMode === 'aggregate'}
          on:click={() => visualizationMode = 'aggregate'}
        >
          Average
        </button>
        <button 
          class="toggle-btn"
          class:active={visualizationMode === 'hourly'}
          on:click={() => visualizationMode = 'hourly'}
        >
          Hourly
        </button>
      </div>
      
      <div class="wind-rose-overlay">
        {#if loading}
          <div class="loading">Loading wind data...</div>
        {:else}
          <WindRose
            data={windRoseData}
            hourlyData={hourlyWindData}
            mode={visualizationMode}
            scaleLabels={stats.scale}
          />
        {/if}
      </div>
    </div>
    
    <div class="stats-container">
      <div class="stat-item">
        <div class="stat-value">{stats.avg}</div>
        <div class="stat-label">Avg Speed</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{stats.max}</div>
        <div class="stat-label">Max Speed</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{stats.mainDirection}</div>
        <div class="stat-label">Main Direction</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{stats.records}</div>
        <div class="stat-label">Data Points</div>
      </div>
    </div>
  </div>
</div>

<style>
  :root {
    --glass-bg: rgba(255, 255, 255, 0.08);
    --glass-border: rgba(255, 255, 255, 0.18);
    --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
    --text-primary: #ffffff;
    --text-secondary: rgba(255, 255, 255, 0.562);
  }

  .app-container {
    position: relative;
    z-index: 1;
    padding: 2rem 1rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
    animation: fadeIn 0.8s ease;
  }

  .header h1 {
    font-size: clamp(2rem, 8vw, 3.5rem);
    font-weight: 300;
    letter-spacing: -0.02em;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.6) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .header p {
    font-size: 0.9rem;
    color: var(--text-secondary);
    font-weight: 300;
  }

  .mock-indicator {
    font-size: 0.75rem;
    color: rgba(255, 200, 100, 0.8);
    margin-top: 0.5rem;
  }

  .glass-card {
    background: var(--glass-bg);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-radius: 24px;
    border: 1px solid var(--glass-border);
    box-shadow: var(--glass-shadow);
    animation: slideUp 0.6s ease;
  }

  .filter-card {
    padding: 1rem 1.5rem;
    margin-bottom: 1rem;
  }

  .map-card {
    padding: 0;
    overflow: hidden;
  }

  .data-summary {
    padding: 1rem 1.5rem;
    font-size: 0.85rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.7);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background:rgba(255, 255, 255, 0.08);
  }

  .data-summary strong {
    color: var(--text-primary);
    font-weight: 500;
  }

  .map-container {
    position: relative;
    width: 100%;
    height: 600px;
    overflow: hidden;
  }

  .map {
    width: 100%;
    height: 100%;
    background: #0a1929;
  }

  .viz-toggle {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 1001;
    display: flex;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 0.25rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .toggle-btn {
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'Outfit', sans-serif;
  }

  .toggle-btn:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.05);
  }

  .toggle-btn.active {
    background: rgba(255, 255, 255, 0.9);
    color: #000;
  }

  .wind-rose-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(500px, 90%);
    height: min(500px, 90%);
    pointer-events: none;
    z-index: 1000;
  }

  .stats-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .stat-item {
    text-align: center;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.15rem;
    color: var(--text-primary);
  }

  .stat-label {
    font-size: 0.7rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 2rem;
    color: var(--text-primary);
    font-size: 1.1rem;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 16px;
    backdrop-filter: blur(10px);
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 768px) {
    .app-container {
      padding: 1rem 0.75rem;
    }

    .glass-card {
      border-radius: 20px;
    }

    .filter-card {
      padding: 0.75rem 1rem;
    }

    .data-summary {
      padding: 0.75rem 1rem;
      font-size: 0.75rem;
    }

    .map-container {
      height: 500px;
    }

    .wind-rose-overlay {
      width: 85%;
      height: 85%;
    }

    .stats-container {
      padding: 0.75rem 1rem;
      gap: 0.5rem;
    }

    .stat-value {
      font-size: 1.1rem;
    }

    .stat-label {
      font-size: 0.65rem;
    }
  }

  /* Leaflet attribution styling */
  :global(.leaflet-control-attribution) {
    background: rgba(0, 0, 0, 0.5) !important;
    color: rgba(255, 255, 255, 0.7) !important;
    font-size: 10px !important;
    padding: 2px 5px !important;
    border-radius: 4px !important;
  }

  :global(.leaflet-control-attribution a) {
    color: rgba(255, 255, 255, 0.9) !important;
  }
</style>