<script>
  import { onMount, onDestroy, tick } from 'svelte'; // ADDED: onDestroy and tick
  import { 
    loadWindData,
    getAvailableDateRange,
    loadSailingTours,
    getSailingTourDates,
    loadSailingPerformancePoints
  } from './firebase.js';
  import WindRose from './WindRose.svelte';
  import AngleRangeSelector from './AngleRangeSelector.svelte';
  import FilterControls from './FilterControls.svelte';
  import SailingTourSelector from './SailingTourSelector.svelte';
  import SailingMapView from './SailingMapView.svelte';

  // View mode toggle
  let viewMode = 'wind'; // 'wind' or 'sailing'

  // Wind data state
  let windData = [];
  let selectedDays = [0, 1, 2, 3, 4, 5, 6];
  let startDate = '';
  let endDate = '';
  let startHour = 1;
  let endHour = 18;
  let minAvailableDate = null;
  let maxAvailableDate = null;
  let availableDates = [];

  // Sailing tour state
  let sailingTours = [];
  let sailingDateGroups = [];
  let selectedTourIds = [];
  let sailingVizMode = 'individual'; 
  let selectedAngleRanges = [
  { min: 20, max: 30 },
  { min: 30, max: 40 }
];
  let sailingPerformancePoints = [];

  let windMap = null;
  let sailingMap = null;
  let windMapLoaded = false;
  let sailingMapLoaded = false;

  // NEW: Add initialization tracking
  let windMapInitialized = false;
  let sailingMapInitialized = false;

  // Shared state
  let loading = false;

  // Visualization mode for wind
  let visualizationMode = 'aggregate';

  // Wannsee center coordinates
  const wannseeCenter = [52.442616, 13.164234];
  const defaultZoom = 14;

  // Computed selected sailing tours
  $: selectedSailingTours = sailingTours.filter(tour => 
    selectedTourIds.includes(tour.id)
  );

  // Update map view when tours or mode changes
  $: if (sailingMap && viewMode === 'sailing') {
    updateSailingMapView();
  }

  // Computed filtered wind data
  $: filteredWindData = windData.filter(record => {
    const recordDate = new Date(record.date);
    const recordDay = recordDate.getDay();
    const recordHour = parseInt(record.Time?.split(':')[0] || 0);
    
    return selectedDays.includes(recordDay) &&
           recordDate >= new Date(startDate) &&
           recordDate <= new Date(endDate) &&
           recordHour >= startHour &&
           recordHour <= endHour;
  });

  // Wind statistics
  $: stats = calculateStats(filteredWindData);
  $: windRoseData = calculateWindRose(filteredWindData);
  $: hourlyWindData = calculateHourlyWindRose(filteredWindData);
  
  $: selectedDayNames = selectedDays
    .sort((a, b) => a - b)
    .map(i => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i])
    .join(', ');

  function initWindMap() {
    // Get the container element
    const container = document.getElementById('wind-map');
    if (!container) return;
    
    // Clean up existing map
    if (windMap) {
      try {
        windMap.remove();
      } catch(e) {
        // Ignore errors
      }
      windMap = null;
    }
    
    // Clear any existing tiles
    container.innerHTML = '';

    windMap = window.L.map(container, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false
    }).setView(wannseeCenter, defaultZoom);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(windMap);

    windMapLoaded = true;
    windMapInitialized = true;
  }

  function initSailingMap() {
    // Get the container element
    const container = document.getElementById('sailing-map');
    if (!container) return;
    
    // Clean up existing map
    if (sailingMap) {
      try {
        // Call cleanup from SailingMapView if available
        if (sailingMap.__cleanup) {
          sailingMap.__cleanup();
        }
        sailingMap.remove();
      } catch(e) {
        // Ignore errors
      }
      sailingMap = null;
    }
    
    // Clear any existing tiles
    container.innerHTML = '';

    sailingMap = window.L.map(container).setView(wannseeCenter, defaultZoom);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(sailingMap);

    sailingMapLoaded = true;
    sailingMapInitialized = true;
  }

  function cleanupMap(mapType) {
    if (mapType === 'wind' && windMap) {
      try {
        windMap.remove();
      } catch(e) {
        // Ignore errors
      }
      windMap = null;
      windMapLoaded = false;
      windMapInitialized = false;
    }
    
    if (mapType === 'sailing' && sailingMap) {
      try {
        if (sailingMap.__cleanup) {
          sailingMap.__cleanup();
        }
        sailingMap.remove();
      } catch(e) {
        // Ignore errors
      }
      sailingMap = null;
      sailingMapLoaded = false;
      sailingMapInitialized = false;
    }
  }

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

    const directions = data.map(r => {
      const dirStr = r['Wind Direction'];
      return parseInt(dirStr);
    }).filter(d => !isNaN(d));

    let mainDirectionDegrees = 0;
    if (directions.length > 0) {
      const sinSum = directions.reduce((sum, deg) => sum + Math.sin(deg * Math.PI / 180), 0);
      const cosSum = directions.reduce((sum, deg) => sum + Math.cos(deg * Math.PI / 180), 0);
      mainDirectionDegrees = Math.round((Math.atan2(sinSum, cosSum) * 180 / Math.PI + 360) % 360);
    }

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

  async function loadWindDateRange() {
    try {
      const dateRange = await getAvailableDateRange();
      
      minAvailableDate = dateRange.minDate;
      maxAvailableDate = dateRange.maxDate;
      availableDates = dateRange.availableDates;
      
      if (!startDate && minAvailableDate) {
        startDate = minAvailableDate;
      }
      if (!endDate && maxAvailableDate) {
        endDate = maxAvailableDate;
      }
      
    } catch (error) {
      console.error('Error loading wind date range:', error);
      minAvailableDate = null;
      maxAvailableDate = null;
      availableDates = [];
    }
  }

  async function loadWindDataAsync() {
    loading = true;
    
    try {
      windData = await loadWindData();
    } catch (error) {
      console.error('Error loading wind data:', error);
      windData = [];
    } finally {
      loading = false;
    }
  }

  async function loadSailingToursAsync() {
    loading = true;
    
    try {
      sailingTours = await loadSailingTours();
      const dateRange = await getSailingTourDates();
      sailingDateGroups = dateRange.dateGroups;
      
      // Auto-select the first tour so users see something immediately
      if (sailingTours.length > 0 && selectedTourIds.length === 0) {
        selectedTourIds = [sailingTours[0].id];
      }
    } catch (error) {
      console.error('Error loading sailing tours:', error);
      sailingTours = [];
      sailingDateGroups = [];
    } finally {
      loading = false;
    }
  }

  async function loadPerformancePointsAsync() {
    loading = true;
    
    try {
      sailingPerformancePoints = await loadSailingPerformancePoints();
    } catch (error) {
      console.error('Error loading performance points:', error);
      sailingPerformancePoints = [];
    } finally {
      loading = false;
    }
  }

  function updateSailingMapView() {
    if (!sailingMap) return;

    // If no tours selected and in individual mode, keep Wannsee center view
    if (sailingVizMode === 'individual' && selectedSailingTours.length === 0) {
      sailingMap.setView(wannseeCenter, defaultZoom);
    }
  }

  async function switchView(newMode) {
    // Clean up the previous map
    if (viewMode === 'wind' && newMode === 'sailing') {
      cleanupMap('wind');
    } else if (viewMode === 'sailing' && newMode === 'wind') {
      cleanupMap('sailing');
    }

    viewMode = newMode;

    if (newMode === 'sailing') {
      if (sailingTours.length === 0) {
        await loadSailingToursAsync();
      }
      if (sailingPerformancePoints.length === 0) {
        await loadPerformancePointsAsync();
      }

      // Wait for DOM to be updated
      await tick();
      
      // Initialize sailing map if not already done
      if (!sailingMapInitialized || !sailingMap) {
        initSailingMap();
      } else if (sailingMap) {
        sailingMap.invalidateSize(true);
      }
      
      updateSailingMapView();
    }

    if (newMode === 'wind') {
      // Wait for DOM to be updated
      await tick();
      
      // Initialize wind map if not already done
      if (!windMapInitialized || !windMap) {
        initWindMap();
      } else if (windMap) {
        windMap.invalidateSize(true);
      }
    }
  }

  async function switchSailingVizMode(newMode) {
    sailingVizMode = newMode;

    if (newMode === 'average' && sailingPerformancePoints.length === 0) {
      await loadPerformancePointsAsync();
    }

    // Wait for DOM to be updated
    await tick();
    
    if (!sailingMap) {
      initSailingMap();
    } else {
      sailingMap.invalidateSize(true);
    }
  }

  onMount(async () => {
    await loadWindDateRange();
    await loadWindDataAsync();

    // Load Leaflet CSS and JS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      // Initialize wind map initially
      if (viewMode === 'wind') {
        setTimeout(() => {
          initWindMap();
        }, 100);
      }
    };
    document.head.appendChild(script);
  });

  // Clean up maps when component is destroyed
  onDestroy(() => {
    cleanupMap('wind');
    cleanupMap('sailing');
  });

