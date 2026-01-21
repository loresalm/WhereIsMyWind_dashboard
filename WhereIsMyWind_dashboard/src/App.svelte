<script>
  import { onMount } from 'svelte';
  import { loadWindData, generateMockData } from './firebase.js';

  // State variables
  let windData = [];
  let selectedDays = [0, 1, 2, 3, 4, 5, 6]; // All days selected by default
  let startDate = '2025-06-01';
  let endDate = '2025-09-30';
  let startHour = 1;
  let endHour = 18;
  let loading = false;
  let useMockData = false; // Set to true to use mock data

  // Map will be loaded after component mounts
  let mapLoaded = false;

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

  function calculateStats(data) {
    if (data.length === 0) return { avg: 0, max: 0, records: 0 };
    
    const speeds = data.map(r => r['Wind Speed (kts)'] || 0);
    return {
      avg: (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1),
      max: Math.max(...speeds).toFixed(1),
      records: data.length
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

  function toggleDay(day) {
    if (selectedDays.includes(day)) {
      selectedDays = selectedDays.filter(d => d !== day);
    } else {
      selectedDays = [...selectedDays, day];
    }
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

  onMount(() => {
    loadData();
    
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
  
  <div class="glass-card map-card">
    <div class="map-container">
      <div id="map" class="map"></div>
      
      <div class="wind-rose-overlay">
        {#if loading}
          <div class="loading">Loading wind data...</div>
        {:else}
          <svg viewBox="0 0 400 400" class="wind-rose">
            <!-- Background circles (semi-transparent) -->
            {#each [1, 2, 3, 4] as i}
              <circle 
                cx="200" 
                cy="200" 
                r={160 / 4 * i} 
                fill="none" 
                stroke="rgba(255,255,255,0.3)" 
                stroke-width="1.5"
              />
            {/each}
            
            <!-- Wind rose petals (semi-transparent with no fill in center) -->
            {#each windRoseData as value, i}
              {@const angle = (i * 22.5 - 90) * Math.PI / 180}
              {@const nextAngle = ((i + 1) * 22.5 - 90) * Math.PI / 180}
              {@const radius = 160 * value}
              {@const x1 = 200 + Math.cos(angle - 0.2) * radius}
              {@const y1 = 200 + Math.sin(angle - 0.2) * radius}
              {@const x2 = 200 + Math.cos(nextAngle + 0.2) * radius}
              {@const y2 = 200 + Math.sin(nextAngle + 0.2) * radius}
              {@const hue = (i * 22.5) % 360}
              
              <path 
                d="M 200 200 L {x1} {y1} A {radius} {radius} 0 0 1 {x2} {y2} Z"
                fill="hsl({hue}, 85%, 65%)"
                opacity="0.75"
                class="rose-petal"
                stroke="rgba(255,255,255,0.4)"
                stroke-width="1"
              />
            {/each}
            
            <!-- Direction labels with semi-transparent background -->
            {#each directions as dir, i}
              {@const angle = (i * 22.5 - 90) * Math.PI / 180}
              {@const x = 200 + Math.cos(angle) * 190}
              {@const y = 200 + Math.sin(angle) * 190}
              
              <circle cx={x} cy={y} r="16" fill="rgba(0,0,0,0.0)" stroke="rgba(255,255,255,0.0)" stroke-width="1"/>
              <text 
                x={x} 
                y={y}
                text-anchor="middle" 
                dominant-baseline="middle" 
                class="compass-text" 
              >
                {dir}
              </text>
            {/each}
            
            <!-- Center point (semi-transparent) -->
            <circle cx="200" cy="200" r="10" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
            <circle cx="200" cy="200" r="4" fill="rgba(255,255,255,0.8)"/>
          </svg>
        {/if}
      </div>
    </div>
    
    <div class="stats-container">
      <div class="stat-item">
        <div class="stat-value">{stats.avg}</div>
        <div class="stat-label">Avg Speed (kts)</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{stats.max}</div>
        <div class="stat-label">Max Speed (kts)</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{stats.records}</div>
        <div class="stat-label">Data Points</div>
      </div>
    </div>
  </div>
  
  <div class="glass-card date-selector">
    <div class="selector-section">
      <div class="selector-label">Date Range</div>
      <div class="input-group">
        <input type="date" class="glass-input" bind:value={startDate}>
        <input type="date" class="glass-input" bind:value={endDate}>
      </div>
    </div>
    
    <div class="selector-section">
      <div class="selector-label">Time Range (Hours)</div>
      <div class="input-group">
        <input type="number" class="glass-input" bind:value={startHour} min="0" max="23" placeholder="From">
        <input type="number" class="glass-input" bind:value={endHour} min="0" max="23" placeholder="To">
      </div>
    </div>
    
    <div class="selector-section">
      <div class="selector-label">Days of Week</div>
      <div class="checkbox-group">
        {#each dayNames as day, i}
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              checked={selectedDays.includes(i)}
              on:change={() => toggleDay(i)}
            >
            <span>{day}</span>
          </label>
        {/each}
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
    padding: 2rem;
    margin-bottom: 1.5rem;
    animation: slideUp 0.6s ease;
  }

  .map-card {
    padding: 0;
    overflow: hidden;
  }

  .map-container {
    position: relative;
    width: 100%;
    height: 600px;
    border-radius: 24px;
    overflow: hidden;
  }

  .map {
    width: 100%;
    height: 100%;
    background: #0a1929;
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

  .wind-rose {
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 4px 20px rgba(0, 0, 0, 0.6));
  }

  .rose-petal {
    transition: all 0.3s ease;
    cursor: pointer;
    pointer-events: all;
  }

  .rose-petal:hover {
    opacity: 0.95 !important;
    filter: brightness(1.3);
    stroke-width: 2;
  }

  .compass-text {
    font-size: 13px;
    font-weight: 600;
    fill: var(--text-primary);
    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
  }

  .stats-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    padding: 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .stat-item {
    text-align: center;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .date-selector {
    display: grid;
    gap: 1.5rem;
  }

  .selector-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .selector-label {
    font-size: 0.85rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
  }

  .input-group {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
  }

  .glass-input {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    color: var(--text-primary);
    font-family: 'Outfit', sans-serif;
    font-size: 0.95rem;
    transition: all 0.3s ease;
    outline: none;
  }

  .glass-input:focus {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.05);
  }

  .checkbox-group {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s ease;
    font-size: 0.9rem;
  }

  .checkbox-label:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .checkbox-label input {
    accent-color: rgba(255, 255, 255, 0.9);
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
      padding: 1.5rem;
      border-radius: 20px;
    }

    .map-card {
      padding: 0;
    }

    .map-container {
      height: 500px;
    }

    .wind-rose-overlay {
      width: 85%;
      height: 85%;
    }

    .input-group {
      grid-template-columns: 1fr;
    }

    .checkbox-group {
      grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
    }

    .stats-container {
      padding: 1.5rem;
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