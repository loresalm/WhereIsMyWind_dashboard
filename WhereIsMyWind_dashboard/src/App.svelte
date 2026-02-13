<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { 
    loadWindData,
    getAvailableDateRange,
    loadSailingTours,
    getSailingTourDates,
    loadSailingPerformancePoints
  } from './firebase.js';
  import WindRose from './WindRose.svelte';
  import AngleRangeSelector from './AngleRangeSelector.svelte';
  import FilterControls from './Filtercontrols.svelte';
  import SailingTourSelector from './Sailingtourselector.svelte';
  import SailingMapView from './Sailingmapview.svelte';

  import windIcon from './lib/assets/iconwind48.svg';
  import sailingIcon from './lib/assets/iconsail48.svg';

  // ============ STATE ============
  
  // View mode
  let viewMode = 'wind'; // 'wind' or 'sailing'
  let loading = false;

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
  let visualizationMode = 'aggregate'; // 'aggregate' or 'hourly'
  let currentHourIndex = 0;
  let animationInterval;

  // Sailing data state
  let sailingTours = [];
  let sailingDateGroups = [];
  let selectedTourIds = [];
  let sailingVizMode = 'individual'; 
  let selectedAngleRanges = [
    { min: 20, max: 30 },
    { min: 30, max: 40 }
  ];
  let sailingPerformancePoints = [];

  // Map state
  let windMap = null;
  let sailingMap = null;
  let windMapLoaded = false;
  let sailingMapLoaded = false;
  let windMapInitialized = false;
  let sailingMapInitialized = false;

  // Map configuration
  const wannseeCenter = [52.442616, 13.164234];
  const defaultZoom = 14;

  // ============ REACTIVE DECLARATIONS ============
  
  // Computed selected sailing tours
  $: selectedSailingTours = sailingTours.filter(tour => 
    selectedTourIds.includes(tour.id)
  );

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

  // Wind statistics and rose data
  $: stats = calculateStats(filteredWindData);
  $: windRoseData = calculateWindRose(filteredWindData);
  $: hourlyWindData = calculateHourlyWindRose(filteredWindData);
  
  // Current buckets based on visualization mode
  $: currentBuckets = visualizationMode === 'hourly'
    ? hourlyWindData[currentHourIndex]?.buckets ?? []
    : windRoseData ?? [];

  // Max frequency for scaling
  $: maxFrequency = Math.max(
    ...currentBuckets.map(b => b.totalFrequency || 0),
    0.15  // Minimum 15% for visibility
  );

  // Scale labels for wind rose
  $: scaleLabels = [
    `${(maxFrequency * 0.33 * 100).toFixed(0)}%`,
    `${(maxFrequency * 0.66 * 100).toFixed(0)}%`,
    `${(maxFrequency * 100).toFixed(0)}%`
  ];
  
  // Selected day names for display
  $: selectedDayNames = selectedDays
    .sort((a, b) => a - b)
    .map(i => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i])
    .join(', ');

  // Animation control
  $: if (visualizationMode === 'hourly') startAnimation();
  $: if (visualizationMode !== 'hourly') stopAnimation();

  // Update sailing map view when needed
  $: if (sailingMap && viewMode === 'sailing') {
    updateSailingMapView();
  }

  // ============ FUNCTIONS ============

  // Animation functions
  function startAnimation() {
    if (animationInterval || !hourlyWindData?.length) return;
    currentHourIndex = 0;
    animationInterval = setInterval(() => {
      currentHourIndex = (currentHourIndex + 1) % hourlyWindData.length;
    }, 800);
  }

  function stopAnimation() {
    clearInterval(animationInterval);
    animationInterval = null;
    currentHourIndex = 0;
  }

  // Statistics calculation
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

  // Wind rose calculation with speed bins
  function calculateWindRose(data) {
    const directions = 16;
    
    // Wind speed bins (in knots)
    const speedBins = [
      { min: 0, max: 2, label: '0-2', color: 'rgb(100, 150, 255)' },
      { min: 2, max: 5, label: '2-5', color: 'rgb(120, 200, 255)' },
      { min: 5, max: 9, label: '5-9', color: 'rgb(150, 255, 150)' },
      { min: 9, max: 13, label: '9-13', color: 'rgb(255, 255, 100)' },
      { min: 13, max: 19, label: '13-19', color: 'rgb(255, 180, 80)' },
      { min: 19, max: Infinity, label: '19+', color: 'rgb(255, 100, 100)' }
    ];

    // Initialize counts: [direction][speedBin]
    const counts = Array(directions).fill(null).map(() => 
      Array(speedBins.length).fill(0)
    );

    let totalRecords = 0;

    data.forEach(record => {
      const dir = parseFloat(record['Wind Direction']);
      const speed = parseFloat(record['Wind Speed (kts)']);

      if (!isNaN(dir) && !isNaN(speed)) {
        const dirBucket = Math.floor(((dir + 11.25) % 360) / 22.5);
        
        // Find which speed bin this belongs to
        const speedBinIndex = speedBins.findIndex(
          bin => speed >= bin.min && speed < bin.max
        );
        
        if (speedBinIndex !== -1) {
          counts[dirBucket][speedBinIndex]++;
          totalRecords++;
        }
      }
    });

    // Calculate frequencies and create stacked bar data
    return Array(directions).fill(null).map((_, dirIndex) => {
      const dirCounts = counts[dirIndex];
      const dirTotal = dirCounts.reduce((a, b) => a + b, 0);
      
      // Create stacked segments for this direction
      const segments = speedBins.map((bin, binIndex) => ({
        count: dirCounts[binIndex],
        frequency: totalRecords > 0 ? dirCounts[binIndex] / totalRecords : 0,
        speedRange: bin.label,
        color: bin.color
      }));

      return {
        direction: dirIndex,
        totalFrequency: totalRecords > 0 ? dirTotal / totalRecords : 0,
        segments: segments,
        speedBins: speedBins
      };
    });
  }

  // Hourly wind rose calculation
  function calculateHourlyWindRose(data) {
    const hourly = {};
    
    // Same speed bins as calculateWindRose
    const speedBins = [
      { min: 0, max: 2, label: '0-2', color: 'rgb(100, 150, 255)' },
      { min: 2, max: 5, label: '2-5', color: 'rgb(120, 200, 255)' },
      { min: 5, max: 9, label: '5-9', color: 'rgb(150, 255, 150)' },
      { min: 9, max: 13, label: '9-13', color: 'rgb(255, 255, 100)' },
      { min: 13, max: 19, label: '13-19', color: 'rgb(255, 180, 80)' },
      { min: 19, max: Infinity, label: '19+', color: 'rgb(255, 100, 100)' }
    ];

    data.forEach(record => {
      const time = record['Time'];
      const dir = parseFloat(record['Wind Direction']);
      const speed = parseFloat(record['Wind Speed (kts)']);

      if (!time || isNaN(dir) || isNaN(speed)) return;

      const hour = parseInt(time.split(':')[0]);

      if (!hourly[hour]) {
        hourly[hour] = {
          counts: Array(16).fill(null).map(() => Array(speedBins.length).fill(0)),
          total: 0
        };
      }

      const dirBucket = Math.floor(((dir + 11.25) % 360) / 22.5);
      const speedBinIndex = speedBins.findIndex(
        bin => speed >= bin.min && speed < bin.max
      );
      
      if (speedBinIndex !== -1) {
        hourly[hour].counts[dirBucket][speedBinIndex]++;
        hourly[hour].total++;
      }
    });

    return Object.entries(hourly).map(([hour, data]) => {
      const buckets = Array(16).fill(null).map((_, dirIndex) => {
        const dirCounts = data.counts[dirIndex];
        const dirTotal = dirCounts.reduce((a, b) => a + b, 0);
        
        const segments = speedBins.map((bin, binIndex) => ({
          count: dirCounts[binIndex],
          frequency: data.total > 0 ? dirCounts[binIndex] / data.total : 0,
          speedRange: bin.label,
          color: bin.color
        }));

        return {
          direction: dirIndex,
          totalFrequency: data.total > 0 ? dirTotal / data.total : 0,
          segments: segments,
          speedBins: speedBins
        };
      });

      return {
        hour,
        buckets: buckets
      };
    });
  }

  // Map initialization
  function initWindMap() {
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
  addWindInfoControl();
  addWindVizToggle();
  addWindSpeedLegendControl(); // ADD THIS LINE
}

  function addWindInfoControl() {
    if (!windMap) return;

    const info = window.L.control({ position: 'bottomleft' });

    info.onAdd = function () {
      const div = window.L.DomUtil.create('div', 'info-control');

      div.innerHTML = `
        <button class="info-button" id="wind-info-btn">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10 14V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="10" cy="6.5" r="0.75" fill="currentColor"/>
          </svg>
        </button>

        <div class="info-popup" id="wind-info-popup" style="display:none;">
          <div class="info-header">
            <h4>Wind Analysis</h4>
            <button class="info-close" id="wind-info-close">×</button>
          </div>

          <div class="info-content">
            <div class="info-section">
              <h5>Wind Rose</h5>
              <p>The wind rose shows wind distribution across 16 direction sectors (22.5° each).</p>
              <p><strong>Sector length:</strong> Frequency (%) of wind from that direction.</p>
              <p><strong>Sector color:</strong> Wind speed range (knots) shown in stacked segments.</p>
            </div>

            <div class="info-section">
              <h5>Speed Bins</h5>
              <p>Wind speeds are categorized into 6 ranges, from calm (blue) to strong (red).</p>
              <p>Each direction shows stacked segments for different speed ranges.</p>
            </div>

            ${visualizationMode === 'aggregate'
              ? `
              <div class="info-section">
                <h5>Average Mode</h5>
                <p>Shows the average wind behavior over the selected:</p>
                <ul>
                  <li>Date range</li>
                  <li>Time range</li>
                  <li>Selected weekdays</li>
                </ul>
                <p>All data is aggregated into one wind rose.</p>
              </div>
              `
              : `
              <div class="info-section">
                <h5>Hourly Mode</h5>
                <p>Displays wind distribution hour by hour.</p>
                <p>Each frame represents the average for a specific hour across the selected days.</p>
                <p>The progress bar indicates the current hour in the animation.</p>
              </div>
              `
            }
          </div>
        </div>
      `;

      return div;
    };

    info.addTo(windMap);

    setTimeout(() => {
      const btn = document.getElementById('wind-info-btn');
      const popup = document.getElementById('wind-info-popup');
      const close = document.getElementById('wind-info-close');

      if (btn && popup && close) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
        });

        close.addEventListener('click', (e) => {
          e.stopPropagation();
          popup.style.display = 'none';
        });

        document.addEventListener('click', (e) => {
          if (!popup.contains(e.target) && !btn.contains(e.target)) {
            popup.style.display = 'none';
          }
        });
      }
    }, 100);
  }