</script>

<div class="app-container">
  <header class="header">
    <h1>Wannsee Wind</h1>
    <p>Wind Data & Sailing Tour Visualization • Berlin</p>
  </header>
  
  <!-- View Mode Toggle -->
  <div class="view-toggle-card glass-card">
    <button 
      class="view-toggle-btn"
      class:active={viewMode === 'wind'}
      on:click={() => switchView('wind')}
    >
      <span>Wind</span>
    </button>
    <button 
      class="view-toggle-btn"
      class:active={viewMode === 'sailing'}
      on:click={() => switchView('sailing')}
    >
      <span>Sailing</span>
    </button>
  </div>

  {#if viewMode === 'wind'}
    <!-- Wind View -->
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

    <div class="glass-card map-card">
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
        <div id="wind-map" class="map"></div>
        
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
          {:else if windData.length === 0}
            <div class="loading">No wind data available</div>
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
  {:else}
    <!-- Sailing View -->
    <div class="glass-card filter-card">
      {#if sailingVizMode === 'individual'}
        <SailingTourSelector 
          bind:dateGroups={sailingDateGroups}
          bind:selectedTours={selectedTourIds}
        />
      {:else}
        <AngleRangeSelector
          bind:selectedRanges={selectedAngleRanges}
        />
      {/if}
    </div>

    <div class="glass-card map-card">
      <div class="data-summary">
        {#if sailingVizMode === 'individual'}
          {#if selectedSailingTours.length === 0}
            Select one or more sailing tours to visualize their paths
          {:else}
            Showing <strong>{selectedSailingTours.length}</strong> tour{selectedSailingTours.length > 1 ? 's' : ''} with <strong>{selectedSailingTours.reduce((sum, t) => sum + t.points.length, 0)}</strong> data points
          {/if}
        {:else}
          {#if selectedAngleRanges.length === 0}
            Select wind angle ranges to view average performance
          {:else}
            Showing performance for <strong>{selectedAngleRanges.length}</strong> angle range{selectedAngleRanges.length > 1 ? 's' : ''}
          {/if}
        {/if}
      </div>
      
      <!-- Sailing visualization toggle -->
      <div class="viz-toggle">
        <button
          class="toggle-btn"
          class:active={sailingVizMode === 'individual'}
          on:click={() => switchSailingVizMode('individual')}
        >
          Tours
        </button>

        <button
          class="toggle-btn"
          class:active={sailingVizMode === 'average'}
          on:click={() => switchSailingVizMode('average')}
        >
          Average
        </button>
      </div>

      <div class="map-container">
  <div id="sailing-map" class="map"></div>
  
  {#if loading || !sailingMapLoaded}
    <div class="map-loading">
      <div class="loading">Loading map...</div>
    </div>
  {/if}
  
  {#if viewMode === 'sailing' && sailingMapLoaded}
    <SailingMapView 
      tours={selectedSailingTours}
      map={sailingMap}
      mode={sailingVizMode}
      selectedAngleRanges={selectedAngleRanges}
      sailingPerformancePoints={sailingPerformancePoints}
    />
  {/if}
</div>
      
      {#if sailingVizMode === 'individual' && selectedSailingTours.length > 0}
        <div class="stats-container">
          <div class="stat-item">
            <div class="stat-value">{selectedSailingTours.reduce((sum, t) => sum + t.points.length, 0)}</div>
            <div class="stat-label">Data Points</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">
              {(selectedSailingTours.reduce((sum, t) => 
                sum + t.points.reduce((s, p) => s + p.boat_speed, 0) / t.points.length, 0
              ) / selectedSailingTours.length).toFixed(1)}
            </div>
            <div class="stat-label">Avg Speed (kts)</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">
              {Math.max(...selectedSailingTours.flatMap(t => t.points.map(p => p.boat_speed))).toFixed(1)}
            </div>
            <div class="stat-label">Max Speed (kts)</div>
          </div>
        </div>
      {:else if sailingVizMode === 'average' && sailingPerformancePoints.length === 0}
        <div class="stats-container">
          <div class="stat-item">
            <div class="stat-value">0</div>
            <div class="stat-label">No performance data available</div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
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

  .view-toggle-card {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .view-toggle-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    font-family: 'Outfit', sans-serif;
  }

  .view-toggle-btn .icon {
    font-size: 1.5rem;
  }

  .view-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }

  .view-toggle-btn.active {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    color: var(--text-primary);
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
    min-height: 60px;
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

  .map-loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    z-index: 1000;
    pointer-events: none;
  }

  .viz-toggle {
    position: absolute;
    top: 0.6rem;
    right: 0.8rem;
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
    background: transparent;
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

    .view-toggle-card {
      gap: 0.5rem;
      padding: 0.75rem;
    }

    .view-toggle-btn {
      padding: 0.75rem;
      font-size: 0.8rem;
    }

    .view-toggle-btn .icon {
      font-size: 1.25rem;
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