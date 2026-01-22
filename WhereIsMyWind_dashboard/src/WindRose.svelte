<script>
  /* ===== Visual configuration ===== */
  const RING_COLOR = 'rgba(0,0,0,0.7)';
  const LABEL_COLOR = 'rgba(0,0,0,0.7)';
  const HISTOGRAM_COLOR = 'rgba(255,255,255,0.35)';
  const DIRECTION_LINE_COLOR = 'rgba(0,0,0,0.7)';

  /* ===== Data ===== */
  export let data = [];     // normalized [0..1]
  const maxValue = Math.max(...data, 0);
  export let scaleLabels = []; // e.g. [4.2, 8.5]


  const size = 400;
  const center = size / 2;
  const radius = 160;
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



    <!-- Outer tick marks -->
    {#each data as _, i}
    {@const startAngle = (i * 22.5 - 90) * Math.PI / 180}
    {@const endAngle = ((i + 1) * 22.5 - 90) * Math.PI / 180}
    {@const tickAngle = (startAngle + endAngle) / 2}

    <line
        x1={center + Math.cos(tickAngle) * (radius - 6)}
        y1={center + Math.sin(tickAngle) * (radius - 6)}
        x2={center + Math.cos(tickAngle) * (radius + 6)}
        y2={center + Math.sin(tickAngle) * (radius + 6)}
        stroke={RING_COLOR}
        stroke-width="1"
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

  <!-- Direction lines + histograms -->
  {#each data as value, i}
    {@const startAngle = (i * 22.5 - 90) * Math.PI / 180}
    {@const endAngle = ((i + 1) * 22.5 - 90) * Math.PI / 180}
    {@const centerAngle = (startAngle + endAngle) / 2}
    {@const r = radius * value}


    <!-- Histogram sector -->
    <path
        d={`
            M ${center} ${center}
            L ${center + Math.cos(startAngle) * r} ${center + Math.sin(startAngle) * r}
            A ${r} ${r} 0 0 1
            ${center + Math.cos(endAngle) * r} ${center + Math.sin(endAngle) * r}
            Z
        `}
        fill={HISTOGRAM_COLOR}
    />
    <!-- Direction line -->
    <line
        x1={center}
        y1={center}
        x2={center + Math.cos(centerAngle) * r}
        y2={center + Math.sin(centerAngle) * r}
        stroke={DIRECTION_LINE_COLOR}
        stroke-width="1"
    />

  {/each}

  <!-- Center point -->
  <circle cx={center} cy={center} r="3" fill={LABEL_COLOR} />
</svg>

<style>
  .wind-rose {
    width: 100%;
    height: 100%;
  }
</style>
