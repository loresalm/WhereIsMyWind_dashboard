export function frequencyToColor(value) {
  // value is already normalized between 0 and 1
  const t = Math.max(0, Math.min(1, value));

  // Blue → Green → Yellow → Red gradient
  if (t < 0.33) {
    // Blue → Cyan → Green
    return `rgb(0, ${Math.round(255 * (t / 0.33))}, 255)`;
  } 
  else if (t < 0.66) {
    // Green → Yellow
    const localT = (t - 0.33) / 0.33;
    return `rgb(${Math.round(255 * localT)}, 255, ${Math.round(255 * (1 - localT))})`;
  } 
  else {
    // Yellow → Red
    const localT = (t - 0.66) / 0.34;
    return `rgb(255, ${Math.round(255 * (1 - localT))}, 0)`;
  }
}


/**
 * Convert wind speed to color (blue = low, red = high)
 * @param {number} speed - Current wind speed
 * @param {number} minSpeed - Minimum speed in dataset
 * @param {number} maxSpeed - Maximum speed in dataset
 * @returns {string} RGB color string
 */
export function speedToColor(speed, minSpeed, maxSpeed) {
  const range = maxSpeed - minSpeed;
  if (range === 0) return 'rgb(100, 150, 255)'; // Default blue
  
  const normalized = (speed - minSpeed) / range;
  
  // Blue (low) → Yellow → Red (high)
  if (normalized < 0.5) {
    // Blue to Yellow
    const t = normalized * 2;
    const r = Math.round(100 + t * 155);
    const g = Math.round(150 + t * 105);
    const b = Math.round(255 * (1 - t));
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Yellow to Red
    const t = (normalized - 0.5) * 2;
    const r = 255;
    const g = Math.round(255 * (1 - t));
    const b = 0;
    return `rgb(${r}, ${g}, ${b})`;
  }
}