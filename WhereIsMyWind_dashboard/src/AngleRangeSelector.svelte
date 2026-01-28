<script>
  import { onMount } from 'svelte';

  export let selectedRanges = [];

  // ===== COLOR CONFIGURATION =====
  const COLORS = {
    primary: 'rgba(100, 180, 255, 1)',        // Main selection color
    primaryLight: 'rgba(100, 180, 255, 0.3)', // Selected segment fill
    primaryBorder: 'rgba(100, 180, 255, 0.6)', // Selected segment border
    
    background: 'rgba(255, 255, 255, 0.03)',   // Unselected segment fill
    border: 'rgba(255, 255, 255, 0.1)',        // Unselected segment border
    
    text: 'rgba(255, 255, 255, 0.5)',          // Unselected labels
    textSelected: 'rgba(100, 180, 255, 1)',    // Selected labels
    
    centerCircle: 'rgba(255, 255, 255, 0.1)',  // Center circle fill
    centerBorder: 'rgba(255, 255, 255, 0.3)',  // Center circle border
    
    divider: 'rgba(255, 255, 255, 0.15)',      // Horizontal line
    
    zoneLine: 'rgba(100, 180, 255, 0.5)',      // Sailing zone reference lines
  };

  const STEP = 10;
  const NUM_SEGMENTS = 18; // 0-180 in 10 degree steps
  
  let canvas;
  let ctx;
  const canvasSize = 280;
  const centerX = canvasSize / 2;
  const centerY = canvasSize / 2;
  const radius = 110;

  onMount(() => {
    canvas = document.getElementById('wind-angle-canvas');
    ctx = canvas.getContext('2d');
    draw();
  });

  function draw() {
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    
    // Draw sailing zone reference lines
    drawZoneLines();
    
    // Draw each segment (0-180 degrees, which covers both sides due to symmetry)
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const startAngle = i * STEP;
      const endAngle = (i + 1) * STEP;
      const isSelected = selectedRanges.some(r => r.min === startAngle);
      
      // Convert to canvas angles (canvas uses radians, 0 is at 3 o'clock)
      // We want 0° at top, so subtract 90°
      const canvasStartAngle = ((startAngle - 90) * Math.PI) / 180;
      const canvasEndAngle = ((endAngle - 90) * Math.PI) / 180;
      
      // Mirror angle for the left side (180-360 mapped to 180-0)
      const mirrorStartAngle = ((180 + (180 - endAngle) - 90) * Math.PI) / 180;
      const mirrorEndAngle = ((180 + (180 - startAngle) - 90) * Math.PI) / 180;
      
      // Draw right side segment (0-180)
      drawSegment(canvasStartAngle, canvasEndAngle, isSelected);
      
      // Draw left side segment (mirror)
      drawSegment(mirrorStartAngle, mirrorEndAngle, isSelected);
      
      // Draw label only once (on right side)
      if (i % 2 === 0) { // Only every other label to reduce clutter
        const labelAngle = ((startAngle + 5 - 90) * Math.PI) / 180;
        const labelRadius = radius + 25;
        const x = centerX + Math.cos(labelAngle) * labelRadius;
        const y = centerY + Math.sin(labelAngle) * labelRadius;
        
        ctx.font = '11px "Outfit", sans-serif';
        ctx.fillStyle = isSelected ? COLORS.textSelected : COLORS.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${startAngle}°`, x, y);
      }
    }
    
    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.centerCircle;
    ctx.fill();
    ctx.strokeStyle = COLORS.centerBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw horizontal divider line
    ctx.beginPath();
    ctx.moveTo(centerX - radius - 5, centerY);
    ctx.lineTo(centerX + radius + 5, centerY);
    ctx.strokeStyle = COLORS.divider;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawZoneLines() {
    const zones = [
      { angle: 30, label: 'Close Hauled (start)' },
      { angle: 45, label: 'Close Hauled (end)' },
      { angle: 90, label: 'Beam Reach' },
      { angle: 120, label: 'Broad Reach (start)' },
      { angle: 160, label: 'Broad Reach (end)' },
      { angle: 180, label: 'Running' }
    ];

    zones.forEach(zone => {
      const canvasAngle = ((zone.angle - 90) * Math.PI) / 180;
      const mirrorAngle = ((180 + (180 - zone.angle) - 90) * Math.PI) / 180;
      
      // Draw line on right side
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(canvasAngle) * (radius + 5),
        centerY + Math.sin(canvasAngle) * (radius + 5)
      );
      ctx.strokeStyle = COLORS.zoneLine;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw line on left side (mirror)
      if (zone.angle !== 180) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
          centerX + Math.cos(mirrorAngle) * (radius + 5),
          centerY + Math.sin(mirrorAngle) * (radius + 5)
        );
        ctx.strokeStyle = COLORS.zoneLine;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }

  function drawSegment(startAngle, endAngle, isSelected) {
    const innerRadius = 40;
    
    // Fill
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = isSelected ? COLORS.primaryLight : COLORS.background;
    ctx.fill();
    
    // Stroke
    ctx.strokeStyle = isSelected ? COLORS.primaryBorder : COLORS.border;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();
  }

  function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check if click is within the ring
    if (distance < 40 || distance > radius) return;
    
    // Calculate angle (0° at top, clockwise)
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;
    
    // Map left side (180-360) to right side (0-180)
    if (angle > 180) {
      angle = 360 - angle;
    }
    
    // Find which segment was clicked
    const segmentIndex = Math.floor(angle / STEP);
    const startAngle = segmentIndex * STEP;
    const endAngle = (segmentIndex + 1) * STEP;
    
    toggleRange(startAngle, endAngle);
  }

  function toggleRange(min, max) {
    const exists = selectedRanges.some(r => r.min === min);
    
    if (exists) {
      selectedRanges = selectedRanges.filter(r => r.min !== min);
    } else {
      selectedRanges = [...selectedRanges, { min, max }];
    }
    
    draw();
  }

  function selectAll() {
    selectedRanges = Array.from({ length: NUM_SEGMENTS }, (_, i) => ({
      min: i * STEP,
      max: (i + 1) * STEP
    }));
    draw();
  }

  function clearAll() {
    selectedRanges = [];
    draw();
  }

  $: if (ctx) draw();
</script>

<div class="wind-angle-selector">
  <div class="header">
    <h3>Point of Sail Selection (wind - boat angle)</h3>
    <div class="controls">
      <button on:click={selectAll}>All</button>
      <button on:click={clearAll}>Clear</button>
    </div>
  </div>

  <div class="canvas-wrapper">
    <canvas
      id="wind-angle-canvas"
      width={canvasSize}
      height={canvasSize}
      on:click={handleClick}
    />
  </div>


</div>

<style>
  .wind-angle-selector {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    font-family: 'Outfit', sans-serif;
    padding: 0.5rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h3 {
    font-size: 0.9rem;
    font-weight: 600;
    margin: 0;
    color: rgba(255, 255, 255, 0.95);
  }

  .controls {
    display: flex;
    gap: 0.4rem;
  }

  .controls button {
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.65rem;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'Outfit', sans-serif;
    font-weight: 500;
  }

  .controls button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 0.95);
  }

  .canvas-wrapper {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  canvas {
    cursor: pointer;
    display: block;
    filter: drop-shadow(0 0 20px rgba(0, 0, 0, 0.3));
  }

</style>