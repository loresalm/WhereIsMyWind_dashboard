<script>
  import { onMount } from 'svelte';

  /* ===== Visual configuration ===== */
  const RING_COLOR = 'rgba(0,0,0,0.7)';
  const LABEL_COLOR = 'rgba(0,0,0,0.7)';
  const DIRECTION_LINE_COLOR = 'rgba(0,0,0,0.5)';

  /* ===== Props ===== */
  export let data = [];
  export let hourlyData = [];
  export let mode = 'aggregate';
  export let scaleLabels = [];
  export let currentHourIndex = 0;
  export let maxFrequency = 0.15; // Default value

  const size = 400;
  const center = size / 2;
  const radius = 160;

  $: currentHourData =
    hourlyData[currentHourIndex] ||
    { hour: 0, buckets: [] };

  $: displayData =
    mode === 'hourly'
      ? currentHourData.buckets
      : data;

  // Ensure maxFrequency has a minimum value to avoid division by zero
  $: safeMaxFrequency = Math.max(maxFrequency, 0.01);
</script>

<svg viewBox={`0 0 ${size} ${size}`} class="wind-rose">
  <!-- Add filter for frosted glass effect -->
  <defs>
    <filter id="frosted-glass">
      <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" />
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.7" />
      </feComponentTransfer>
    </filter>
  </defs>

  <!-- Outer ring -->
  <circle
    cx={center}
    cy={center}
    r={radius}
    fill="none"
    stroke={RING_COLOR}
    stroke-width="1.5"
  />

  <!-- Frequency scale rings (5 rings for more detail) -->
  {#each [0.2, 0.4, 0.6, 0.8, 1] as f}
    <circle
      cx={center}
      cy={center}
      r={radius * f}
      fill="none"
      stroke={RING_COLOR}
      stroke-width="0.5"
      stroke-dasharray={f === 1 ? 'none' : '2 4'}
      opacity={f === 1 ? '0.7' : '0.4'}
    />
  {/each}

  <!-- Labels positioned at 45° to avoid overlap -->
  {#each [
    { f: 0.33, index: 0 },
    { f: 0.66, index: 1 },
    { f: 1, index: 2 }
  ] as labelInfo}
    {#if scaleLabels[labelInfo.index]}
      {@const angle = 45 * Math.PI / 180}
      {@const r = radius * labelInfo.f}
      <text
        x={center + Math.cos(angle) * r + 8}
        y={center + Math.sin(angle) * r + 3}
        text-anchor="start"
        font-size="9"
        fill={LABEL_COLOR}
        font-weight="600"
        opacity="0.9"
      >
        {scaleLabels[labelInfo.index]}
      </text>
    {/if}
  {/each}

  <!-- Cardinal direction labels -->
  {#each [
    { deg: 0, label: 'N' },
    { deg: 90, label: 'E' },
    { deg: 180, label: 'S' },
    { deg: 270, label: 'W' }
  ] as dir}
    <text
      x={center + Math.sin(dir.deg * Math.PI / 180) * (radius + 20)}
      y={center - Math.cos(dir.deg * Math.PI / 180) * (radius + 20)}
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="14"
      font-weight="700"
      fill={LABEL_COLOR}
    >
      {dir.label}
    </text>
  {/each}

  <!-- Stacked histogram bars -->
  {#each displayData as bucket, i}
    {@const start = (i * 22.5 - 90) * Math.PI / 180}
    {@const end = ((i + 1) * 22.5 - 90) * Math.PI / 180}
    
    <!-- Render segments from inside out (stacked) -->
    {#if bucket.segments}
      {#each bucket.segments as segment, segIndex}
        {#if segment.frequency > 0}
          {@const segmentHeight = radius * (segment.frequency / safeMaxFrequency)}
          
          <!-- Calculate cumulative radius for stacking -->
          {@const prevSegments = bucket.segments.slice(0, segIndex)}
          {@const cumulativeRadius = prevSegments.reduce((sum, s) => 
            sum + radius * (s.frequency / safeMaxFrequency), 0
          )}
          
          {@const innerR = cumulativeRadius}
          {@const outerR = cumulativeRadius + segmentHeight}
          
          <!-- Draw stacked segment with frosted glass effect -->
          <path
            d={`
              M ${center + Math.cos(start) * innerR} ${center + Math.sin(start) * innerR}
              L ${center + Math.cos(start) * outerR} ${center + Math.sin(start) * outerR}
              A ${outerR} ${outerR} 0 0 1
                ${center + Math.cos(end) * outerR} ${center + Math.sin(end) * outerR}
              L ${center + Math.cos(end) * innerR} ${center + Math.sin(end) * innerR}
              A ${innerR} ${innerR} 0 0 0
                ${center + Math.cos(start) * innerR} ${center + Math.sin(start) * innerR}
              Z
            `}
            fill={segment.color}
            fill-opacity="0.7"
            stroke="rgba(255,255,255,0.5)"
            stroke-width="0.8"
            class="histogram-segment"
            filter="url(#frosted-glass)"
          />
        {/if}
      {/each}
    {/if}
  {/each}

  <!-- Center dot -->
  <circle cx={center} cy={center} r="4" fill={LABEL_COLOR} />
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

  .histogram-segment {
    transition: all 0.2s ease;
  }

  .histogram-segment:hover {
    fill-opacity: 0.9 !important;
    stroke: rgba(255,255,255,0.8);
    stroke-width: 1.2;
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
    left: 6px;
    top: 0;
    bottom: 0;
    width: calc(
      (100% - 12px) * var(--progress, 1)
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
</style>