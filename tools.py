import numpy as np
import pandas as pd
from typing import Tuple, List, Dict
from dataclasses import dataclass



class TechnicalTools:
    def __init__(self, data, epsilon: float = 0.0001):
        """
        Initialize TechnicalTools with configurable sensitivity
        
        Args:
            epsilon: Threshold for considering first derivative (d1) close to zero
        """
        self.data = data
        self.epsilon = epsilon

    def compute_features(self,  
                          price_col: str = "Close", 
                          time_col: str = "Timestamp",
                          target_col : int = 1) -> pd.DataFrame:
        """
        Compute time-aware price kinematics (derivatives and changes)
        
        Args:
            df: DataFrame with price and timestamp columns
            price_col: Name of the price column
            time_col: Name of the timestamp column
            
        Returns:
            DataFrame with added columns:
                d1: First derivative (price velocity)
                d2: Second derivative (price acceleration)
                pct: Percent change
                dpct: Change in percent change
        """
        out = self.data.copy()
        out[time_col] = pd.to_datetime(out[time_col], utc=True, errors="coerce")
        out = out.sort_values(time_col).reset_index(drop=True)

        # Δt in seconds (handle uneven spacing)
        dt = out[time_col].diff().dt.total_seconds()
        med_dt = np.nanmedian(dt)
        dt.iloc[0] = med_dt if np.isfinite(med_dt) and med_dt > 0 else 1.0

        # Derivatives
        out["d1"] = out[price_col].diff() / dt
        out["d2"] = out["d1"].diff() / dt
        
        # Changes
        out["pct"] = out[price_col].pct_change()
        out["dpct"] = out["pct"].diff()

        # target: next period percent change
        out["target"] = (out[price_col].shift(-target_col) - out[price_col])/ out[price_col]

        return out
