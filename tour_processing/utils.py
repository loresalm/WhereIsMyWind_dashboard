from datetime import datetime
import matplotlib.pyplot as plt   # type: ignore
import numpy as np   # type: ignore
import math
import folium  # type: ignore
import matplotlib.colors as mcolors  # type: ignore
import matplotlib.cm as cm  # type: ignore


def angle_to_bin(angle, step=10, max_angle=180):
    """
    Convert angle (0–180) to a string bin label like '40-50'
    """
    if angle is None or np.isnan(angle):
        return None

    angle = max(0, min(angle, max_angle - 1e-6))
    low = int(angle // step) * step
    high = low + step
    return f"{low}-{high}"


def bearing(lat1, lon1, lat2, lon2):
    """Bearing in degrees, 0° = North, clockwise"""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dlon = math.radians(lon2 - lon1)

    x = math.sin(dlon) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - \
        math.sin(phi1) * math.cos(phi2) * math.cos(dlon)

    brng = math.degrees(math.atan2(x, y))
    return (brng + 360) % 360


def angle_diff(a, b):
    """Smallest angle difference between two bearings"""
    diff = abs(a - b) % 360
    return min(diff, 360 - diff)


def compute_wind_boat_dataset(p_t, s_clean, wind_data):
    """
    p_t: list of (lat, lon, datetime)
    s_clean: list of boat speeds
    wind_data: list of dicts with 'time' (HH:MM), 'speed', 'deg'
    
    IMPROVED: Uses centered difference for smoother heading that's tangent to trajectory
    """

    # Wind arrays (minutes since midnight)
    wind_times = np.array([
        int(datetime.strptime(w["time"], "%H:%M").hour) * 60 +
        int(datetime.strptime(w["time"], "%H:%M").minute)
        for w in wind_data
    ])
    wind_speeds = np.array([w["speed"] for w in wind_data])
    wind_dirs = np.array([w["deg"] for w in wind_data])

    results = []

    for i, ((lat, lon, t), boat_speed) in enumerate(zip(p_t, s_clean)):

        # --- interpolate wind at boat time ---
        boat_min = t.hour * 60 + t.minute + t.second / 60
        wind_speed = float(np.interp(boat_min, wind_times, wind_speeds))
        wind_dir = float(np.interp(boat_min, wind_times, wind_dirs))

        # --- IMPROVED: boat heading using centered difference ---
        if i == 0:
            # First point: use forward difference
            if len(p_t) > 1:
                lat2, lon2, _ = p_t[1]
                boat_heading = bearing(lat, lon, lat2, lon2)
            else:
                boat_heading = np.nan
                
        elif i == len(p_t) - 1:
            # Last point: use backward difference
            lat0, lon0, _ = p_t[i - 1]
            boat_heading = bearing(lat0, lon0, lat, lon)
            
        else:
            # Middle points: centered difference (tangent to trajectory)
            # This looks from previous point to next point
            lat0, lon0, _ = p_t[i - 1]
            lat2, lon2, _ = p_t[i + 1]
            
            # Check if points are different (avoid division issues)
            if (lat0 != lat2 or lon0 != lon2):
                boat_heading = bearing(lat0, lon0, lat2, lon2)
            else:
                boat_heading = np.nan

        # --- wind–boat angle (0–180) ---
        if not np.isnan(boat_heading):
            wind_boat_angle = angle_diff(boat_heading, wind_dir)
        else:
            wind_boat_angle = np.nan

        # --- speed ratio  ---
        if wind_speed > 0:
            speed_ratio = boat_speed / wind_speed
        else:
            speed_ratio = np.nan

        results.append({
            "time": t,
            "lat": lat,
            "lon": lon,
            "boat_heading": boat_heading,
            "boat_speed": float(boat_speed),
            "wind_speed": wind_speed,
            "wind_dir": wind_dir,
            "wind_boat_angle": wind_boat_angle,
            "angle_bin": angle_to_bin(wind_boat_angle),
            "speed_ratio": speed_ratio
        })

    return results


def endpoint(lat, lon, deg, dist_nm):
    """Compute endpoint given start, bearing (deg), and distance in nautical miles."""
    R = 3440.065  # Earth radius in nautical miles
    d = dist_nm / R
    lat1, lon1 = math.radians(lat), math.radians(lon)
    brng = math.radians(deg)

    lat2 = math.asin(math.sin(lat1) * math.cos(d) +
                     math.cos(lat1) * math.sin(d) * math.cos(brng))
    lon2 = lon1 + math.atan2(math.sin(brng) * math.sin(d) * math.cos(lat1),
                             math.cos(d) - math.sin(lat1) * math.sin(lat2))
    return math.degrees(lat2), math.degrees(lon2)


def plot_trajectory_with_vectors(dataset, output_path="trajectory_with_vectors.html", 
                                 every_n=10, arrow_scale=0.02):
    """
    Plot sailing trajectory with boat heading and wind direction vectors.
    
    dataset: list of dicts from compute_wind_boat_dataset
    output_path: where to save HTML map
    every_n: show vectors every N points (default 10)
    arrow_scale: length of arrows in nautical miles
    """
    
    if not dataset:
        print("Empty dataset!")
        return
    
    # Get first valid position for map center
    center_lat = dataset[0]["lat"]
    center_lon = dataset[0]["lon"]
    
    # Create map
    m = folium.Map(location=[center_lat, center_lon], zoom_start=14)
    
    # Draw trajectory line
    trajectory = [(d["lat"], d["lon"]) for d in dataset]
    folium.PolyLine(trajectory, color="blue", weight=3, opacity=0.6).add_to(m)
    
    # Add vectors every N points
    for i, d in enumerate(dataset):
        if i % every_n != 0:
            continue
            
        lat = d["lat"]
        lon = d["lon"]
        boat_heading = d["boat_heading"]
        wind_dir = d["wind_dir"]
        
        # Skip if heading is NaN
        if np.isnan(boat_heading):
            continue
        
        # --- Boat heading vector (GREEN) ---
        boat_end_lat, boat_end_lon = endpoint(lat, lon, boat_heading, arrow_scale)
        folium.PolyLine(
            [(lat, lon), (boat_end_lat, boat_end_lon)],
            color="green",
            weight=3,
            opacity=0.9
        ).add_to(m)
        
        # Add arrowhead for boat
        folium.RegularPolygonMarker(
            location=[boat_end_lat, boat_end_lon],
            number_of_sides=3,
            radius=5,
            rotation=boat_heading,
            color="green",
            fill=True,
            fill_color="green",
            fill_opacity=0.9
        ).add_to(m)
        
        # --- Wind direction vector (RED) ---
        # Wind direction shows where wind is coming FROM
        wind_end_lat, wind_end_lon = endpoint(lat, lon, wind_dir, arrow_scale)
        folium.PolyLine(
            [(lat, lon), (wind_end_lat, wind_end_lon)],
            color="red",
            weight=3,
            opacity=0.9
        ).add_to(m)
        
        # Add arrowhead for wind
        folium.RegularPolygonMarker(
            location=[wind_end_lat, wind_end_lon],
            number_of_sides=3,
            radius=5,
            rotation=wind_dir,
            color="red",
            fill=True,
            fill_color="red",
            fill_opacity=0.9
        ).add_to(m)
        
        # --- Point marker with info ---
        angle = d["wind_boat_angle"]
        angle_str = f"{angle:.1f}°" if not np.isnan(angle) else "N/A"
        
        popup_text = f"""
        <b>Point {i}</b><br>
        Time: {d["time"].strftime('%H:%M:%S')}<br>
        Boat heading: {boat_heading:.1f}°<br>
        Wind from: {wind_dir:.1f}°<br>
        Angle: {angle_str}<br>
        Boat speed: {d["boat_speed"]:.1f} kts<br>
        Wind speed: {d["wind_speed"]:.1f} kts
        """
        
        folium.CircleMarker(
            location=[lat, lon],
            radius=4,
            color="black",
            fill=True,
            fill_color="yellow",
            fill_opacity=0.8,
            popup=folium.Popup(popup_text, max_width=200)
        ).add_to(m)
    
    # Add legend
    legend_html = '''
    <div style="position: fixed; 
                bottom: 50px; right: 50px; width: 220px; height: 120px; 
                background-color: white; border:2px solid grey; z-index:9999; 
                font-size:14px; padding: 10px">
    <p><b>Legend</b></p>
    <p><span style="color:blue;">━━━</span> Boat trajectory</p>
    <p><span style="color:green;">➤</span> Boat heading (direction of travel)</p>
    <p><span style="color:red;">➤</span> Wind direction (from)</p>
    <p><span style="color:yellow;">●</span> Measurement point</p>
    </div>
    '''
    m.get_root().html.add_child(folium.Element(legend_html))
    
    m.save(output_path)
    print(f"Map saved to {output_path}")
    print(f"Showing vectors every {every_n} points")


def plot_speed_ratio_vs_angle(dataset, out_file="speed_ratio_vs_angle.png"):
    """
    Plot speed ratio vs wind-boat angle, properly filtering NaN values
    FIXED: Filters pairs together to avoid size mismatch
    """
    # Filter out entries where EITHER angle OR ratio is NaN
    valid_data = [
        (d["wind_boat_angle"], d["speed_ratio"]) 
        for d in dataset 
        if (d["wind_boat_angle"] is not None and 
            not np.isnan(d["wind_boat_angle"]) and
            d["speed_ratio"] is not None and 
            not np.isnan(d["speed_ratio"]))
    ]
    
    if not valid_data:
        print(f"Warning: No valid data to plot for {out_file}")
        return
    
    # Unpack the valid pairs
    angles, ratios = zip(*valid_data)

    plt.figure(figsize=(6, 4))
    plt.scatter(angles, ratios, c=ratios, cmap="jet", alpha=0.7)
    plt.xlabel("Wind–Boat Angle (°)")
    plt.ylabel("Speed Ratio (boat/wind)")
    plt.title("Speed Ratio vs. Wind–Boat Angle")
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.tight_layout()
    plt.savefig(out_file, dpi=150)
    plt.close()


def plot_polar_speed_ratio(dataset, out_file="polar_speed_ratio.png"):
    """
    Plot polar diagram of speed ratio vs wind-boat angle
    FIXED: Filters pairs together to avoid size mismatch
    """
    # Filter out entries where EITHER angle OR ratio is NaN
    valid_data = [
        (d["wind_boat_angle"], d["speed_ratio"]) 
        for d in dataset 
        if (d["wind_boat_angle"] is not None and 
            not np.isnan(d["wind_boat_angle"]) and
            d["speed_ratio"] is not None and 
            not np.isnan(d["speed_ratio"]))
    ]
    
    if not valid_data:
        print(f"Warning: No valid data to plot for {out_file}")
        return
    
    # Unpack the valid pairs
    angles, ratios = zip(*valid_data)
    
    # Convert to numpy arrays
    angles_rad = np.radians(angles)
    ratios_array = np.array(ratios)

    _, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))
    ax.scatter(angles_rad, ratios_array, c=ratios_array, cmap="jet", s=50, alpha=0.8)

    ax.set_theta_zero_location("N")   # 0° at top
    ax.set_theta_direction(-1)        # clockwise
    ax.set_rlabel_position(30)
    ax.grid(True, color="#000000", linestyle="-", linewidth=1.2)
    ax.set_title("Speed Ratio vs Wind–Boat Angle", pad=20)

    plt.tight_layout()
    plt.savefig(out_file, dpi=150, bbox_inches="tight")
    plt.close()