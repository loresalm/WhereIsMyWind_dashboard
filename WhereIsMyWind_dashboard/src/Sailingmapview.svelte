<script>
  import { onMount } from 'svelte';
   
  export let tours = [];
  export let map = null;
  export let mode; // 'individual' | 'average'
  export let selectedAngleRanges = [];
  export let sailingPerformancePoints = [];

  // existing state
  let gpxLayers = [];
  let legendControl;
  
  // Color palette for different tours
  const tourColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B4D9', '#B8E994'
  ];
  
  // Dynamic color scale state for average mode
  let colorScaleRanges = [];
  let minSpeedRatio = 0;
  let maxSpeedRatio = 1;
  let filteredPoints = []; // Store filtered points for legend access
  
  let lastModeHash = '';
  const topMargin = 10;

  // Define clearLayers first so it's available for updateVisualization
  function clearLayers() {
  if (!map) return;
  
  gpxLayers.forEach(l => {
    try {
      if (l.__legend) {
        // It's a legend control
        map.removeControl(l.__legend);
      } else if (l && map.hasLayer(l)) {
        map.removeLayer(l);
      }
    } catch (error) {
      // Silently fail if layer removal fails
    }
  });
  gpxLayers = [];
}

  // Define updateVisualization after clearLayers
  function updateVisualization() {
    // Always clear existing layers first
    clearLayers();
    if (legendControl && map) {
      map.removeControl(legendControl);
      legendControl = null;
    }
    
    if (mode === 'individual') {
      renderIndividualTours();
    } else if (mode === 'average') {
      renderAveragePerformance();
    }
  }

  function addBoatSpeedLegend() {
  if (!tours || tours.length === 0) return;
  
  // Calculate min/max boat speeds across all tours
  const allSpeeds = tours.flatMap(tour => 
    tour.points.map(p => Number(p.boat_speed)).filter(v => !isNaN(v))
  );
  const minSpeed = Math.min(...allSpeeds);
  const maxSpeed = Math.max(...allSpeeds);
  
  const legend = window.L.control({ position: 'bottomright' });
  const topMargin = 10;
  const gradientHeight = 100;
  const gradientWidth = 15;
  const numGradientSteps = 100;

  legend.onAdd = function() {
    const div = window.L.DomUtil.create('div', 'boat-speed-legend');
    
    let gradientSVG = `<svg width="${gradientWidth + 50}" height="${gradientHeight + 30}" viewBox="0 0 ${gradientWidth + 50} ${gradientHeight + 30}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Create gradient stops
    for (let i = 0; i < numGradientSteps; i++) {
      const y = gradientHeight - ((i / numGradientSteps) * gradientHeight);
      const speed = minSpeed + (i / numGradientSteps) * (maxSpeed - minSpeed);
      const color = speedToColor(speed, minSpeed, maxSpeed);
      
      gradientSVG += `<rect x="0" y="${y + topMargin}" width="${gradientWidth}" height="${gradientHeight/numGradientSteps}" fill="${color}" />`;
    }
    
    // Add scale markers
    const numMarkers = 5;
    for (let i = 0; i <= numMarkers; i++) {
      const y = gradientHeight - ((i / numMarkers) * gradientHeight);
      const speed = minSpeed + (i / numMarkers) * (maxSpeed - minSpeed);
      
      gradientSVG += `
        <line x1="${gradientWidth}" y1="${y + topMargin}" x2="${gradientWidth + 5}" y2="${y + topMargin}" stroke="white" stroke-width="1" />
        <text x="${gradientWidth + 10}" y="${y + topMargin + 4}" font-size="10" fill="white" font-family="'Outfit', sans-serif">${speed.toFixed(1)}</text>
      `;
    }
    
    gradientSVG += '</svg>';
    
    div.innerHTML = `
      <div style="
        background: rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(10px);
        padding: 10px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        font-family: 'Outfit', sans-serif;
        font-size: 0.7rem;
        min-width: 120px;
      ">
        <h4 style="margin: 0 0 10px 0; font-size: 0.8rem; text-align: center;">Boat Speed (kts)</h4>
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <div>
            ${gradientSVG}
          </div>
        </div>
      </div>
    `;
    return div;
  };

  const boatLegend = legend;
  boatLegend.addTo(map);
  gpxLayers.push({ __legend: boatLegend }); // Store for cleanup
}

function addWindSpeedLegend() {
  if (!tours || tours.length === 0) return;
  
  // Calculate min/max wind speeds across all tours
  const allWindSpeeds = tours.flatMap(tour => 
    tour.points.map(p => Number(p.wind_speed)).filter(v => !isNaN(v))
  );
  const minWind = Math.min(...allWindSpeeds);
  const maxWind = Math.max(...allWindSpeeds);
  
  const legend = window.L.control({ position: 'bottomright' });
  const topMargin = 10;
  const gradientHeight = 100;
  const gradientWidth = 15;
  const numGradientSteps = 100;

  legend.onAdd = function() {
    const div = window.L.DomUtil.create('div', 'wind-speed-legend');
    
    // Check if wind speed is constant
    const isConstant = minWind === maxWind;
    
    if (isConstant) {
      // Show single color box with value
      const singleColor = windSpeedToColor(minWind, minWind, maxWind);
      div.innerHTML = `
        <div style="
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(10px);
          padding: 10px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          font-family: 'Outfit', sans-serif;
          font-size: 0.7rem;
          min-width: 100px;
        ">
          <h4 style="margin: 0 0 8px 0; font-size: 0.8rem; text-align: center;">Wind Speed</h4>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 20px; height: 20px; background: ${singleColor}; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 3px;"></div>
            <div style="font-size: 0.75rem; font-weight: 600;">${minWind.toFixed(1)} kts</div>
          </div>
        </div>
      `;
    } else {
      // Show gradient as before
      let gradientSVG = `<svg width="${gradientWidth + 50}" height="${gradientHeight + 30}" viewBox="0 0 ${gradientWidth + 50} ${gradientHeight + 30}" xmlns="http://www.w3.org/2000/svg">`;
      
      // Create gradient stops
      for (let i = 0; i < numGradientSteps; i++) {
        const y = gradientHeight - ((i / numGradientSteps) * gradientHeight);
        const speed = minWind + (i / numGradientSteps) * (maxWind - minWind);
        const color = windSpeedToColor(speed, minWind, maxWind);
        
        gradientSVG += `<rect x="0" y="${y + topMargin}" width="${gradientWidth}" height="${gradientHeight/numGradientSteps}" fill="${color}" />`;
      }
      
      // Add scale markers
      const numMarkers = 5;
      for (let i = 0; i <= numMarkers; i++) {
        const y = gradientHeight - ((i / numMarkers) * gradientHeight);
        const speed = minWind + (i / numMarkers) * (maxWind - minWind);
        
        gradientSVG += `
          <line x1="${gradientWidth}" y1="${y + topMargin}" x2="${gradientWidth + 5}" y2="${y + topMargin}" stroke="white" stroke-width="1" />
          <text x="${gradientWidth + 10}" y="${y + topMargin + 4}" font-size="10" fill="white" font-family="'Outfit', sans-serif">${speed.toFixed(1)}</text>
        `;
      }
      
      gradientSVG += '</svg>';
      
      div.innerHTML = `
        <div style="
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(10px);
          padding: 10px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          font-family: 'Outfit', sans-serif;
          font-size: 0.7rem;
          min-width: 120px;
        ">
          <h4 style="margin: 0 0 10px 0; font-size: 0.8rem; text-align: center;">Wind Speed (kts)</h4>
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <div>
              ${gradientSVG}
            </div>
          </div>
        </div>
      `;
    }
    return div;
  };

  const windLegend = legend;
  windLegend.addTo(map);
  gpxLayers.push({ __legend: windLegend }); // Store for cleanup
}


  function renderIndividualTours() {
    if (!map || !tours || tours.length === 0) return;

    tours.forEach((tour, index) => {
      const color = tourColors[index % tourColors.length];
      addTourToMap(tour, color);
    });
    
    // Fit bounds to show all tours
    if (tours.length > 0 && tours[0].points.length > 0) {
      const bounds = calculateBounds();
      if (bounds) {
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 16
        });
      }
    }
    addBoatSpeedLegend();
    addWindSpeedLegend();
    addInfoControl();
  }

  // Dynamic color function based on speed ratio
 function speedRatioToColor(value, min, max) {
  const t = (value - min) / (max - min);

  const plasma = [
    [13, 8, 135],    // dark purple
    [84, 3, 160],
    [139, 10, 165],
    [185, 50, 137],
    [219, 92, 104],
    [244, 136, 73],
    [254, 188, 43],
    [240, 249, 33]   // yellow
  ];

  const index = Math.floor(t * (plasma.length - 1));
  const color = plasma[Math.max(0, Math.min(index, plasma.length - 1))];

  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}


  function createGrid(points, cellSizeMeters = 50) {
  if (!points.length) return [];

  const metersPerDegLat = 111111;

  const lats = points.map(p => Number(p.lat));
  const lons = points.map(p => Number(p.lon));

  const minLat = Math.min(...lats);
  const minLon = Math.min(...lons);

  const cellSizeLat = cellSizeMeters / metersPerDegLat;
  const cellSizeLon = cellSizeMeters / (
    metersPerDegLat * Math.cos(minLat * Math.PI / 180)
  );

  const grid = new Map();

  points.forEach(p => {
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    const ratio = Number(p.speed_ratio);

    const row = Math.floor((lat - minLat) / cellSizeLat);
    const col = Math.floor((lon - minLon) / cellSizeLon);

    const key = `${row}-${col}`;

    if (!grid.has(key)) {
      grid.set(key, { row, col, sum: 0, count: 0 });
    }

    const cell = grid.get(key);
    cell.sum += ratio;
    cell.count += 1;
  });

  const cells = [];

  grid.forEach(cell => {
    const avg = cell.sum / cell.count;

    const lat1 = minLat + cell.row * cellSizeLat;
    const lon1 = minLon + cell.col * cellSizeLon;

    const lat2 = lat1 + cellSizeLat;
    const lon2 = lon1 + cellSizeLon;

    cells.push({
      bounds: [[lat1, lon1], [lat2, lon2]],
      avg,
      count: cell.count
    });
  });

  return cells;
}

  
  // Helper function to interpolate between two colors
  function interpolateColor(color1, color2, factor) {
    if (factor === 0) return color1;
    if (factor === 1) return color2;
    
    const hex = (color) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };
    
    const c1 = hex(color1);
    const c2 = hex(color2);
    
    if (!c1 || !c2) return color1;
    
    const r = Math.round(c1.r + factor * (c2.r - c1.r));
    const g = Math.round(c1.g + factor * (c2.g - c1.g));
    const b = Math.round(c1.b + factor * (c2.b - c1.b));
    
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
  
  // Generate color scale ranges for legend
  function generateColorScaleRanges(minRatio, maxRatio) {
    const ranges = [];
    const numRanges = 5;
    const rangeSize = (maxRatio - minRatio) / numRanges;
    
    for (let i = 0; i < numRanges; i++) {
      const rangeMin = minRatio + (i * rangeSize);
      const rangeMax = minRatio + ((i + 1) * rangeSize);
      const midPoint = (rangeMin + rangeMax) / 2;
      
      ranges.push({
        min: rangeMin,
        max: rangeMax,
        color: speedRatioToColor(midPoint, minRatio, maxRatio),
        label: `${rangeMin.toFixed(2)} - ${rangeMax.toFixed(2)}`
      });
    }
    
    return ranges;
  }

  function renderAveragePerformance() {
    if (!map) return;
    if (!selectedAngleRanges.length) return;
    if (!sailingPerformancePoints?.length) return;

    // Filter points based on selected angle ranges
    filteredPoints = sailingPerformancePoints
      .filter(matchesAngleRange)
      .filter(p => {
        const lat = Number(p.lat);
        const lon = Number(p.lon);
        const speedRatio = Number(p.speed_ratio);
        
        return isValidLatLng(lat, lon) && 
               !isNaN(speedRatio) &&
               Number.isFinite(speedRatio);
      });

    if (filteredPoints.length === 0) return;

    // Calculate min and max speed ratios for dynamic coloring
    const speedRatios = filteredPoints.map(p => Number(p.speed_ratio));
    minSpeedRatio = Math.min(...speedRatios);
    maxSpeedRatio = Math.max(...speedRatios);
    
    // Generate color scale ranges based on actual data
    colorScaleRanges = generateColorScaleRanges(minSpeedRatio, maxSpeedRatio);

    // Create dot markers for each point
    const markers = [];
const cells = createGrid(filteredPoints, 40); // 50 meter grid

cells.forEach(cell => {
  if (cell.count < 3) return; // ignore tiny clusters (optional)

  const rect = L.rectangle(cell.bounds, {
    fillColor: speedRatioToColor(cell.avg, minSpeedRatio, maxSpeedRatio),
    fillOpacity: 0.7,
    color: 'rgba(255,255,255,0.2)',
    weight: 0.5
  }).addTo(map);

  // Updated popup with matching style
  const popupContent = `
    <div style="font-family: 'Outfit', sans-serif; font-size: 0.7rem; line-height: 1.3;">
      <div style="display: flex; flex-direction: column; gap: 0.4rem;">
        
        <div style="background: rgba(255, 255, 255, 0.06); backdrop-filter: blur(12px); padding: 0.45rem 0.55rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12);">
          <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Speed Ratio</div>
          <div style="font-size: 0.75rem; font-weight: 600; color: rgba(255, 255, 255, 0.95);">${cell.avg.toFixed(3)}</div>
        </div>

        <div style="background: rgba(255, 255, 255, 0.06); backdrop-filter: blur(12px); padding: 0.45rem 0.55rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12);">
          <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.1rem;">Data Points</div>
          <div style="font-size: 0.75rem; font-weight: 600; color: rgba(255, 255, 255, 0.95);">${cell.count}</div>
        </div>

      </div>
    </div>
  `;

  rect.bindPopup(popupContent, {
    closeButton: false,
    offset: [0, 0],
    autoPan: true,
    autoPanPadding: [50, 50],
    className: 'fixed-size-popup'
  });

  // Add hover events
  rect.on('mouseover', function() {
    this.openPopup();
  });

  rect.on('mouseout', function() {
    this.closePopup();
  });

  gpxLayers.push(rect);
});


    // Fit bounds to show all dots
    if (markers.length > 0) {
      try {
        const bounds = window.L.latLngBounds(markers);
        
        // Fit bounds with padding for better visibility
        map.fitBounds(bounds, {
          padding: [40, 40],
          maxZoom: 16,
          animate: true
        });
        
        // Set a minimum zoom if we're too zoomed out
        if (map.getZoom() < 12) {
          map.setZoom(12);
        }
      } catch (error) {
        // Fallback to Wannsee center
        map.setView([52.442616, 13.164234], 14);
      }
    } else {
      // Fallback view
      map.setView([52.442616, 13.164234], 14);
    }

    // Add dynamic legend for speed ratio
    addDynamicSpeedRatioLegend();
    addInfoControl();
  }

  function addDynamicSpeedRatioLegend() {
    if (legendControl && map) {
      map.removeControl(legendControl);
    }

    const legend = window.L.control({ position: 'bottomright' });

    legend.onAdd = function() {
      const div = window.L.DomUtil.create('div', 'speed-ratio-legend');
      
      // Create a gradient legend showing the full color range
      const gradientHeight = 100;
      const gradientWidth = 15;
      const numGradientSteps = 100;
      
      // Create gradient SVG
        let gradientSVG = `<svg width="${gradientWidth + 50}" height="${gradientHeight + 30}" viewBox="0 0 ${gradientWidth + 50} ${gradientHeight + 30}" xmlns="http://www.w3.org/2000/svg">`;
      // Create gradient stops
      for (let i = 0; i < numGradientSteps; i++) {
        const y = gradientHeight - ((i / numGradientSteps) * gradientHeight);  // Reversed
        const ratio = minSpeedRatio + (i / numGradientSteps) * (maxSpeedRatio - minSpeedRatio);
        const color = speedRatioToColor(ratio, minSpeedRatio, maxSpeedRatio);
        
        gradientSVG += `<rect x="0" y="${y + topMargin}" width="${gradientWidth}" height="${gradientHeight/numGradientSteps}" fill="${color}" />`;

      }
      
      // Add scale markers
      const numMarkers = 5;
      for (let i = 0; i <= numMarkers; i++) {
        const y = gradientHeight - ((i / numMarkers) * gradientHeight);  // Reversed
        const ratio = minSpeedRatio + (i / numMarkers) * (maxSpeedRatio - minSpeedRatio);
        const markerY = y - 2;
        
        gradientSVG += `
        <line x1="${gradientWidth}" y1="${y + topMargin}" x2="${gradientWidth + 5}" y2="${y + topMargin}" stroke="white" stroke-width="1" />
        <text x="${gradientWidth + 10}" y="${y + topMargin + 4}" font-size="10" fill="white" font-family="'Outfit', sans-serif">${ratio.toFixed(2)}</text>
        `;
      }
      
      gradientSVG += '</svg>';
      
      div.innerHTML = `
        <div style="
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(10px);
          padding: 10px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          font-family: 'Outfit', sans-serif;
          font-size: 0.7rem;
          min-width: 140px;
        ">
          <h4 style="margin: 0 0 10px 0; font-size: 0.8rem; text-align: center;">Speed Ratio</h4>
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <div style="margin-right: 10px;">
              ${gradientSVG}
            </div>
          </div>
        </div>
      `;
      return div;
    };

    legendControl = legend;
    legendControl.addTo(map);
  }

  // ... rest of the functions remain the same (addTourToMap, speedToColor, etc.) ...

  function addTourToMap(tour, color) {
    if (!tour.points || tour.points.length === 0) return;
    
    // Calculate speed range for color mapping
    const speeds = tour.points
      .map(p => Number(p.boat_speed))
      .filter(v => !isNaN(v));
    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);

    // Draw path segments colored by boat speed
    for (let i = 0; i < tour.points.length - 1; i++) {
      const p1 = tour.points[i];
      const p2 = tour.points[i + 1];
      const speed = Number(p1.boat_speed);
      
      if (isNaN(speed)) continue;

      const segment = window.L.polyline(
        [
          [Number(p1.lat), Number(p1.lon)],
          [Number(p2.lat), Number(p2.lon)]
        ],
        {
          color: speedToColor(speed, minSpeed, maxSpeed),
          weight: 4,
          opacity: 0.9,
          lineCap: 'round'
        }
      ).addTo(map);

      gpxLayers.push(segment);
    }
    
    // Add start marker
    const startPoint = tour.points[0];
    const startMarker = createCustomMarker(
      [startPoint.lat, startPoint.lon],
      '🏁',
      `Start: ${tour.start_time}`,
      color
    );
    gpxLayers.push(startMarker);
    
    // Add end marker
    const endPoint = tour.points[tour.points.length - 1];
    const endMarker = createCustomMarker(
      [endPoint.lat, endPoint.lon],
      '🏁',
      `End: ${tour.end_time}`,
      color
    );
    gpxLayers.push(endMarker);

    // Add wind direction vectors (sampled)
    const windSpeeds = tour.points
    .map(p => Number(p.wind_speed))
    .filter(v => !isNaN(v));
    const minWind = Math.min(...windSpeeds);
    const maxWind = Math.max(...windSpeeds);
    const WIND_SAMPLE_RATE = 10;

    tour.points.forEach((point, idx) => {
    if (idx % WIND_SAMPLE_RATE !== 0) return;
    if (!point.wind_speed || !point.wind_dir) return;

    const windColor = windSpeedToColor(point.wind_speed, minWind, maxWind);
    
    // Draw colored wind vector
    drawWindVector(point, windColor);
    
    // Draw thin black wind direction arrow
    drawDirectionArrow(point, point.wind_dir, 80, 'rgba(0, 0, 0, 0.6)', 1);
    
    // Draw thin black boat direction arrow using boat_heading from dataset
    if (point.boat_heading && !isNaN(point.boat_heading) && point.boat_heading !== 0) {
        drawDirectionArrow(point, point.boat_heading, 60, 'rgba(0, 0, 0, 0.6)', 1);
    }
    });

    // Add hover points for detailed information
    const HOVER_SAMPLE_RATE = 1;
    tour.points.forEach((point, idx) => {
      if (idx % HOVER_SAMPLE_RATE !== 0) return;
      const nextPoint = tour.points[idx + 1] || null;
      createHoverPoint(point, nextPoint, color);
    });
  }

  function speedToColor(speed, minSpeed, maxSpeed) {
    if (maxSpeed === minSpeed) return '#4CAF50';

    const t = Math.max(0, Math.min(1, (speed - minSpeed) / (maxSpeed - minSpeed)));

    // Blue → Green → Yellow → Red gradient
    if (t < 0.33) {
      return `rgb(0, ${Math.round(255 * (t / 0.33))}, 255)`;
    } else if (t < 0.66) {
      return `rgb(${Math.round(255 * ((t - 0.33) / 0.33))}, 255, ${Math.round(255 * (1 - (t - 0.33) / 0.33))})`;
    } else {
      return `rgb(255, ${Math.round(255 * (1 - (t - 0.66) / 0.34))}, 0)`;
    }
  }

function drawDirectionArrow(point, direction, lengthMeters, color, weight) {
  const angleRad = direction * Math.PI / 180;
  const lat = Number(point.lat);
  const lon = Number(point.lon);

  const dLat = (lengthMeters / 111111) * Math.cos(angleRad);
  const dLon = (lengthMeters / (111111 * Math.cos(lat * Math.PI / 180))) * Math.sin(angleRad);

  const endLat = lat + dLat;
  const endLon = lon + dLon;

  // Draw the main line
  const line = window.L.polyline(
    [[lat, lon], [endLat, endLon]],
    {
      color,
      weight,
      opacity: 0.7,
      lineCap: 'round'
    }
  ).addTo(map);

  // Create arrowhead at the END of the line (pointing forward)
  const arrowLength = lengthMeters * 0.25; // 25% of line length
  const arrowAngle = 30 * Math.PI / 180; // 30 degree angle for arrow

  // Calculate the angle pointing BACK from the tip
  const backAngle = angleRad + Math.PI;

  // Left side of arrowhead
  const leftAngle = backAngle - arrowAngle;
  const leftDLat = (arrowLength / 111111) * Math.cos(leftAngle);
  const leftDLon = (arrowLength / (111111 * Math.cos(endLat * Math.PI / 180))) * Math.sin(leftAngle);

  // Right side of arrowhead
  const rightAngle = backAngle + arrowAngle;
  const rightDLat = (arrowLength / 111111) * Math.cos(rightAngle);
  const rightDLon = (arrowLength / (111111 * Math.cos(endLat * Math.PI / 180))) * Math.sin(rightAngle);

  const arrowHead = window.L.polyline(
    [
      [endLat + leftDLat, endLon + leftDLon],
      [endLat, endLon],
      [endLat + rightDLat, endLon + rightDLon]
    ],
    {
      color,
      weight,
      opacity: 0.7,
      lineCap: 'round',
      lineJoin: 'round'
    }
  ).addTo(map);

  gpxLayers.push(line);
  gpxLayers.push(arrowHead);
}

  function windSpeedToColor(speed, min, max) {
    if (max === min) return '#4FC3F7';

    const t = Math.max(0, Math.min(1, (speed - min) / (max - min)));

    // Light blue → green → yellow → red
    if (t < 0.33) {
      return `rgb(79, ${Math.round(195 + 60 * (t / 0.33))}, 247)`;
    } else if (t < 0.66) {
      return `rgb(${Math.round(255 * ((t - 0.33) / 0.33))}, 255, 120)`;
    } else {
      return `rgb(255, ${Math.round(255 * (1 - (t - 0.66) / 0.34))}, 80)`;
    }
  }

  function drawWindVector(point, color) {
    const lengthMeters = 120;
    const angleRad = point.wind_dir * Math.PI / 180;
    const lat = Number(point.lat);
    const lon = Number(point.lon);

    const dLat = (lengthMeters / 111111) * Math.cos(angleRad);
    const dLon = (lengthMeters / (111111 * Math.cos(lat * Math.PI / 180))) * Math.sin(angleRad);

    const endLat = lat + dLat;
    const endLon = lon + dLon;

    const line = window.L.polyline(
      [[lat, lon], [endLat, endLon]],
      {
        color,
        weight: 2,
        opacity: 0.8,
        lineCap: 'round'
      }
    ).addTo(map);

    gpxLayers.push(line);
  }

  function createCustomMarker(latLon, icon, label, color) {
    const customIcon = window.L.divIcon({
      html: `
        <div style="
          background: ${color};
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">${icon}</div>
      `,
      className: 'custom-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    const marker = window.L.marker(latLon, { icon: customIcon }).addTo(map);
    marker.bindPopup(label);
    
    return marker;
  }

  function createHoverPoint(point, nextPoint, color) {
    // Use boat_heading from dataset (already computed with centered difference)
    let boatDirection = point.boat_heading;
    
    // Handle null/NaN/0 cases
    if (!boatDirection || isNaN(boatDirection) || boatDirection === 0) {
      boatDirection = null;  // Will display as "N/A"
    }

    let windBoatDiff = null;
    if (boatDirection !== null && point.wind_dir) {
      windBoatDiff = Math.abs(point.wind_dir - boatDirection);
      if (windBoatDiff > 180) windBoatDiff = 360 - windBoatDiff;
    }

    const popupContent = `
      <div style="font-family: 'Outfit', sans-serif; font-size: 0.7rem; line-height: 1.3;">
        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
          
          <div style="background: rgba(255, 255, 255, 0.06); backdrop-filter: blur(12px); padding: 0.45rem 0.55rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12);">
            <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Wind</div>
            <div style="display: flex; justify-content: space-between; gap: 0.8rem;">
              <div>
                <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.4); margin-bottom: 0.1rem;">Speed</div>
                <div style="font-size: 0.75rem; font-weight: 600; color: rgba(255, 255, 255, 0.95);">${Number(point.wind_speed).toFixed(1)} kts</div>
              </div>
              <div>
                <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.4); margin-bottom: 0.1rem;">Dir</div>
                <div style="font-size: 0.75rem; font-weight: 600; color: rgba(255, 255, 255, 0.95);">${Math.round(point.wind_dir)}°</div>
              </div>
            </div>
          </div>

          <div style="background: rgba(255, 255, 255, 0.06); backdrop-filter: blur(12px); padding: 0.45rem 0.55rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12);">
            <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Boat</div>
            <div style="display: flex; justify-content: space-between; gap: 0.8rem;">
              <div>
                <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.4); margin-bottom: 0.1rem;">Speed</div>
                <div style="font-size: 0.75rem; font-weight: 600; color: rgba(255, 255, 255, 0.95);">${Number(point.boat_speed).toFixed(1)} kts</div>
              </div>
              <div>
                <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.4); margin-bottom: 0.1rem;">Dir</div>
                <div style="font-size: 0.75rem; font-weight: 600; color: rgba(255, 255, 255, 0.95);">${boatDirection ? Math.round(boatDirection) + '°' : 'N/A'}</div>
              </div>
            </div>
          </div>

          <div style="background: rgba(255, 255, 255, 0.06); backdrop-filter: blur(12px); padding: 0.45rem 0.55rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12);">
            <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.1rem;">Angle Diff</div>
            <div style="font-size: 0.75rem; font-weight: 600; color: rgba(255, 255, 255, 0.95);">${windBoatDiff !== null ? Math.round(windBoatDiff) + '°' : 'N/A'}</div>
          </div>

        </div>
      </div>
    `;
    
    const hoverIcon = window.L.divIcon({
      html: `<div class="hover-dot"></div>`,
      className: 'hover-point',
      iconSize: [6, 6],
      iconAnchor: [3, 3]
    });
    
    const marker = window.L.marker(
      [Number(point.lat), Number(point.lon)],
      { 
        icon: hoverIcon,
        interactive: true
      }
    ).addTo(map);
    
    marker.bindPopup(popupContent, {
  closeButton: false,
  offset: [0, -6],
  autoPan: true,
  autoPanPadding: [50, 50],
  className: 'fixed-size-popup'
});
    
    marker.on('mouseover', function (e) {
      const el = e.target.getElement();
      if (el) {
        const dot = el.querySelector('.hover-dot');
        if (dot) {
          dot.style.opacity = '1';
          dot.style.transform = 'scale(1)';
        }
      }
      this.openPopup();
    });

    marker.on('mouseout', function (e) {
      const el = e.target.getElement();
      if (el) {
        const dot = el.querySelector('.hover-dot');
        if (dot) {
          dot.style.opacity = '0';
          dot.style.transform = 'scale(0.8)';
        }
      }
      this.closePopup();
    });
    
    gpxLayers.push(marker);
  }

  function bearingBetweenPoints(p1, p2) {
    const lat1 = Number(p1.lat) * Math.PI / 180;
    const lat2 = Number(p2.lat) * Math.PI / 180;
    const dLon = (Number(p2.lon) - Number(p1.lon)) * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    const bearingRad = Math.atan2(y, x);
    const bearingDeg = (bearingRad * 180 / Math.PI + 360) % 360;

    return bearingDeg;
  }

  function calculateBounds() {
    const allPoints = tours.flatMap(tour => tour.points);

    const validPoints = allPoints.filter(p =>
      isValidLatLng(Number(p.lat), Number(p.lon))
    );

    if (validPoints.length === 0) return null;

    const lats = validPoints.map(p => Number(p.lat));
    const lons = validPoints.map(p => Number(p.lon));

    return [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)]
    ];
  }

  function isValidLatLng(lat, lon) {
    return (
      lat !== null && lat !== undefined &&
      lon !== null && lon !== undefined &&
      !isNaN(lat) && !isNaN(lon) &&
      lat >= -90 && lat <= 90 &&
      lon >= -180 && lon <= 180
    );
  }


  function matchesAngleRange(point) {
    if (!point.angle_bin) return false;
    
    // Parse angle_bin string like "120-130" into min and max
    const parts = point.angle_bin.split('-');
    if (parts.length !== 2) return false;
    
    const binMin = parseInt(parts[0]);
    const binMax = parseInt(parts[1]);
    
    // Check if there's any overlap
    return selectedAngleRanges.some(r => {
      return !(binMax <= r.min || binMin >= r.max);
    });
  }

function addInfoControl() {
  if (!map) return;
  
  const info = window.L.control({ position: 'bottomleft' }); // CHANGED from 'topright'
  
  info.onAdd = function() {
    const div = window.L.DomUtil.create('div', 'info-control');
    
    div.innerHTML = `
      <button class="info-button" id="info-btn">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5"/>
          <path d="M10 14V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="10" cy="6.5" r="0.75" fill="currentColor"/>
        </svg>
      </button>
      
      <div class="info-popup" id="info-popup" style="display: none;">
        <div class="info-header">
          <h4>Performance Analysis</h4>
          <button class="info-close" id="info-close">×</button>
        </div>
        
        <div class="info-content">
          ${mode === 'individual' ? `
            <div class="info-section">
              <h5>Individual Tours</h5>
              <p>Each sailing tour is visualized with color-coded trajectory showing boat speed.</p>
            </div>
            
            <div class="info-section">
              <h5>Visualizations</h5>
              <p><strong>Boat Speed:</strong> Blue (slow) → Red (fast)</p>
              <p><strong>Wind Speed:</strong> Blue(light) → Red (strong)</p>
              <p><strong>Arrows:</strong> Boat heading (direction of travel)</p>
              <p><strong>Arrows:</strong> Wind direction & Boat direction</p>
            </div>
            
            <div class="info-section">
              <h5>Hover Points</h5>
              <p>Hover over the path to see detailed wind and boat data at that point.</p>
            </div>
          ` : `
            <div class="info-section">
  <h5>Average Performance Map</h5>
  <p>
    This mode aggregates all recorded sailing points across selected sessions 
    and visualizes performance spatially.
  </p>
</div>

<div class="info-section">
  <h5>Speed Ratio</h5>
  <p><strong>Speed Ratio = Boat Speed ÷ Wind Speed</strong></p>
  <p>
    The wind–boat angle is calculated as the smallest angular difference 
    between boat heading and wind direction (0°–180°).
  </p>
</div>

<div class="info-section">
  <h5>Filtering & Aggregation</h5>
  <p>
    Data is filtered by wind–boat angle using 10° bins.
    The lake is divided into fixed 40m × 40m grid cells.
    Each cell displays the average speed ratio of all points 
    within that area and selected angle range.
  </p>
</div>

<div class="info-section">
  <h5>Color Encoding</h5>
  <p>
    Plasma colormap is used:
    purple indicates lower efficiency,
    yellow indicates higher efficiency.
  </p>
</div>

          `}
        </div>
      </div>
    `;
    
    return div;
  };
  
  const infoControl = info.addTo(map);
  
  // Add event listeners after the control is added to DOM
  setTimeout(() => {
    const btn = document.getElementById('info-btn');
    const popup = document.getElementById('info-popup');
    const close = document.getElementById('info-close');
    
    if (btn && popup && close) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = popup.style.display !== 'none';
        popup.style.display = isVisible ? 'none' : 'block';
      });
      
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.style.display = 'none';
      });
      
      // Close when clicking outside
      document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && !btn.contains(e.target)) {
          popup.style.display = 'none';
        }
      });
    }
  }, 100);
  
  gpxLayers.push({ __legend: infoControl });
}

  // Watch for changes in tours, mode, or angle ranges
  $: {
    const tourHash = tours.map(t => t.id).join(',');
    const angleHash = selectedAngleRanges.map(r => `${r.min}-${r.max}`).join(',');
    const perfHash = sailingPerformancePoints.length;

    const modeHash = `${mode}-${tourHash}-${angleHash}-${perfHash}`;

    if (modeHash !== lastModeHash) {
      lastModeHash = modeHash;
      updateVisualization();
    }
  }

  export function cleanup() {
    clearLayers();
    if (legendControl && map) {
      map.removeControl(legendControl);
      legendControl = null;
    }
  }

</script>

<!-- Leaflet will handle all rendering -->
<div style="display: contents;"></div>


<style>
  :global(.custom-marker) {
    background: transparent !important;
    border: none !important;
  }

  :global(.hover-point) {
    background: transparent !important;
    border: none !important;
    cursor: pointer !important;
  }

  :global(.fixed-size-popup .leaflet-popup-content-wrapper) {
    background: rgba(0, 0, 0, 0.151) !important;
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-radius: 10px !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.093), 
                inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
    padding: 0 !important;
    border: 1px solid rgba(255, 255, 255, 0.15);
    min-width: 140px !important;
  }

  :global(.fixed-size-popup .leaflet-popup-content) {
    margin: 8px !important;
    color: white;
    font-size: 0.7rem !important;
  }

  :global(.fixed-size-popup .leaflet-popup-tip) {
    display: none !important;
  }

  :global(.fixed-size-popup) {
    transform-origin: 50% 100% !important;
  }

  :global(.hover-dot) {
    width: 6px;
    height: 6px;
    background: rgba(0, 0, 0, 0.85);
    border: 1.5px solid rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
    opacity: 0;
    transform: scale(0.8);
    transition: opacity 0.12s ease, transform 0.12s ease;
    pointer-events: none;
  }

  :global(.dot-tooltip .leaflet-tooltip-content) {
    font-family: 'Outfit', sans-serif !important;
    font-size: 0.7rem !important;
    line-height: 1.3 !important;
  }

  :global(.speed-ratio-legend) {
    background: transparent !important;
    border: none !important;
  }

  /* INFO CONTROL STYLES */
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
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
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

  :global(.color-indicator) {
    display: inline-block;
    width: 60px;
    height: 12px;
    border-radius: 2px;
    vertical-align: middle;
    margin-right: 6px;
    border: 1px solid rgba(255, 255, 255, 0.2);
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
</style>