"""
Visualize sailing tour for 2025-05-14
This script creates a map visualization showing:
- Blue trajectory line
- Green arrows = boat heading (from corrected computation)
- Red arrows = wind direction
- Yellow dots at measurement points
"""

import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# CONFIGURATION
CSV_FILE = "data/outputs/all_sailing_performance.csv"
TOUR_DATE = "2025-05-14"
OUTPUT_FILE = "data/outputs/tour_2025-05-14_visualization.png"
VECTOR_EVERY_N = 10  # Show arrows every N points
ARROW_SCALE = 0.001  # Arrow length in degrees


def plot_tour():
    """Visualize the sailing tour with trajectory and direction vectors"""
    
    # Load data
    print(f"Loading data from {CSV_FILE}...")
    try:
        df = pd.read_csv(CSV_FILE)
    except FileNotFoundError:
        print(f"\n❌ ERROR: File not found: {CSV_FILE}")
        print("\nTo use this script:")
        print("1. Make sure your CSV file is at: data/outputs/all_sailing_performance.csv")
        print("2. Or upload it and update CSV_FILE variable in the script")
        print("\nFor now, creating a demo visualization with sample data...\n")
        create_demo()
        return
    
    # Convert time to datetime and extract date
    df['time'] = pd.to_datetime(df['time'], format='mixed')
    df['date'] = df['time'].dt.date.astype(str)
    
    # Filter for specific tour date
    tour_data = df[df['date'] == TOUR_DATE].copy()
    
    if len(tour_data) == 0:
        print(f"❌ No data found for date: {TOUR_DATE}")
        print(f"\nAvailable dates:")
        for date in sorted(df['date'].unique()):
            count = len(df[df['date'] == date])
            print(f"  - {date} ({count} points)")
        return
    
    print(f"✓ Found {len(tour_data)} points for {TOUR_DATE}")
    
    # Sort by time
    tour_data = tour_data.sort_values('time')
    
    # Create figure
    fig, ax = plt.subplots(figsize=(16, 14))
    
    # Plot trajectory as blue line
    lons = tour_data['lon'].values
    lats = tour_data['lat'].values
    
    ax.plot(lons, lats, 'b-', linewidth=3, alpha=0.6, label='Trajectory', zorder=1)
    
    # Add start and end markers
    ax.plot(lons[0], lats[0], 'go', markersize=15, label='Start', zorder=5)
    ax.plot(lons[-1], lats[-1], 'rs', markersize=15, label='End', zorder=5)
    
    # Add direction vectors every N points
    vector_count = 0
    for idx, row in tour_data.iterrows():
        if tour_data.index.get_loc(idx) % VECTOR_EVERY_N != 0:
            continue
        
        lon = row['lon']
        lat = row['lat']
        boat_heading = row['boat_heading']
        wind_dir = row['wind_dir']
        
        # Skip if boat heading is invalid
        if pd.isna(boat_heading) or boat_heading == 0:
            continue
        
        # Convert angles to dx, dy for arrows
        # Bearing: 0° = North, 90° = East, 180° = South, 270° = West
        
        # Boat heading arrow (GREEN)
        boat_rad = np.radians(boat_heading)
        dx_boat = ARROW_SCALE * np.sin(boat_rad)
        dy_boat = ARROW_SCALE * np.cos(boat_rad)
        
        ax.annotate('', xy=(lon + dx_boat, lat + dy_boat), xytext=(lon, lat),
           arrowprops=dict(arrowstyle='->', color='green', lw=1, alpha=0.8),
           zorder=3)
        if vector_count == 0:
            ax.plot([], [], color='green', linewidth=2, label='Boat heading')
        
        # Wind direction arrow (RED)
        if not pd.isna(wind_dir):
            wind_rad = np.radians(wind_dir)
            dx_wind = ARROW_SCALE * np.sin(wind_rad)
            dy_wind = ARROW_SCALE * np.cos(wind_rad)
            
            ax.annotate('', xy=(lon + dx_wind, lat + dy_wind), xytext=(lon, lat),
                arrowprops=dict(arrowstyle='->', color='red', lw=1, alpha=0.7),
                zorder=2)
            if vector_count == 0:
                ax.plot([], [], color='red', linewidth=2, label='Wind direction')
        
        # Add small dot at vector point
        ax.plot(lon, lat, 'yo', markersize=6, markeredgecolor='black', 
                markeredgewidth=0.5, alpha=0.8, zorder=4)
        
        vector_count += 1
    
    # Labels and formatting
    ax.set_xlabel('Longitude', fontsize=12, fontweight='bold')
    ax.set_ylabel('Latitude', fontsize=12, fontweight='bold')
    ax.set_title(f'Sailing Tour - {TOUR_DATE}\n'
                 f'{tour_data.iloc[0]["time"].strftime("%H:%M")} - '
                 f'{tour_data.iloc[-1]["time"].strftime("%H:%M")} '
                 f'({len(tour_data)} points, {vector_count} vectors shown)',
                 fontsize=16, fontweight='bold', pad=20)
    
    ax.legend(loc='upper right', fontsize=11, framealpha=0.9)
    ax.grid(True, alpha=0.3, linestyle='--', linewidth=0.5)
    ax.set_aspect('equal', adjustable='box')
    
    # Add statistics box
    stats_text = f'''Tour Statistics:
Duration: {(tour_data.iloc[-1]["time"] - tour_data.iloc[0]["time"]).total_seconds()/3600:.1f} hours
Avg Boat Speed: {tour_data["boat_speed"].mean():.1f} kts
Avg Wind Speed: {tour_data["wind_speed"].mean():.1f} kts
Avg Speed Ratio: {tour_data["speed_ratio"].mean():.2f}
Points: {len(tour_data)}
Vectors Shown: {vector_count}'''
    
    ax.text(0.02, 0.98, stats_text,
            transform=ax.transAxes,
            fontsize=10,
            verticalalignment='top',
            bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.9,
                     edgecolor='black', linewidth=1))
    
    plt.tight_layout()
    plt.savefig(OUTPUT_FILE, dpi=150, bbox_inches='tight')
    print(f"\n✓ Visualization saved to: {OUTPUT_FILE}")
    print(f"  Duration: {tour_data.iloc[0]['time'].strftime('%H:%M')} - "
          f"{tour_data.iloc[-1]['time'].strftime('%H:%M')}")
    print(f"  Points: {len(tour_data)}, Vectors shown: {vector_count}")
    
    plt.close()


