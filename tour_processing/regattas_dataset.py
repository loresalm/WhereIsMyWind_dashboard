import utils_wind as utw
import utils_gpx as utgpx
import utils as ut
from datetime import time
from datetime import datetime
import re


def extract_date(path):
    match = re.search(r'\d{4}-\d{2}-\d{2}', path)
    return match.group(0) if match else None


def performance(wind_path, gpx_path, start_time, end_time):

    date = extract_date(gpx_path)
    wind_data = utw.get_wind_range(wind_path, date, time(17, 0, 0),
                                   time(22, 0, 0))
    for entry in wind_data:
        print(entry)

    p_t, s, s_clean, _, _ = utgpx.gpx_pipeline(gpx_path,
                                               start_time,
                                               end_time,
                                               smooth_win=7,
                                               acc_trsh=2,
                                               downsamp_s=8)

    dataset = ut.compute_wind_boat_dataset(p_t, s_clean, wind_data)

    filename = f"data/outputs/plots/speed_ratio_vs_angle_{date}.png"
    ut.plot_speed_ratio_vs_angle(dataset,
                                 out_file=filename)
    filename = f"data/outputs/plots/polar_speed_ratio_{date}.png"
    ut.plot_polar_speed_ratio(dataset,
                              out_file=filename)
    return dataset


sailing_data = [
    {
        "gpx_path": "data/inputs/regattas/2025-10-01T15-26-01.835Z_Watersports_sailing.gpx",
        "start_time": time(18, 1, 00),
        "end_time": time(18, 43, 00)
    },
    {
        "gpx_path": "data/inputs/regattas/2025-09-17T14-49-40.608Z_Watersports_sailing.gpx",
        "start_time": time(18, 7, 00),
        "end_time": time(19, 1, 00)
    },
    {
        "gpx_path": "data/inputs/regattas/2025-09-03T14-49-52.970Z_Watersports_sailing.gpx",
        "start_time": time(17, 53, 00),
        "end_time": time(19, 00, 00)
    },
    {
        "gpx_path": "data/inputs/regattas/2025-08-27T15-07-18.846Z_Watersports_sailing.gpx",
        "start_time": time(17, 54, 00),
        "end_time": time(18, 20, 00)
    },
    {
        "gpx_path": "data/inputs/regattas/2025-08-20T15-15-02.312Z_Watersports_sailing.gpx",
        "start_time": time(17, 55, 00),
        "end_time": time(19, 28, 00)
    },
    {
        "gpx_path": "data/inputs/regattas/2025-06-11T14-45-11.582Z_Watersports_sailing.gpx",
        "start_time": time(18, 11, 00),
        "end_time": time(19, 40, 00)
    },
    {
        "gpx_path": "data/inputs/regattas/2025-06-04T14-50-42.569Z_Watersports_sailing.gpx",
        "start_time": time(18, 00, 00),
        "end_time": time(20, 5, 00)
    },
    {
        "gpx_path": "data/inputs/regattas/2025-05-14T14-38-24.075Z_Watersports_sailing.gpx",
        "start_time": time(18, 14, 00),
        "end_time": time(20, 00, 00)
    }
]


import pandas as pd
import matplotlib.pyplot as plt   # type: ignore
import numpy as np   # type: ignore

all_rows = []

for sdata in sailing_data:
    gpx_path = sdata["gpx_path"]
    start_time = sdata["start_time"]
    end_time = sdata["end_time"]

    dataset = performance("data/inputs/wind/wind_data.json", gpx_path, start_time, end_time)

    # Add metadata to each row (optional, but useful)
    for row in dataset:
        row["gpx_path"] = gpx_path
        row["start_time"] = start_time
        row["end_time"] = end_time

    all_rows.extend(dataset)

# Combine everything into one DataFrame
df_all = pd.DataFrame(all_rows)

# Save to CSV
df_all.to_csv("data/outputs/all_sailing_performance.csv", index=False)


# Ensure `time` is a datetime
df_all["time"] = pd.to_datetime(df_all["time"])

# Extract date as a new column
df_all["date"] = df_all["time"].dt.date

# Map each date to a color
unique_dates = sorted(df_all["date"].unique())
colors = plt.cm.tab10(np.linspace(0, 1, len(unique_dates)))  # pick distinct colors
color_map = dict(zip(unique_dates, colors))
point_colors = df_all["date"].map(color_map)

angles = np.radians(df_all["wind_boat_angle"].values)
ratios = np.array(df_all["speed_ratio"].values)

# Plot
fig, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))
sc = ax.scatter(angles, ratios, c=point_colors, s=50, alpha=0.6)

ax.set_theta_zero_location("N")   # 0° at top
ax.set_theta_direction(-1)        # clockwise
ax.set_rlabel_position(30)
ax.grid(True, color="#000000", linestyle="-", linewidth=1.2)
ax.set_title("Speed Ratio vs Wind–Boat Angle (colored by date)", pad=20)

# Add legend
handles = [plt.Line2D([0], [0], marker='o', color='w', label=str(d),
                      markerfacecolor=color_map[d], markersize=8)
           for d in unique_dates]
ax.legend(handles=handles, title="Date", bbox_to_anchor=(1.1, 1.05))

plt.tight_layout()
plt.savefig("all_sailing_performance_by_date.png", dpi=150, bbox_inches="tight")
plt.close()

