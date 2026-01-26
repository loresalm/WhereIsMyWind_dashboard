<script>
  export let dateGroups = [];
  export let selectedTours = [];

  function toggleTour(tourId) {
    if (selectedTours[0] === tourId) {
      selectedTours = [];
    } else {
      selectedTours = [tourId];
    }
  }
</script>

<div class="sailing-selector">
  <div class="selector-header">
    <h3>Tours</h3>
  </div>

  {#if dateGroups.length === 0}
    <div class="no-tours">No tours</div>
  {:else}
    <div class="date-groups">
      {#each dateGroups as dateGroup}
        <div class="date-group">
          <div class="date-label">
            {new Date(dateGroup.date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}
          </div>

          {#each dateGroup.tours as tour}
            <button
              class="tour-row {selectedTours[0] === tour.id ? 'active' : ''}"
              on:click={() => toggleTour(tour.id)}
            >
              <span class="time">
                {tour.start_time}–{tour.end_time}
              </span>
              <span class="points">
                {tour.points}
              </span>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
.sailing-selector {
  font-family: 'Outfit', sans-serif;
  font-size: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.selector-header h3 {
  font-size: 0.8rem;
  font-weight: 600;
  margin: 0;
}

.selected-indicator {
  font-size: 0.65rem;
  opacity: 0.6;
}

.no-tours {
  font-size: 0.7rem;
  opacity: 0.6;
  padding: 0.25rem 0;
}

.date-groups {
  max-height: 70px; /* ~2 tour rows */
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}


.date-group {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.date-label {
  font-size: 0.6rem;
  padding: 0.1rem 0.25rem;
  opacity: 0.6;
}

.tour-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.2rem 0.4rem;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: background 0.15s ease, border 0.15s ease;
}

.tour-row:hover {
  background: rgba(255, 255, 255, 0.07);
}

.tour-row.active {
  background: rgba(100, 180, 255, 0.2);
  border-color: rgba(100, 180, 255, 0.45);
}

.time {
  font-weight: 500;
  font-size: 0.6rem;
}

.points {
  font-size: 0.65rem;
  opacity: 0.6;
}

.date-groups::-webkit-scrollbar {
  width: 4px;
}

.date-groups::-webkit-scrollbar-track {
  background: transparent; /* remove background */
}

.date-groups::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 4px;
}

.date-groups::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

</style>
