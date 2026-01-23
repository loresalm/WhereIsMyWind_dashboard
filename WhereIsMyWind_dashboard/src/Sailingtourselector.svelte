<script>
  export let dateGroups = [];
  export let selectedTours = [];

  function toggleTour(tourId) {
    if (selectedTours.includes(tourId)) {
      selectedTours = selectedTours.filter(id => id !== tourId);
    } else {
      selectedTours = [...selectedTours, tourId];
    }
  }

  function selectAllToursForDate(date) {
    const dateGroup = dateGroups.find(g => g.date === date);
    if (!dateGroup) return;
    
    const tourIds = dateGroup.tours.map(t => t.id);
    const allSelected = tourIds.every(id => selectedTours.includes(id));
    
    if (allSelected) {
      // Deselect all tours for this date
      selectedTours = selectedTours.filter(id => !tourIds.includes(id));
    } else {
      // Select all tours for this date
      const newIds = tourIds.filter(id => !selectedTours.includes(id));
      selectedTours = [...selectedTours, ...newIds];
    }
  }

  function clearSelection() {
    selectedTours = [];
  }
</script>

<div class="sailing-selector">
  <div class="selector-header">
    <h3>Select Sailing Tours</h3>
    {#if selectedTours.length > 0}
      <button class="clear-btn" on:click={clearSelection}>
        Clear ({selectedTours.length})
      </button>
    {/if}
  </div>

  {#if dateGroups.length === 0}
    <div class="no-tours">No sailing tours available</div>
  {:else}
    <div class="date-groups">
      {#each dateGroups as dateGroup}
        <div class="date-group">
          <button 
            class="date-header"
            on:click={() => selectAllToursForDate(dateGroup.date)}
          >
            <span class="date-label">
              {new Date(dateGroup.date).toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </span>
            <span class="tour-count">{dateGroup.tours.length} tour{dateGroup.tours.length !== 1 ? 's' : ''}</span>
          </button>
          
          <div class="tours-list">
            {#each dateGroup.tours as tour}
              <label class="tour-item">
                <input 
                  type="checkbox" 
                  checked={selectedTours.includes(tour.id)}
                  on:change={() => toggleTour(tour.id)}
                />
                <span class="tour-details">
                  <span class="tour-time">{tour.start_time} - {tour.end_time}</span>
                  <span class="tour-points">{tour.points} points</span>
                </span>
              </label>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sailing-selector {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .selector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .selector-header h3 {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0;
  }

  .clear-btn {
    padding: 0.35rem 0.75rem;
    background: rgba(255, 100, 100, 0.2);
    border: 1px solid rgba(255, 100, 100, 0.3);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'Outfit', sans-serif;
  }

  .clear-btn:hover {
    background: rgba(255, 100, 100, 0.3);
    border-color: rgba(255, 100, 100, 0.4);
  }

  .no-tours {
    padding: 1rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .date-groups {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
    padding-right: 0.5rem;
  }

  .date-groups::-webkit-scrollbar {
    width: 6px;
  }

  .date-groups::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }

  .date-groups::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .date-groups::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .date-group {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    overflow: hidden;
  }

  .date-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.2s ease;
    font-family: 'Outfit', sans-serif;
  }

  .date-header:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .date-label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .tour-count {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .tours-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0 0.5rem 0.5rem 0.5rem;
  }

  .tour-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .tour-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .tour-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: rgba(255, 255, 255, 0.8);
  }

  .tour-details {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: 1;
    gap: 0.5rem;
  }

  .tour-time {
    font-size: 0.8rem;
    color: var(--text-primary);
    font-weight: 500;
  }

  .tour-points {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .selector-header h3 {
      font-size: 0.85rem;
    }

    .date-groups {
      max-height: 300px;
    }

    .tour-time {
      font-size: 0.75rem;
    }

    .tour-points {
      font-size: 0.7rem;
    }
  }
</style>