function addWindVizToggle() {
  if (!windMap) return;

  const toggle = window.L.control({ position: 'topright' });

  toggle.onAdd = function() {
    const div = window.L.DomUtil.create('div', 'wind-viz-toggle');
    
    div.innerHTML = `
      <div class="viz-toggle-container">
        <button 
          class="viz-toggle-btn ${visualizationMode === 'aggregate' ? 'active' : ''}" 
          data-mode="aggregate"
        >
          Average
        </button>
        <button 
          class="viz-toggle-btn ${visualizationMode === 'hourly' ? 'active' : ''}" 
          data-mode="hourly"
        >
          Hourly
        </button>
      </div>
    `;
    
    window.L.DomEvent.disableClickPropagation(div);
    window.L.DomEvent.disableScrollPropagation(div);
    
    return div;
  };

  toggle.addTo(windMap);

  setTimeout(() => {
    const buttons = document.querySelectorAll('.viz-toggle-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const newMode = e.target.dataset.mode;
        if (newMode !== visualizationMode) {
          visualizationMode = newMode;
          
          buttons.forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
        }
      });
    });
  }, 100);
}

function addWindSpeedLegendControl() {
  if (!windMap) return;

  const legend = window.L.control({ position: 'bottomright' });

  legend.onAdd = function() {
    const div = window.L.DomUtil.create('div', 'wind-speed-legend-control');
    
    div.innerHTML = `
      <div class="legend-container">
        <div class="legend-header">
          <h4 class="legend-title">Wind Speed (kts)</h4>
          <button class="legend-toggle" data-legend="wind-speed">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="legend-content" data-legend-content="wind-speed">
          <div class="legend-items">
            <div class="legend-item">
              <div class="legend-color" style="background: rgb(100, 150, 255)"></div>
              <span class="legend-label">0-2</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: rgb(120, 200, 255)"></div>
              <span class="legend-label">2-5</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: rgb(150, 255, 150)"></div>
              <span class="legend-label">5-9</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: rgb(255, 255, 100)"></div>
              <span class="legend-label">9-13</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: rgb(255, 180, 80)"></div>
              <span class="legend-label">13-19</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: rgb(255, 100, 100)"></div>
              <span class="legend-label">19+</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    window.L.DomEvent.disableClickPropagation(div);
    
    return div;
  };

  legend.addTo(windMap);

  // Add toggle functionality
  setTimeout(() => {
    const toggleBtn = document.querySelector('[data-legend="wind-speed"]');
    const content = document.querySelector('[data-legend-content="wind-speed"]');
    
    if (toggleBtn && content) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = content.style.display === 'none';
        
        if (isCollapsed) {
          content.style.display = 'block';
          toggleBtn.style.transform = 'rotate(0deg)';
        } else {
          content.style.display = 'none';
          toggleBtn.style.transform = 'rotate(-90deg)';
        }
      });
    }
  }, 100);
}

  function initSailingMap() {
    const container = document.getElementById('sailing-map');
    if (!container) return;
    
    // Clean up existing map
    if (sailingMap) {
      try {
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

  // Data loading functions
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
      
      // Auto-select the first tour
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

      await tick();
      
      if (!sailingMapInitialized || !sailingMap) {
        initSailingMap();
      } else if (sailingMap) {
        sailingMap.invalidateSize(true);
      }
      
      updateSailingMapView();
    }

    if (newMode === 'wind') {
      await tick();
      
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

    await tick();
    
    if (!sailingMap) {
      initSailingMap();
    } else {
      sailingMap.invalidateSize(true);
    }
  }

  // Lifecycle hooks
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
      if (viewMode === 'wind') {
        setTimeout(() => {
          initWindMap();
        }, 100);
      }
    };
    document.head.appendChild(script);
  });

  onDestroy(() => {
    cleanupMap('wind');
    cleanupMap('sailing');
  });
</script>

<div class="app-container">
  <!-- 
  <header class="header">
    <h1>Wannsee Wind</h1>
    <p>Wind Data & Sailing Tour Visualization • Berlin</p>
  </header>
  -->

  
  <!-- View Mode Toggle -->
  <div class="view-toggle-card glass-card">
   <button 
  class="view-toggle-btn"
  class:active={viewMode === 'wind'}
  on:click={() => switchView('wind')}
>
  <img class="icon" src={windIcon} alt="Wind" />
  <span>Wind</span>
</button>

<button 
  class="view-toggle-btn"
  class:active={viewMode === 'sailing'}
  on:click={() => switchView('sailing')}
>
  <img class="icon" src={sailingIcon} alt="Sailing" />
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

        <!-- Wind Speed Legend -->
        {#if viewMode === 'wind'}
          <div class="wind-speed-legend">
            <h4>Wind Speed (kts)</h4>
            
            <div class="legend-bins">
              <div class="legend-bin">
                <div class="legend-color" style="background: rgb(100, 150, 255)"></div>
                <span>0-2</span>
              </div>
              <div class="legend-bin">
                <div class="legend-color" style="background: rgb(120, 200, 255)"></div>
                <span>2-5</span>
              </div>
              <div class="legend-bin">
                <div class="legend-color" style="background: rgb(150, 255, 150)"></div>
                <span>5-9</span>
              </div>
              <div class="legend-bin">
                <div class="legend-color" style="background: rgb(255, 255, 100)"></div>
                <span>9-13</span>
              </div>
              <div class="legend-bin">
                <div class="legend-color" style="background: rgb(255, 180, 80)"></div>
                <span>13-19</span>
              </div>
              <div class="legend-bin">
                <div class="legend-color" style="background: rgb(255, 100, 100)"></div>
                <span>19+</span>
              </div>
            </div>
          </div>
        {/if}
        
        <!-- Wind Rose Overlay -->
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
              currentHourIndex={currentHourIndex}
              scaleLabels={scaleLabels}
              maxFrequency={maxFrequency}
            />
          {/if}
        </div>
      </div>
      
      <!-- Statistics -->
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
            onModeChange={switchSailingVizMode}
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
    width: 24px;
    height: 24px;
    transition: all 0.3s ease;
  }

  .view-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }

  .view-toggle-btn:hover .icon {
    transform: scale(1.1);
  }

  .view-toggle-btn.active {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    color: var(--text-primary);
  }

  .view-toggle-btn.active .icon {
    transform: scale(1.05);
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
    background: rgba(255, 255, 255, 0.08);
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


  .legend-bins {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .legend-bin {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .legend-color {
    width: 20px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .legend-bin span {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.95);
    font-weight: 500;
  }

  /* Info Control Styles */
  :global(.info-control) {
    position: relative;
  }

  :global(.info-button) {
    width: 34px;
    height: 34px;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.9);
    transition: all 0.2s ease;
    font-family: 'Outfit', sans-serif;
  }

  :global(.info-button:hover) {
    background: rgba(0, 0, 0, 0.4);
    border-color: rgba(255, 255, 255, 0.4);
    color: white;
  }

  :global(.info-popup) {
    position: absolute;
    bottom: 42px;
    left: 0;
    width: 320px;
    max-height: 500px;
    background: rgba(0, 0, 0, 0.25);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    overflow-y: auto;
    z-index: 2000;
    animation: slideUpPopup 0.2s ease;
  }

  @keyframes slideUpPopup {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  :global(.info-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    position: sticky;
    top: 0;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    z-index: 1;
  }

  :global(.info-header h4) {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: white;
    font-family: 'Outfit', sans-serif;
  }

  :global(.info-close) {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  :global(.info-close:hover) {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  :global(.info-content) {
    padding: 12px 16px;
    color: rgba(255, 255, 255, 0.9);
    font-family: 'Outfit', sans-serif;
    font-size: 0.75rem;
    line-height: 1.5;
  }

  :global(.info-section) {
    margin-bottom: 16px;
  }

  :global(.info-section:last-child) {
    margin-bottom: 0;
  }

  :global(.info-section h5) {
    margin: 0 0 8px 0;
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(100, 180, 255, 1);
  }

  :global(.info-section p) {
    margin: 0 0 6px 0;
    color: rgba(255, 255, 255, 0.85);
  }

  :global(.info-section ul) {
    margin: 6px 0;
    padding-left: 20px;
  }

  :global(.info-section li) {
    margin: 4px 0;
    color: rgba(255, 255, 255, 0.85);
  }

  :global(.info-section strong) {
    color: white;
    font-weight: 600;
  }

  :global(.info-popup::-webkit-scrollbar) {
    width: 6px;
  }

  :global(.info-popup::-webkit-scrollbar-track) {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }

  :global(.info-popup::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  :global(.info-popup::-webkit-scrollbar-thumb:hover) {
    background: rgba(255, 255, 255, 0.3);
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

  /* Animations */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Mobile Responsive */
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
      width: 20px;
      height: 20px;
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
  /* Wind Viz Toggle Control */
:global(.wind-viz-toggle) {
  background: transparent;
  border: none;
}

:global(.viz-toggle-container) {
  display: flex;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:global(.viz-toggle-btn) {
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

:global(.viz-toggle-btn:hover) {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.05);
}

:global(.viz-toggle-btn.active) {
  background: rgba(255, 255, 255, 0.9);
  color: #000;
}

/* Standardized Legend Styles */
:global(.wind-speed-legend-control) {
  background: transparent;
  border: none;
}

:global(.legend-container) {
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  font-family: 'Outfit', sans-serif;
  min-width: 120px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

:global(.legend-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

:global(.legend-title) {
  margin: 0;
  font-size: 0.8rem;
  text-align: center;
  font-weight: 600;
  color: white;
  flex: 1;
}

:global(.legend-toggle) {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  border-radius: 4px;
  flex-shrink: 0;
}

:global(.legend-toggle:hover) {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

:global(.legend-toggle svg) {
  transition: transform 0.2s ease;
}

:global(.legend-content) {
  transition: all 0.2s ease;
}

:global(.legend-items) {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

:global(.legend-item) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:global(.legend-color) {
  width: 20px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

:global(.legend-label) {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 500;
}
</style>