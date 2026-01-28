from datetime import datetime
import matplotlib.pyplot as plt   # type: ignore
import numpy as np   # type: ignore
import math


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

        # --- boat heading from NEXT point ---
        if i < len(p_t) - 1:
            lat2, lon2, _ = p_t[i + 1]
            if lat != lat2 or lon != lon2:
                boat_heading = bearing(lat, lon, lat2, lon2)
            else:
                boat_heading = np.nan
        else:
            boat_heading = np.nan

        # --- wind–boat angle (0–180) ---
        if not np.isnan(boat_heading):
            wind_boat_angle = angle_diff(boat_heading, wind_dir)
        else:
            wind_boat_angle = np.nan

        # --- speed ratio (0–1) ---
        if wind_speed > 0:
            speed_ratio = min(max(boat_speed / wind_speed, 0), 1)
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

def plot_speed_ratio_vs_angle(dataset, out_file="speed_ratio_vs_angle.png"):
    angles = [d["wind_boat_angle"]
              for d in dataset if d["wind_boat_angle"] is not None]
    ratios = [d["speed_ratio"]
              for d in dataset if d["speed_ratio"] is not None]

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
    angles = np.radians([d["wind_boat_angle"] for d in dataset])
    ratios = np.array([d["speed_ratio"] for d in dataset])

    _, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))
    ax.scatter(angles, ratios, c=ratios, cmap="jet", s=50, alpha=0.8)

    ax.set_theta_zero_location("N")   # 0° at top
    ax.set_theta_direction(-1)        # clockwise
    ax.set_rlabel_position(30)
    ax.grid(True, color="#000000", linestyle="-", linewidth=1.2)
    ax.set_title("Speed Ratio vs Wind–Boat Angle", pad=20)

    plt.tight_layout()
    plt.savefig(out_file, dpi=150, bbox_inches="tight")
    plt.close()
