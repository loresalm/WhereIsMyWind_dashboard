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
    
const speeds = tour.points
  .map(p => Number(p.boat_speed))
  .filter(v => !isNaN(v));

const minSpeed = Math.min(...speeds);
const maxSpeed = Math.max(...speeds);

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

    const windSpeeds = tour.points
  .map(p => Number(p.wind_speed))
  .filter(v => !isNaN(v));

const minWind = Math.min(...windSpeeds);
const maxWind = Math.max(...windSpeeds);

const WIND_SAMPLE_RATE = 10;

tour.points.forEach((point, idx) => {
  if (idx % WIND_SAMPLE_RATE !== 0) return;
  if (!point.wind_speed || !point.wind_dir) return;

  const color = windSpeedToColor(
    point.wind_speed,
    minWind,
    maxWind
  );

  drawWindVector(point, color);
});

    
  }

function bearingBetweenPoints(p1, p2) {
  const lat1 = Number(p1.lat) * Math.PI / 180;
  const lat2 = Number(p2.lat) * Math.PI / 180;
  const dLon = (Number(p2.lon) - Number(p1.lon)) * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const bearingRad = Math.atan2(y, x);
  const bearingDeg = (bearingRad * 180 / Math.PI + 360) % 360;

  return bearingDeg; // 0° = North, clockwise
}

function speedToColor(speed, minSpeed, maxSpeed) {
  if (maxSpeed === minSpeed) return '#4CAF50';

  const t = Math.max(0, Math.min(1, (speed - minSpeed) / (maxSpeed - minSpeed)));

  // Blue → Green → Yellow → Red
  if (t < 0.33) {
    return `rgb(
      0,
      ${Math.round(255 * (t / 0.33))},
      255
    )`;
  } else if (t < 0.66) {
    return `rgb(
      ${Math.round(255 * ((t - 0.33) / 0.33))},
      255,
      ${Math.round(255 * (1 - (t - 0.33) / 0.33))}
    )`;
  } else {
    return `rgb(
      255,
      ${Math.round(255 * (1 - (t - 0.66) / 0.34))},
      0
    )`;
  }
}

function windSpeedToColor(speed, min, max) {
  if (max === min) return '#4FC3F7';

  const t = Math.max(0, Math.min(1, (speed - min) / (max - min)));

  // Light blue → green → yellow → red
  if (t < 0.33) {
    return `rgb(
      79,
      ${Math.round(195 + 60 * (t / 0.33))},
      247
    )`;
  } else if (t < 0.66) {
    return `rgb(
      ${Math.round(255 * ((t - 0.33) / 0.33))},
      255,
      120
    )`;
  } else {
    return `rgb(
      255,
      ${Math.round(255 * (1 - (t - 0.66) / 0.34))},
      80
    )`;
  }
}


function drawBoatVectorFromTrack(point, nextPoint, color) {
  if (
    !nextPoint ||
    point.boat_speed == null ||
    isNaN(point.boat_speed)
  ) return;

  const lat = Number(point.lat);
  const lon = Number(point.lon);

  const heading = bearingBetweenPoints(point, nextPoint);

  // Scale: meters per knot (tweak to taste)
  const metersPerKnot = 35;
  const lengthMeters = point.boat_speed * metersPerKnot;

  const angleRad = (heading - 90) * Math.PI / 180;

  const deltaLat = (lengthMeters * Math.sin(angleRad)) / 111320;
  const deltaLon =
    (lengthMeters * Math.cos(angleRad)) /
    (111320 * Math.cos(lat * Math.PI / 180));

  const endLat = lat + deltaLat;
  const endLon = lon + deltaLon;

  const vector = window.L.polyline(
    [
      [lat, lon],
      [endLat, endLon]
    ],
    {
      color,
      weight: 3,
      opacity: 0.85,
      dashArray: '5,4',
      interactive: false
    }
  ).addTo(map);

  polylines.push(vector);
}



function drawWindVector(point, color) {
  const lengthMeters = 120; // fixed visual length
  const angleRad = (point.wind_dir - 90) * Math.PI / 180;

  const lat = Number(point.lat);
  const lon = Number(point.lon);

  const dLat = (lengthMeters / 111111) * Math.sin(angleRad);
  const dLon = (lengthMeters / (111111 * Math.cos(lat * Math.PI / 180))) * Math.cos(angleRad);

  const endLat = lat + dLat;
  const endLon = lon + dLon;

  const line = window.L.polyline(
    [
      [lat, lon],
      [endLat, endLon]
    ],
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

  function createDataMarker(point, color) {
    const popupContent = `
      <div style="font-family: 'Outfit', sans-serif; font-size: 0.85rem;">
        <strong>Boat Data</strong><br/>
        <div style="margin-top: 0.5rem; display: grid; grid-template-columns: auto auto; gap: 0.25rem 0.75rem;">
          <span>Speed:</span><span><strong>${point.boat_speed.toFixed(2)} kts</strong></span>
          <span>Heading:</span><span><strong>${Math.round(point.boat_heading)}°</strong></span>
        </div>
        <hr style="margin: 0.5rem 0; border: none; border-top: 1px solid rgba(0,0,0,0.1);">
        <strong>Wind Data</strong><br/>
        <div style="margin-top: 0.5rem; display: grid; grid-template-columns: auto auto; gap: 0.25rem 0.75rem;">
          <span>Wind Speed:</span><span><strong>${point.wind_speed.toFixed(2)} kts</strong></span>
          <span>Wind Dir:</span><span><strong>${Math.round(point.wind_dir)}°</strong></span>
          <span>Angle:</span><span><strong>${Math.round(point.wind_boat_angle)}°</strong></span>
        </div>
      </div>
    `;
    
    // Create arrow marker showing boat direction
    const arrowIcon = window.L.divIcon({
      html: `
        <div style="
          width: 20px;
          height: 20px;
          position: relative;
          transform: rotate(${point.boat_heading}deg);
        ">
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path d="M10 2 L14 10 L10 8 L6 10 Z" 
                  fill="${color}" 
                  stroke="white" 
                  stroke-width="1"
                  opacity="0.8"/>
          </svg>
        </div>
      `,
      className: 'arrow-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    
    const marker = window.L.marker(
  [Number(point.lat), Number(point.lon)],
  { icon: arrowIcon }
).addTo(map);

    marker.bindPopup(popupContent);
    
    return marker;
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

  :global(.arrow-marker) {
    background: transparent !important;
    border: none !important;
  }

  :global(.leaflet-popup-content-wrapper) {
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(10px);
    border-radius: 12px !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
  }

  :global(.leaflet-popup-tip) {
    background: rgba(255, 255, 255, 0.95) !important;
  }
</style>