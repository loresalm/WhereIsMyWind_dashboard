<script>
  export let selectedDays = [0, 1, 2, 3, 4, 5, 6];
  export let startDate = '2025-06-01';
  export let endDate = '2025-09-30';
  export let startHour = 1;
  export let endHour = 18;
  export let minAvailableDate = null;
  export let maxAvailableDate = null;
  export let availableDates = [];

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Computed values for date inputs
  $: minStartDate = minAvailableDate;
  $: maxStartDate = endDate || maxAvailableDate;
  $: minEndDate = startDate;
  $: maxEndDate = maxAvailableDate;

  // Validate dates when they change
  $: if (startDate && endDate && startDate > endDate) {
    endDate = startDate;
  }

  // Ensure dates are within available range
  $: if (minAvailableDate && startDate && startDate < minAvailableDate) {
    startDate = minAvailableDate;
  }
  
  $: if (maxAvailableDate && startDate && startDate > maxAvailableDate) {
    startDate = maxAvailableDate;
  }
  
  $: if (minAvailableDate && endDate && endDate < minAvailableDate) {
    endDate = minAvailableDate;
  }
  
  $: if (maxAvailableDate && endDate && endDate > maxAvailableDate) {
    endDate = maxAvailableDate;
  }

  function toggleDay(day) {
    if (selectedDays.includes(day)) {
      selectedDays = selectedDays.filter(d => d !== day);
    } else {
      selectedDays = [...selectedDays, day];
    }
  }
</script>

<div class="filter-controls">
  <!-- Date and Time Row -->
  <div class="filters-row">
    <!-- Date Range -->
    <div class="filter-group">
      <div class="filter-label">Date Range</div>
      <div class="date-inputs">
        <input 
          type="date" 
          class="compact-input" 
          bind:value={startDate}
          min={minStartDate}
          max={maxStartDate}
          title="Start date"
        >
        <span class="separator">→</span>
        <input 
          type="date" 
          class="compact-input" 
          bind:value={endDate}
          min={minEndDate}
          max={maxEndDate}
          title="End date"
        >
      </div>
    </div>

    <!-- Time Range -->
    <div class="filter-group time-group">
      <div class="filter-label">Time Range</div>
      <div class="time-compact">
        <div class="time-display">
          <span class="time-value">{startHour}:00</span>
          <span class="separator">→</span>
          <span class="time-value">{endHour}:00</span>
        </div>
        <div class="time-slider-compact">
          <div class="track"></div>
          <div
            class="range"
            style="
              left: {(startHour / 24) * 100}%;
              right: {100 - (endHour / 24) * 100}%;
            "
          ></div>
          <input
            type="range"
            min="0"
            max="24"
            step="1"
            bind:value={startHour}
            on:input={() => startHour > endHour - 1 && (startHour = endHour - 1)}
          />
          <input
            type="range"
            min="0"
            max="24"
            step="1"
            bind:value={endHour}
            on:input={() => endHour < startHour + 1 && (endHour = startHour + 1)}
          />
        </div>
      </div>
    </div>

    <!-- Days of Week -->
    <div class="filter-group days-group">
      <div class="filter-label">Days</div>
      <div class="days-compact">
        {#each dayNames as day, i}
          <button
            class="day-btn"
            class:active={selectedDays.includes(i)}
            on:click={() => toggleDay(i)}
            title={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}
          >
            {day}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Optional: Available date range hint (can be removed if too cluttered) -->
  {#if minAvailableDate && maxAvailableDate}
    <div class="date-hint-compact">
      Available data: {minAvailableDate} to {maxAvailableDate}
    </div>
  {/if}
</div>

<style>
  .filter-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .filters-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 1.5rem;
    align-items: center;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .filter-label {
    font-size: 0.7rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.5);
  }

  /* Date Inputs */
  .date-inputs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .compact-input {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    color: var(--text-primary);
    font-family: 'Outfit', sans-serif;
    font-size: 0.85rem;
    transition: all 0.3s ease;
    outline: none;
    width: 140px;
  }

  .compact-input:focus {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .separator {
    color: rgba(255, 255, 255, 0.3);
    font-size: 0.9rem;
  }

  /* Time Range */
  .time-group {
    flex: 1;
    min-width: 200px;
  }

  .time-compact {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .time-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }

  .time-value {
    color: var(--text-primary);
    font-weight: 500;
  }

  .time-slider-compact {
    position: relative;
    height: 24px;
  }

  .time-slider-compact input[type="range"] {
    position: absolute;
    inset: 0;
    width: 100%;
    background: none;
    pointer-events: none;
    -webkit-appearance: none;
  }

  .time-slider-compact input[type="range"]::-webkit-slider-thumb {
    pointer-events: all;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: white;
    border: none;
    cursor: pointer;
  }

  .time-slider-compact input[type="range"]::-moz-range-thumb {
    pointer-events: all;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: white;
    border: none;
    cursor: pointer;
  }

  .track {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    background: rgba(255,255,255,0.25);
    transform: translateY(-50%);
  }

  .range {
    position: absolute;
    top: 50%;
    height: 2px;
    background: rgba(255,255,255,0.9);
    transform: translateY(-50%);
  }

  /* Days of Week */
  .days-compact {
    display: flex;
    gap: 0.25rem;
  }

  .day-btn {
    width: 2rem;
    height: 2rem;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .day-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }

  .day-btn.active {
    background: rgba(255, 255, 255, 0.9);
    color: #000;
    border-color: rgba(255, 255, 255, 0.9);
  }

  .date-hint-compact {
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.3);
    text-align: center;
  }

  @media (max-width: 1024px) {
    .filters-row {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .filter-group {
      width: 100%;
    }

    .date-inputs {
      justify-content: space-between;
    }

    .compact-input {
      flex: 1;
      width: auto;
    }
  }

  @media (max-width: 768px) {
    .filters-row {
      gap: 0.75rem;
    }

    .filter-label {
      font-size: 0.65rem;
    }

    .compact-input {
      font-size: 0.8rem;
      padding: 0.4rem 0.6rem;
    }

    .time-display {
      font-size: 0.8rem;
    }

    .day-btn {
      width: 1.75rem;
      height: 1.75rem;
      font-size: 0.7rem;
    }
  }
</style>