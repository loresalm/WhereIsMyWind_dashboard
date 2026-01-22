<script>
  export let start = 0;
  export let end = 24;

  const min = 0;
  const max = 24;
  const step = 1;

  // prevent crossover
  $: {
    if (start > end) start = end;
    if (end < start) end = start;
  }
</script>

<div class="double-slider">
  <!-- track -->
  <div class="track" />

  <!-- active range -->
  <div
    class="range"
    style="
      left: {(start / max) * 100}%;
      right: {100 - (end / max) * 100}%;
    "
  />

<!-- start handle -->
<input
  type="range"
  min="0"
  max="23"
  step="1"
  bind:value={startHour}
  on:input={() => {
    if (endHour - startHour < 1) {
      startHour = endHour - 1;
    }
  }}
/>

<!-- end handle -->
<input
  type="range"
  min="1"
  max="24"
  step="1"
  bind:value={endHour}
  on:input={() => {
    if (endHour - startHour < 1) {
      endHour = startHour + 1;
    }
  }}
/>


  <!-- hour ticks -->
  <div class="ticks">
    {#each Array(25) as _, i}
      <span style="left:{(i / 24) * 100}%"></span>
    {/each}
  </div>
</div>

<style>
  .double-slider {
    position: relative;
    width: 100%;
    height: 32px;
  }

  .track {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 2px;
    background: rgba(255,255,255,0.25);
    transform: translateY(-50%);
  }

  .range {
    position: absolute;
    top: 50%;
    height: 2px;
    background: rgba(255,255,255,0.8);
    transform: translateY(-50%);
  }

  input[type="range"] {
    position: absolute;
    inset: 0;
    width: 100%;
    background: none;
    pointer-events: none;
    -webkit-appearance: none;
  }

  input[type="range"]::-webkit-slider-thumb {
    pointer-events: all;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    border: none;
  }

  input[type="range"]::-moz-range-thumb {
    pointer-events: all;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    border: none;
  }

  .ticks {
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    height: 6px;
  }

  .ticks span {
    position: absolute;
    width: 1px;
    height: 6px;
    background: rgba(255,255,255,0.35);
  }
</style>
