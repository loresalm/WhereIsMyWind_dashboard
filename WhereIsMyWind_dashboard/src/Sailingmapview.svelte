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
        background: rgba(0, 0, 0, 0.7);
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
          background: rgba(0, 0, 0, 0.7);
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
          background: rgba(0, 0, 0, 0.7);
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
  }

  // Dynamic color function based on speed ratio
  function speedRatioToColor(ratio, minRatio, maxRatio) {
    if (minRatio === maxRatio) return '#ffffbf'; // Return middle color if all values are the same
    
    // Normalize ratio between min and max
    const normalized = (ratio - minRatio) / (maxRatio - minRatio);
    
    // Color gradient: blue (low) -> light blue -> yellow -> orange -> red (high)
    if (normalized < 0.25) {
      // Blue to light blue
      const t = normalized / 0.25;
      return interpolateColor('#2c7bb6', '#abd9e9', t);
    } else if (normalized < 0.5) {
      // Light blue to yellow
      const t = (normalized - 0.25) / 0.25;
      return interpolateColor('#abd9e9', '#ffffbf', t);
    } else if (normalized < 0.75) {
      // Yellow to orange
      const t = (normalized - 0.5) / 0.25;
      return interpolateColor('#ffffbf', '#fdae61', t);
    } else {
      // Orange to red
      const t = (normalized - 0.75) / 0.25;
      return interpolateColor('#fdae61', '#d7191c', t);
    }
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
    filteredPoints.forEach(point => {
      const lat = Number(point.lat);
      const lon = Number(point.lon);
      const speedRatio = Number(point.speed_ratio);

      try {
        // Create circle marker with dynamic color
        const circle = window.L.circleMarker([lat, lon], {
          radius: 6,
          fillColor: speedRatioToColor(speedRatio, minSpeedRatio, maxSpeedRatio),
          color: 'rgba(255, 255, 255, 0.5)',
          weight: 1.5,
          opacity: 0.9,
          fillOpacity: 0.8
        }).addTo(map);

// Add popup with detailed info (same style as tour view)
circle.bindPopup(`
  <div style="font-family: 'Outfit', sans-serif; font-size: 0.7rem; line-height: 1.3;">
    <div style="display: flex; flex-direction: column; gap: 0.4rem;">
      
      <div style="background: rgba(255, 255, 255, 0.06); backdrop-filter: blur(12px); padding: 0.45rem 0.55rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12);">
        <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Speed Ratio</div>
        <div style="font-size: 0.75rem; font-weight: 600; color: rgba(255, 255, 255, 0.95);">${speedRatio.toFixed(3)}</div>
      </div>

      <div style="background: rgba(255, 255, 255, 0.06); backdrop-filter: blur(12px); padding: 0.45rem 0.55rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12);">
        <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Wind</div>
        <div style="display: flex; justify-content: space-between; gap: 0.8rem;">
          <div>
            <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.4); margin-bottom: 0.1rem;">Speed</div>
            <div style="font-size: 0.75rem; font-weight: 600; color: rgba(255, 255, 255, 0.95);">${Number(point.wind_speed || 0).toFixed(1)} kts</div>
          </div>
          <div>
            <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.4); margin-bottom: 0.1rem;">Angle</div>
            <div style="font-size: 0.75rem; font-weight: 600; color: rgba(255, 255, 255, 0.95);">${point.angle_bin || 'N/A'}</div>
          </div>
        </div>
      </div>

      <div style="background: rgba(255, 255, 255, 0.06); backdrop-filter: blur(12px); padding: 0.45rem 0.55rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12);">
        <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Boat Speed</div>
        <div style="font-size: 0.75rem; font-weight: 600; color: rgba(255, 255, 255, 0.95);">${Number(point.boat_speed || 0).toFixed(1)} kts</div>
      </div>

    </div>
  </div>
`, {
  closeButton: false,
  offset: [0, -6],
  autoPan: true,
  autoPanPadding: [50, 50],
  className: 'fixed-size-popup'
});

// Add mouseover/mouseout events to open popup on hover
circle.on('mouseover', function (e) {
  this.openPopup();
});

circle.on('mouseout', function (e) {
  this.closePopup();
});

gpxLayers.push(circle);

        gpxLayers.push(circle);
        markers.push([lat, lon]);
      } catch (error) {
        // Silently fail if marker creation fails
      }
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
          background: rgba(0, 0, 0, 0.7);
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
          <div style="margin-top: 8px; font-size: 0.65rem; color: rgba(255, 255, 255, 0.8);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span>Min: ${minSpeedRatio.toFixed(3)}</span>
              <span>Max: ${maxSpeedRatio.toFixed(3)}</span>
            </div>
            <div style="margin-top: 4px; text-align: center;">
              ${filteredPoints ? filteredPoints.length : 0} points
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
    
    // Draw thin black boat direction arrow using next point
    const nextPoint = tour.points[idx + 1];
    if (nextPoint) {
        const boatDirection = bearingBetweenPoints(point, nextPoint);
        drawDirectionArrow(point, boatDirection, 60, 'rgba(0, 0, 0, 0.6)', 1);
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
  const angleRad = (direction - 90) * Math.PI / 180;
  const lat = Number(point.lat);
  const lon = Number(point.lon);

  const dLat = (lengthMeters / 111111) * Math.sin(angleRad);
  const dLon = (lengthMeters / (111111 * Math.cos(lat * Math.PI / 180))) * Math.cos(angleRad);

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
  const leftDLat = (arrowLength / 111111) * Math.sin(leftAngle);
  const leftDLon = (arrowLength / (111111 * Math.cos(endLat * Math.PI / 180))) * Math.cos(leftAngle);
  
  // Right side of arrowhead
  const rightAngle = backAngle + arrowAngle;
  const rightDLat = (arrowLength / 111111) * Math.sin(rightAngle);
  const rightDLon = (arrowLength / (111111 * Math.cos(endLat * Math.PI / 180))) * Math.cos(rightAngle);

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
    const angleRad = (point.wind_dir - 90) * Math.PI / 180;
    const lat = Number(point.lat);
    const lon = Number(point.lon);

    const dLat = (lengthMeters / 111111) * Math.sin(angleRad);
    const dLon = (lengthMeters / (111111 * Math.cos(lat * Math.PI / 180))) * Math.cos(angleRad);

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
    let boatDirection = point.boat_heading;
    if (nextPoint) {
      boatDirection = bearingBetweenPoints(point, nextPoint);
    }

    let windBoatDiff = Math.abs(point.wind_dir - boatDirection);
    if (windBoatDiff > 180) windBoatDiff = 360 - windBoatDiff;

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
                <div style="font-size: 0.75rem; font-weight: 600; color: rgba(255, 255, 255, 0.95);">${Math.round(boatDirection)}°</div>
              </div>
            </div>
          </div>

          <div style="background: rgba(255, 255, 255, 0.06); backdrop-filter: blur(12px); padding: 0.45rem 0.55rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12);">
            <div style="font-size: 0.55rem; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.1rem;">Angle Diff</div>
            <div style="font-size: 0.75rem; font-weight: 600; color: rgba(255, 255, 255, 0.95);">${Math.round(windBoatDiff)}°</div>
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

  :global(.hover-point) {
    background: transparent !important;
    border: none !important;
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
</style>