def create_demo():
    """Create a demo visualization to show what the script produces"""
    print("Creating demo visualization...\n")
    
    # Create sample sailing data (curved path)
    t = np.linspace(0, 2*np.pi, 100)
    lons = 13.164 + 0.01 * np.cos(t) + 0.002 * np.sin(3*t)
    lats = 52.442 + 0.008 * np.sin(t) + 0.002 * np.cos(2*t)
    
    fig, ax = plt.subplots(figsize=(16, 14))
    
    # Trajectory
    ax.plot(lons, lats, 'b-', linewidth=3, alpha=0.6, label='Trajectory', zorder=1)
    
    # Start/End
    ax.plot(lons[0], lats[0], 'go', markersize=15, label='Start', zorder=5)
    ax.plot(lons[-1], lats[-1], 'rs', markersize=15, label='End', zorder=5)
    
    # Add arrows every 10 points
    for i in range(0, len(lons), 10):
        # Calculate tangent direction
        if i < len(lons) - 1:
            dx = lons[i+1] - lons[i]
            dy = lats[i+1] - lats[i]
            boat_angle = np.degrees(np.arctan2(dx, dy))
        else:
            dx = lons[i] - lons[i-1]
            dy = lats[i] - lats[i-1]
            boat_angle = np.degrees(np.arctan2(dx, dy))
        
        # Boat heading (green)
        boat_rad = np.radians(boat_angle)
        ax.arrow(lons[i], lats[i], 
                0.0005 * np.sin(boat_rad), 0.0005 * np.cos(boat_rad),
                head_width=0.0002, head_length=0.0003,
                fc='green', ec='darkgreen', linewidth=2, alpha=0.8, zorder=3,
                label='Boat heading' if i == 0 else '')
        
        # Wind direction (red) - simulate northwest wind
        wind_angle = 315 + np.random.normal(0, 10)
        wind_rad = np.radians(wind_angle)
        ax.arrow(lons[i], lats[i],
                0.0005 * np.sin(wind_rad), 0.0005 * np.cos(wind_rad),
                head_width=0.00015, head_length=0.00025,
                fc='red', ec='darkred', linewidth=1.5, alpha=0.7, zorder=2,
                label='Wind direction' if i == 0 else '')
        
        # Dot
        ax.plot(lons[i], lats[i], 'yo', markersize=6, 
                markeredgecolor='black', markeredgewidth=0.5, alpha=0.8, zorder=4)
    
    ax.set_xlabel('Longitude', fontsize=12, fontweight='bold')
    ax.set_ylabel('Latitude', fontsize=12, fontweight='bold')
    ax.set_title('DEMO: Sailing Tour Visualization\n'
                 '(Sample data - showing what your tour will look like)',
                 fontsize=16, fontweight='bold', pad=20)
    
    ax.legend(loc='upper right', fontsize=11, framealpha=0.9)
    ax.grid(True, alpha=0.3, linestyle='--', linewidth=0.5)
    ax.set_aspect('equal', adjustable='box')
    
    # Add instruction box
    instruction_text = '''This is a DEMO visualization.

To visualize YOUR data:
1. Upload: all_sailing_performance.csv
2. Place at: data/outputs/
3. Run this script again

Green arrows = Boat heading (tangent to path)
Red arrows = Wind direction
Yellow dots = Measurement points'''
    
    ax.text(0.02, 0.98, instruction_text,
            transform=ax.transAxes,
            fontsize=10,
            verticalalignment='top',
            bbox=dict(boxstyle='round', facecolor='lightyellow', alpha=0.9,
                     edgecolor='red', linewidth=2))
    
    plt.tight_layout()
    plt.savefig(OUTPUT_FILE, dpi=150, bbox_inches='tight')
    print(f"✓ DEMO visualization saved to: {OUTPUT_FILE}")
    print("  This shows what your real data will look like!")
    print("\nTo use with your data:")
    print("  1. Upload all_sailing_performance.csv to data/outputs/")
    print("  2. Run this script again\n")
    
    plt.close()


if __name__ == "__main__":
    plot_tour()