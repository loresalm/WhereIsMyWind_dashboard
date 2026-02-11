<script>
  import { onMount } from 'svelte';
  import { frequencyToColor } from './lib/utils/colors.js';


  /* ===== Visual configuration ===== */
  const RING_COLOR = 'rgba(0,0,0,0.7)';
  const LABEL_COLOR = 'rgba(0,0,0,0.7)';
  const HISTOGRAM_COLOR = 'rgba(100,150,255,0.5)';
  const DIRECTION_LINE_COLOR = 'rgba(0,0,0,0.7)';
  const HOURLY_COLOR = 'rgba(100,150,255,0.5)';
  

  /* ===== Data ===== */
  export let data = [];
  export let hourlyData = [];
  export let mode = 'aggregate';
  export let scaleLabels = [];
  export let currentHourIndex = 0;

  const size = 400;
  const center = size / 2;
  const radius = 160;


  

 



  $: currentHourData =
    hourlyData[currentHourIndex] ||
    { hour: 0, buckets: new Array(16).fill(0), avgSpeed: 0 };

  $: displayData =
    mode === 'hourly'
      ? currentHourData.buckets
      : data;
  $: frequencies = displayData.map(b => b.frequency ?? 0);
  
  $: minFreq = Math.min(...frequencies);
  $: maxFreq = Math.max(...frequencies);

  $: freqRange = Math.max(maxFreq - minFreq, 0.00001);

</script>

<svg viewBox={`0 0 ${size} ${size}`} class="wind-rose">
  <!-- Outer ring -->
  <circle
    cx={center}
    cy={center}
    r={radius}
    fill="none"
    stroke={RING_COLOR}
    stroke-width="1"
  />

  <!-- Speed scale rings + labels -->
  {#each [0.33, 0.66, 1] as f, i}
    <circle
      cx={center}
      cy={center}
      r={radius * f}
      fill="none"
      stroke={RING_COLOR}
      stroke-dasharray={f === 1 ? 'none' : '2 4'}
    />

    {#if scaleLabels[i]}
      <text
        x={center}
        y={center - radius * f + 14}
        text-anchor="middle"
        font-size="11"
        fill={LABEL_COLOR}
      >
        {scaleLabels[i]} kt
      </text>
    {/if}
  {/each}

  <!-- Tick marks -->
  {#each displayData as _, i}
    {@const a = ((i + 0.5) * 22.5 - 90) * Math.PI / 180}
    <line
      x1={center + Math.cos(a) * (radius - 6)}
      y1={center + Math.sin(a) * (radius - 6)}
      x2={center + Math.cos(a) * (radius + 6)}
      y2={center + Math.sin(a) * (radius + 6)}
      stroke={RING_COLOR}
    />
  {/each}

  <!-- Degree labels -->
  {#each [0, 90, 180, 270] as deg}
    <text
      x={center + Math.sin(deg * Math.PI / 180) * (radius + 18)}
      y={center - Math.cos(deg * Math.PI / 180) * (radius + 18)}
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="12"
      fill={LABEL_COLOR}
    >
      {deg}°
    </text>
  {/each}

  <!-- Histograms + direction lines -->
  {#each displayData as bucket, i}
    {@const start = (i * 22.5 - 90) * Math.PI / 180}
    {@const end = ((i + 1) * 22.5 - 90) * Math.PI / 180}
    {@const mid = (start + end) / 2}
    {@const r = radius * (bucket.radius ?? bucket)}


    {@const freq = bucket.frequency ?? 0}
    {@const normalizedFreq = (freq - minFreq) / freqRange}
    {@const fillColor = frequencyToColor(normalizedFreq)}

    <path
      d={`
        M ${center} ${center}
        L ${center + Math.cos(start) * r} ${center + Math.sin(start) * r}
        A ${r} ${r} 0 0 1
        ${center + Math.cos(end) * r} ${center + Math.sin(end) * r}
        Z
      `}
      fill={fillColor}
      fill-opacity="0.65"
      class="histogram-sector"
    />


    <line
      x1={center}
      y1={center}
      x2={center + Math.cos(mid) * r}
      y2={center + Math.sin(mid) * r}
      stroke={DIRECTION_LINE_COLOR}
    />
  {/each}

  <circle cx={center} cy={center} r="3" fill={LABEL_COLOR} />
</svg>


{#if mode === 'hourly'}
  <div class="hourly-controls">
    <div class="hour-indicator">{currentHourData.hour}:00</div>

    <div class="progress-bar">
      <div
        class="progress-fill"
        style="--progress: {(currentHourIndex + 1) / hourlyData.length}"
      />
      <div class="progress-dots">
        {#each hourlyData as _, i}
          <div
            class="progress-dot"
            class:active={i === currentHourIndex}
            class:passed={i < currentHourIndex}
          />
        {/each}
      </div>
    </div>
  </div>
{/if}


<style>
  .wind-rose {
    width: 100%;
    height: 100%;
  }

  .histogram-sector {
    transition: fill 0.3s ease;
  }

  .hourly-controls {
  position: absolute;
  bottom: 0.6rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;

  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);

  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 8px 20px rgba(0,0,0,0.15);

  padding: 0.5rem 1.5rem;
  border-radius: 28px;
  min-width: 260px;
}


  .hour-indicator {
    font-size: 0.9rem;
    font-weight: 600;
    color: white;
    letter-spacing: 0.05em;
  }

  .progress-bar {
    position: relative;
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
  }

  .progress-fill {
    position: absolute;
    left: var(--dot-inset);
    top: 0;
    bottom: 0;
    width: calc(
      (100% - (var(--dot-inset) * 2)) *
      ((var(--progress, 1)))
      );
    background: linear-gradient(90deg, rgba(100,150,255,0.6), rgba(100,150,255,0.9));
    border-radius: 6px;
  }

  .progress-dots {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: space-between;
    padding: 0 6px;
    align-items: center;
  }

  .progress-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
  }

  .progress-dot.active {
    width: 6px;
    height: 6px;
    background: white;
  }

  .progress-dot.passed {
    background: rgba(100, 150, 255, 0.8);
  }
  .frequency-legend {
  position: absolute;
  bottom: 0.8rem;
  right: 0.8rem;

  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  padding: 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);

  color: white;
  font-size: 0.7rem;
  min-width: 120px;
}

.frequency-legend h4 {
  margin: 0 0 8px 0;
  font-size: 0.8rem;
  text-align: center;
}

.legend-gradient {
  display: flex;
  flex-direction: column;
  height: 100px;
  width: 15px;
  overflow: hidden;
  border-radius: 3px;
}

.wind-rose {
  width: 100%;
  height: 100%;
  position: relative;
}


</style>
