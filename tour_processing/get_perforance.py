"""
Load sailing performance dataset
and ensure required columns exist,
INCLUDING angle_bin as string.
"""

import pandas as pd


# --------------------------------------------------
# 1️⃣ Load dataset
# --------------------------------------------------

csv_path = "data/outputs/all_sailing_performance.csv"
df = pd.read_csv(csv_path)

print(f"Loaded {len(df)} rows.")


# --------------------------------------------------
# 2️⃣ Parse time and extract date
# --------------------------------------------------

df["time"] = pd.to_datetime(df["time"], format="mixed", utc=True)
df["date"] = df["time"].dt.date.astype(str)


# --------------------------------------------------
# 3️⃣ Ensure correct numeric columns
# --------------------------------------------------

numeric_cols = [
    "boat_heading",
    "boat_speed",
    "lat",
    "lon",
    "speed_ratio",
    "wind_boat_angle",
    "wind_dir",
    "wind_speed",
]

for col in numeric_cols:
    df[col] = pd.to_numeric(df[col], errors="coerce")


# --------------------------------------------------
# 4️⃣ Ensure angle_bin is string
# --------------------------------------------------

df["angle_bin"] = df["angle_bin"].astype(str)


# --------------------------------------------------
# 5️⃣ Keep requested columns (INCLUDING angle_bin)
# --------------------------------------------------

df = df[
    [
        "boat_heading",
        "boat_speed",
        "date",
        "end_time",
        "gpx_path",
        "lat",
        "lon",
        "speed_ratio",
        "start_time",
        "wind_boat_angle",
        "angle_bin",
        "wind_dir",
        "wind_speed",
    ]
]


# --------------------------------------------------
# 6️⃣ Remove invalid rows
# --------------------------------------------------

df = df.dropna()

print(f"Final clean dataset size: {len(df)}")


# --------------------------------------------------
# 7️⃣ Save clean version
# --------------------------------------------------

output_path = "data/outputs/all_sailing_performance_clean.csv"
df.to_csv(output_path, index=False)

print(f"Saved clean dataset to: {output_path}")
