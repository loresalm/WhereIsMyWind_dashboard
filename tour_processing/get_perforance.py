"""
CORRECTED VERSION - with improved boat heading computation

Changes:
- Uses centered difference (i-1 to i+1) for smooth, tangent headings
- Handles first and last points properly
- Still captures sharp turns (like 90° maneuvers)
- Adds visualization function to verify vectors
"""

import utils_corrected as ut
import utils_wind as utw
import utils_gpx as utgpx
from datetime import time
import re


def extract_date(path):
    match = re.search(r'\d{4}-\d{2}-\d{2}', path)
    return match.group(0) if match else None


def performance(wind_path, gpx_path, start_time, end_time, show_vectors=False):
    """
    Compute sailing performance with CORRECTED heading computation.
    
    Args:
        wind_path: path to wind data JSON
        gpx_path: path to GPX file
        start_time: start time for analysis
        end_time: end time for analysis
        show_vectors: if True, generate trajectory map with vectors
    """
    
    date = extract_date(gpx_path)
    
    # Get wind data
    wind_data = utw.get_wind_range(wind_path, date, time(17, 0, 0), time(22, 0, 0))
    print(f"\nWind data points: {len(wind_data)}")
    
    # Process GPX
    p_t, s, s_clean, _, _ = utgpx.gpx_pipeline(
        gpx_path,
        start_time,
        end_time,
        smooth_win=7,
        acc_trsh=2,
        downsamp_s=8
    )
    print(f"GPS points: {len(p_t)}")
    
    # Compute with CORRECTED heading method
    dataset = ut.compute_wind_boat_dataset(p_t, s_clean, wind_data)
    
    # Generate standard plots
    filename = f"data/outputs/plots/speed_ratio_vs_angle_{date}.png"
    ut.plot_speed_ratio_vs_angle(dataset, out_file=filename)
    
    filename = f"data/outputs/plots/polar_speed_ratio_{date}.png"
    ut.plot_polar_speed_ratio(dataset, out_file=filename)
    
    # Optional: generate trajectory with vectors for verification
    if show_vectors:
        filename = f"data/outputs/plots/trajectory_vectors_{date}.html"
        ut.plot_trajectory_with_vectors(
            dataset, 
            output_path=filename,
            every_n=10,  # Show vectors every 10 points
            arrow_scale=0.02
        )
        print(f"Vector map: {filename}")
    
    return dataset


# Test with single file first
if __name__ == "__main__":
    
    print("="*60)
    print("Testing CORRECTED heading computation")
    print("="*60)
    
    wind_path = "data/inputs/wind/wind_data.json"
    gpx_path = "data/inputs/regattas/2025-05-14T14-38-24.075Z_Watersports_sailing.gpx"
    start_time = time(18, 14, 0)
    end_time = time(20, 0, 0)
    
    # Run with vector visualization
    dataset = performance(
        wind_path, 
        gpx_path, 
        start_time, 
        end_time,
        show_vectors=True  # This creates the map with arrows!
    )
    
    print(f"\nDataset size: {len(dataset)}")
    print("\nSample results (first 3 points):")
    for i in range(min(3, len(dataset))):
        d = dataset[i]
        print(f"\nPoint {i}:")
        print(f"  Boat heading: {d['boat_heading']:.1f}°")
        print(f"  Wind from: {d['wind_dir']:.1f}°")
        print(f"  Wind-boat angle: {d['wind_boat_angle']:.1f}°")