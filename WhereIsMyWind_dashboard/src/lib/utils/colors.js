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
