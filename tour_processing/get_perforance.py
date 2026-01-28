import utils as ut
import utils_wind as utw
import utils_gpx as utgpx
from datetime import time

wind_path = "inputs/wind/wind_data.json"
gpx_path = "inputs/regattas/2025-05-14T14-38-24.075Z_Watersports_sailing.gpx"
date = "2025-05-14"
target_time = "16:00"

start_time = time(18, 14, 00)  # 18:00:00
end_time = time(20, 00, 00)  # 18:00:00

wind_data = utw.get_wind_range(wind_path, date, time(17, 0, 0), time(22, 0, 0))
for entry in wind_data:
    print(entry)

p_t, s, s_clean, s_clean_norm, accel = utgpx.gpx_pipeline(gpx_path,
                                                          start_time,
                                                          end_time,
                                                          smooth_win=7,
                                                          acc_trsh=2,
                                                          downsamp_s=8)

dataset = ut.compute_wind_boat_dataset(p_t, s_clean, wind_data)
ut.plot_speed_ratio_vs_angle(dataset,
                             out_file="outputs/plots/speed_ratio_vs_angle_A.png")
ut.plot_polar_speed_ratio(dataset,
                          out_file="outputs/plots/polar_speed_ratio_A.png")

"""
print("points with times")
print(p_t[:5])
print("speeds")
print(s[:5])
print("cleaned speeds")
print(s_clean[:5])
print("accelerations")
print(accel[:5])
"""
