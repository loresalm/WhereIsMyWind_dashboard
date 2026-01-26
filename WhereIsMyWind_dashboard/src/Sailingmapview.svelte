<script>
  import { onMount, afterUpdate } from 'svelte';
  
  export let tours = [];
  export let map = null;

  let markers = [];
  let polylines = [];
  
  // Color palette for different tours
  const tourColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B4D9', '#B8E994'
  ];
  
  let lastTourHash = '';

  // Reactively update map when tours change
  $: if (map && tours.length > 0) {
    const hash = tours.map(t => t.id).join(',');
    if (hash !== lastTourHash) {
      lastTourHash = hash;
      requestAnimationFrame(() => {
        map.invalidateSize();
        updateMap();
      });
    }
  }

  function updateMap() {
    // Clear existing markers and polylines
    clearMapElements();
    
    // Add tour paths and markers
    tours.forEach((tour, index) => {
      const color = tourColors[index % tourColors.length];
      addTourToMap(tour, color);
    });
    
    // Fit bounds to show all tours
    if (tours.length > 0 && tours[0].points.length > 0) {
      const bounds = calculateBounds();
      if (bounds && bounds.length === 2) {
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 16
        });
      }
    }
  }

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

      polylines.push(segment);
    }
    
    // Add start marker
    const startPoint = tour.points[0];
    const startMarker = createCustomMarker(
      [startPoint.lat, startPoint.lon],
      '🏁',
      `Start: ${tour.start_time}`,
      color
    );
    markers.push(startMarker);
    
    // Add end marker
    const endPoint = tour.points[tour.points.length - 1];
    const endMarker = createCustomMarker(
      [endPoint.lat, endPoint.lon],
      '🏁',
      `End: ${tour.end_time}`,
      color
    );
    markers.push(endMarker);

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

      const color = windSpeedToColor(point.wind_speed, minWind, maxWind);
      drawWindVector(point, color);
    });

    // Add hover points for detailed information (NEW!)
    const HOVER_SAMPLE_RATE = 1; // Show hover point every 3rd GPS point
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

    polylines.push(line);
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

  // NEW FUNCTION: Creates hover points with detailed data popups
  function createHoverPoint(point, nextPoint, color) {
    // Calculate boat direction from track
    let boatDirection = point.boat_heading; // fallback
    if (nextPoint) {
      boatDirection = bearingBetweenPoints(point, nextPoint);
    }

    // Calculate angle difference between wind and boat
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
  html: `
    <div class="hover-dot"></div>
  `,
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
        autoPan: false,
        className: 'fixed-size-popup'
        });
    
    // Show marker dot on hover
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

    
    markers.push(marker);
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
    const lats = allPoints.map(p => Number(p.lat));
    const lons = allPoints.map(p => Number(p.lon));
    
    return [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)]
    ];
  }

  function clearMapElements() {
    // Remove all markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Remove all polylines
    polylines.forEach(polyline => map.removeLayer(polyline));
    polylines = [];
  }

  // Cleanup on component destroy
  export function cleanup() {
    clearMapElements();
  }
</script>

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

  /* Prevent popup from scaling with map zoom */
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
</style>