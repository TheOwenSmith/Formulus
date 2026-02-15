#!/usr/bin/env python
# coding: utf-8

import pandas as pd
import numpy as np
import os
import sys

# ## Read data

file_to_read = sys.argv[1]
aggregate_timestamp = sys.argv[2]

df = pd.read_csv(f"../worker/data/uncleaned/{file_to_read}")


df.head()


## Parse Timestamps

df["timestamp"] = pd.to_datetime(df["timestamp"])
df["timestamp"] = df["timestamp"].dt.tz_localize(
    "America/New_York",
    nonexistent="shift_forward",  # handles spring-forward DST
    ambiguous="NaT",  # handles fall-back DST
)
df["timestamp"] = df["timestamp"] + pd.Timedelta(hours=1)
df = df.set_index("timestamp").sort_index()


## Remove After-Hours Data

market_open = "09:30"
market_close = "16:00"

df = df.between_time(market_open, market_close)


## Fix Stock Splits

POSSIBLE_RATIOS = np.array(
    [1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 10, 2 / 1, 3 / 1, 4 / 1, 5 / 1]
)
TOLERANCE = 0.02  # 2%


def find_nearest_ratio(x):
    i = np.argmin(abs(POSSIBLE_RATIOS - x))
    if abs(POSSIBLE_RATIOS[i] - x) < TOLERANCE:
        return POSSIBLE_RATIOS[i]
    else:
        return np.nan


df["ratio"] = df["open"] / df["open"].shift(1)
df["split_ratio"] = df["ratio"].apply(find_nearest_ratio)

splits = df.dropna(subset=["split_ratio"])  # does not modify original df
if not splits.empty:
    print(f"Detected {len(splits)} split(s):")
    print(splits[["split_ratio"]])

# Adjust historical prices and volumes for each split
df_adjusted = df.copy()
for timestamp, row in splits.iterrows():
    ratio = row["split_ratio"]
    # All rows *before* the split timestamp need to be adjusted
    df_adjusted.loc[
        df_adjusted.index < timestamp, ["open", "high", "low", "close"]
    ] *= ratio
    df_adjusted.loc[df_adjusted.index < timestamp, "volume"] /= ratio

# Clean up temporary columns
df = df_adjusted.drop(columns=["ratio", "split_ratio"], errors="ignore")


## Remove Bad Ticks

# Example thresholds
lower_thresh = 0.5  # 50% lower than neighbors
upper_thresh = 1.5  # 50% higher than neighbors

# Shifted neighbors
prev = df.shift(1)
next = df.shift(-1)

# Initialize mask for bad ticks
bad_mask = pd.Series(False, index=df.index)

# Check each OHLC column
for col in ["open", "high", "low", "close"]:
    bad_col = (
        (df[col] > prev[col] * upper_thresh) & (df[col] > next[col] * upper_thresh)
    ) | ((df[col] < prev[col] * lower_thresh) & (df[col] < next[col] * lower_thresh))
    bad_mask |= bad_col  # flag if any column is bad

# Logging
num_bad = bad_mask.sum()
print(f"Detected {num_bad} bad tick(s) out of {len(df)} rows")
if num_bad > 0:
    print("Timestamps of bad ticks:")
    print(df.index[bad_mask])

# Remove bad ticks
df = df[~bad_mask]


## Reindex Data

# Define constants
start_time = "10:00" if aggregate_timestamp == "60min" else market_open
freq = "1h" if aggregate_timestamp == "60min" else aggregate_timestamp

# Get unique dates
dates = df.index.normalize().unique()  # just the dates

# Build full RTH index
full_index = pd.DatetimeIndex(
    [
        ts
        for date in dates
        for ts in pd.date_range(
            start=f"{date.date()} {start_time}",
            end=f"{date.date()} {market_close}",
            freq=freq,
        )
    ]
)

# Assign timezone
full_index = full_index.tz_localize(
    "America/New_York", ambiguous="NaT", nonexistent="shift_forward"
)

# Reindex only RTH
df = df.reindex(full_index)


## Linearly Interpolate Missing Data

# Boolean mask: True for rows with at least one missing value
rows_with_missing = df.isna().any(axis=1)

# Count how many rows have missing values
num_missing_rows = rows_with_missing.sum()

# Total number of rows
total_rows = len(df)

# Percentage of rows with missing values
percent_missing = 100 * num_missing_rows / total_rows

print(
    f"{num_missing_rows} out of {total_rows} rows are missing some value "
    f"({percent_missing:.2f}%)"
)

df = df.interpolate(method="linear")


## Front Fill and Back Fill

df = df.ffill().bfill()


## Save data to file

output_dir = "../worker/data/cleaned"
os.makedirs(output_dir, exist_ok=True)

# Round to 4 decimals and integer volume
df[["open", "high", "low", "close"]] = df[["open", "high", "low", "close"]].round(4)
df["volume"] = df["volume"].round(0).astype(int)

# Save cleaned data
df.index.name = "timestamp"
df.to_csv(f"{output_dir}/{file_to_read}", index=True)
