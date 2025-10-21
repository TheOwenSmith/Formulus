"""TradingAnalyzer

A lightweight, dependency-friendly analyzer that computes trade returns,
cumulative returns, drawdowns, advanced risk/performance metrics, and
provides plotting helpers (Plotly + Matplotlib).

Usage:
    from trading_analyzer import TradingAnalyzer
    analyzer = TradingAnalyzer(trading_signals_df, raw_price_df, initial_capital=100000)
    stats = analyzer.get_statistics()
    figs = analyzer.plot_all(use_plotly=True)

"""
from __future__ import annotations

import math
from typing import Dict, Any, Optional

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# Optional imports for interactive plotting; functions will still work without these
try:
    import plotly.graph_objs as go
    from plotly.subplots import make_subplots
    _HAS_PLOTLY = True
except Exception:
    _HAS_PLOTLY = False

try:
    from scipy import stats as scipy_stats
    _HAS_SCIPY = True
except Exception:
    _HAS_SCIPY = False


class TradingAnalyzer:
    """Analyze a set of trade signals and produce metrics + plots.

    Expected trading_signals columns:
      - Timestamp (datetime)
      - Price (float)
      - Signal (str): 'LONG', 'SHORT', or 'CLOSE'
      - Position (optional)

    """

    def __init__(
        self,
        trading_signals: pd.DataFrame,
        raw_data: Optional[pd.DataFrame] = None,
        initial_capital: float = 100_000,
    ) -> None:
        # Copy inputs
        self.raw_data = raw_data.copy() if raw_data is not None else None
        self.trading_signals = trading_signals.copy()
        self.initial_capital = float(initial_capital)

        # Validate and normalize
        self._validate_inputs()
        self._normalize()

        # Derived data
        self.analyzed_trades: pd.DataFrame = pd.DataFrame()
        self.stats: Dict[str, Any] = {}
        self.advanced_stats: Dict[str, Any] = {}

        # Run processing
        self._process_trades()
        self._calculate_statistics()
        self._calculate_advanced_statistics()

    # ------------------------- validation / normalization -----------------
    def _validate_inputs(self) -> None:
        required = {"Timestamp", "Price", "Signal"}
        missing = required - set(self.trading_signals.columns)
        if missing:
            raise ValueError(f"trading_signals missing required columns: {missing}")

    def _normalize(self) -> None:
        # Ensure Timestamp is datetime and sorted
        self.trading_signals["Timestamp"] = pd.to_datetime(self.trading_signals["Timestamp"])
        self.trading_signals = self.trading_signals.sort_values("Timestamp").reset_index(drop=True)

        # Uppercase signal values
        self.trading_signals["Signal"] = self.trading_signals["Signal"].astype(str).str.upper()

    # ------------------------- core processing ---------------------------
    def _process_trades(self) -> None:
        """Compute per-trade returns from LONG/SHORT/CLOSE signals.

        Rules used:
        - A LONG or SHORT entry remains open until the next CLOSE signal.
        - Only LONG and SHORT rows are treated as "trade entries" and will have a return.
        - CLOSE rows do not have returns assigned.
        """
        df = self.trading_signals.copy()
        df["Return"] = np.nan

        n = len(df)
        for i in range(n):
            sig = df.loc[i, "Signal"]
            if sig in ("LONG", "SHORT"):
                entry_price = df.loc[i, "Price"]
                # find next CLOSE
                exit_idx = None
                for j in range(i + 1, n):
                    if df.loc[j, "Signal"] == "CLOSE":
                        exit_idx = j
                        break
                if exit_idx is not None:
                    exit_price = df.loc[exit_idx, "Price"]
                    if sig == "LONG":
                        r = (exit_price - entry_price) / entry_price
                    else:
                        r = (entry_price - exit_price) / entry_price
                    df.loc[i, "Return"] = r
                else:
                    # trade never closed -> leave NaN or close at last price if raw_data provided
                    if self.raw_data is not None:
                        # attempt to find last price in raw_data at or after last timestamp
                        last_price = self._get_last_price_after(df.loc[i, "Timestamp"])
                        if last_price is not None:
                            if sig == "LONG":
                                df.loc[i, "Return"] = (last_price - entry_price) / entry_price
                            else:
                                df.loc[i, "Return"] = (entry_price - last_price) / entry_price
                        else:
                            df.loc[i, "Return"] = np.nan
                    else:
                        df.loc[i, "Return"] = np.nan

        # set cumulative / helper cols
        df["Cum_Return"] = (1 + df["Return"].fillna(0)).cumprod() - 1
        df["Equity"] = self.initial_capital * (1 + df["Cum_Return"]) 

        # Ensure types
        df["Return"] = pd.to_numeric(df["Return"], errors="coerce")

        self.analyzed_trades = df

    def _get_last_price_after(self, ts: pd.Timestamp) -> Optional[float]:
        if self.raw_data is None:
            return None
        # raw_data expected to have a timestamp-like index or column
        df = self.raw_data.copy()
        if "Timestamp" in df.columns:
            df["Timestamp"] = pd.to_datetime(df["Timestamp"])
            df = df.sort_values("Timestamp")
            later = df[df["Timestamp"] >= ts]
            if not later.empty:
                return float(later.iloc[-1]["Close"] if "Close" in later.columns else later.iloc[-1][df.columns[-1]])
        else:
            # try index
            try:
                s = df.index
                later = df.loc[df.index >= ts]
                if not later.empty:
                    return float(later.iloc[-1][0])
            except Exception:
                return None
        return None

    # ------------------------- statistics --------------------------------
    def _calculate_statistics(self) -> None:
        df = self.analyzed_trades
        trades = df[df["Signal"].isin(["LONG", "SHORT"])].copy()

        total = len(trades)
        wins = trades[trades["Return"] > 0].shape[0]
        losses = trades[trades["Return"] < 0].shape[0]

        self.stats = {
            "Total Trades": int(total),
            "Winning Trades": int(wins),
            "Losing Trades": int(losses),
            "Win Rate": float(wins / total) if total > 0 else float("nan"),
            "Avg Return": float(trades["Return"].mean()) if total > 0 else float("nan"),
            "Avg Win": float(trades[trades["Return"] > 0]["Return"].mean()) if wins > 0 else float("nan"),
            "Avg Loss": float(trades[trades["Return"] < 0]["Return"].mean()) if losses > 0 else float("nan"),
        }

        # cumulative metrics
        self.analyzed_trades["Cum_Return"] = (1 + self.analyzed_trades["Return"].fillna(0)).cumprod() - 1
        equity = self.initial_capital * (1 + self.analyzed_trades["Cum_Return"]) 
        rolling_max = equity.cummax()
        drawdown = (equity - rolling_max) / rolling_max

        self.stats.update({
            "Max Drawdown": float(drawdown.min()),
            "Final Equity": float(equity.iloc[-1]),
            "Total Return": float(equity.iloc[-1] / self.initial_capital - 1),
        })

        # Sharpe (simple)
        rets = trades["Return"].dropna()
        if len(rets) > 1 and rets.std() > 0:
            annualized_sharpe = rets.mean() / rets.std() * math.sqrt(252)
            self.stats["Sharpe"] = float(annualized_sharpe)
        else:
            self.stats["Sharpe"] = float("nan")

    def _calculate_advanced_statistics(self) -> None:
        df = self.analyzed_trades
        trades = df[df["Signal"].isin(["LONG", "SHORT"])].copy()
        rets = trades["Return"].dropna()

        adv: Dict[str, Any] = {}
        if len(rets) > 0:
            adv["Annualized Volatility"] = float(rets.std() * math.sqrt(252))
            adv["Skewness"] = float(rets.skew())
            adv["Kurtosis"] = float(rets.kurt())
            adv["VaR(95)"] = float(np.percentile(rets, 5))
            adv["CVaR(95)"] = float(rets[rets <= np.percentile(rets, 5)].mean())
            adv["Best Trade"] = float(rets.max())
            adv["Worst Trade"] = float(rets.min())
        else:
            adv = {k: float("nan") for k in [
                "Annualized Volatility", "Skewness", "Kurtosis", "VaR(95)", "CVaR(95)", "Best Trade", "Worst Trade"
            ]}

        # Monthly returns
        df["YearMonth"] = df["Timestamp"].dt.strftime("%Y-%m")
        monthly = df.groupby("YearMonth")["Return"].sum()
        adv["Monthly Returns"] = monthly

        self.advanced_stats = adv

    # ------------------------- plotting helpers --------------------------
    def plot_price_and_signals(self, use_plotly: bool = True):
        df = self.analyzed_trades
        if use_plotly and _HAS_PLOTLY:
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=df["Timestamp"], y=df["Price"], name="Price", line=dict(color="gray")))
            longs = df[df["Signal"] == "LONG"]
            shorts = df[df["Signal"] == "SHORT"]
            closes = df[df["Signal"] == "CLOSE"]
            fig.add_trace(go.Scatter(x=longs["Timestamp"], y=longs["Price"], mode="markers", name="LONG", marker=dict(symbol="triangle-up", color="green")))
            fig.add_trace(go.Scatter(x=shorts["Timestamp"], y=shorts["Price"], mode="markers", name="SHORT", marker=dict(symbol="triangle-down", color="red")))
            fig.add_trace(go.Scatter(x=closes["Timestamp"], y=closes["Price"], mode="markers", name="CLOSE", marker=dict(symbol="x", color="black")))
            fig.update_layout(title="Price & Signals", hovermode="x unified")
            return fig

        # Matplotlib fallback
        fig, ax = plt.subplots(figsize=(14, 6))
        ax.plot(df["Timestamp"], df["Price"], color="gray", label="Price")
        ax.scatter(df[df["Signal"] == "LONG"]["Timestamp"], df[df["Signal"] == "LONG"]["Price"], marker="^", color="green", label="LONG")
        ax.scatter(df[df["Signal"] == "SHORT"]["Timestamp"], df[df["Signal"] == "SHORT"]["Price"], marker="v", color="red", label="SHORT")
        ax.scatter(df[df["Signal"] == "CLOSE"]["Timestamp"], df[df["Signal"] == "CLOSE"]["Price"], marker="x", color="black", label="CLOSE")
        ax.set_title("Price & Signals")
        ax.legend()
        ax.grid(alpha=0.3)
        fig.tight_layout()
        return fig

    def plot_returns_distribution(self, use_plotly: bool = True):
        df = self.analyzed_trades
        if use_plotly and _HAS_PLOTLY:
            fig = make_subplots(rows=1, cols=2, subplot_titles=("All Returns", "Long vs Short"))
            fig.add_trace(go.Histogram(x=df["Return"].dropna(), nbinsx=50, name="All"), row=1, col=1)
            fig.add_trace(go.Histogram(x=df[df["Signal"] == "LONG"]["Return"].dropna(), name="Long", nbinsx=30), row=1, col=2)
            fig.add_trace(go.Histogram(x=df[df["Signal"] == "SHORT"]["Return"].dropna(), name="Short", nbinsx=30), row=1, col=2)
            fig.update_layout(barmode="overlay")
            return fig

        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        sns.histplot(df["Return"].dropna(), bins=50, ax=axes[0])
        axes[0].set_title("All Returns")
        sns.histplot(df[df["Signal"] == "LONG"]["Return"].dropna(), color="green", label="Long", ax=axes[1], bins=30)
        sns.histplot(df[df["Signal"] == "SHORT"]["Return"].dropna(), color="red", label="Short", ax=axes[1], bins=30)
        axes[1].set_title("Long vs Short")
        axes[1].legend()
        fig.tight_layout()
        return fig

    def plot_cumulative(self, use_plotly: bool = True):
        df = self.analyzed_trades
        if use_plotly and _HAS_PLOTLY:
            fig = make_subplots(rows=2, cols=2, subplot_titles=("Equity", "Cum Return", "Drawdown", "Underwater"))
            fig.add_trace(go.Scatter(x=df["Timestamp"], y=df["Equity"], name="Equity"), row=1, col=1)
            fig.add_trace(go.Scatter(x=df["Timestamp"], y=df["Cum_Return"], name="Cum Return"), row=1, col=2)

            equity = df["Equity"]
            drawdown = (equity - equity.cummax()) / equity.cummax()
            fig.add_trace(go.Scatter(x=df["Timestamp"], y=drawdown, name="Drawdown", fill="tozeroy"), row=2, col=1)

            # underwater (cum_return - cum_return.cummax())
            underwater = df["Cum_Return"] - df["Cum_Return"].cummax()
            fig.add_trace(go.Scatter(x=df["Timestamp"], y=underwater, name="Underwater", fill="tozeroy"), row=2, col=2)
            fig.update_layout(height=900)
            return fig

        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        df["Equity"].plot(ax=axes[0, 0])
        axes[0, 0].set_title("Equity")
        df["Cum_Return"].plot(ax=axes[0, 1])
        axes[0, 1].set_title("Cumulative Return")
        equity = df["Equity"]
        ((equity - equity.cummax()) / equity.cummax()).plot(ax=axes[1, 0])
        axes[1, 0].set_title("Drawdown")
        (df["Cum_Return"] - df["Cum_Return"].cummax()).plot(ax=axes[1, 1])
        axes[1, 1].set_title("Underwater")
        fig.tight_layout()
        return fig

    def plot_price_with_slider(self, window_minutes: int = 5, show_windows: bool = True, use_plotly: bool = True):
        """Plot full price series with an interactive time-range slider and optional
        highlighted windows around each trade.

        Args:
            window_minutes: number of minutes before and after each trade to highlight
            show_windows: whether to draw shaded windows around trade timestamps
            use_plotly: if True and Plotly is installed, return a Plotly Figure; otherwise return a Matplotlib Figure
        """
        trades_df = self.analyzed_trades

        # Determine base price series: prefer raw_data (full timeline); fall back to trades_df
        if self.raw_data is not None:
            price_df = self.raw_data.copy()
            # prefer standard column names
            if "Timestamp" in price_df.columns:
                price_df["Timestamp"] = pd.to_datetime(price_df["Timestamp"])
                price_df = price_df.sort_values("Timestamp").reset_index(drop=True)
                if "Close" in price_df.columns:
                    price_df = price_df[["Timestamp", "Close"]].rename(columns={"Close": "Price"})
                elif "Price" in price_df.columns:
                    price_df = price_df[["Timestamp", "Price"]]
                else:
                    # pick the last numeric column
                    numeric_cols = price_df.select_dtypes(include=[np.number]).columns
                    if len(numeric_cols) > 0:
                        price_df = price_df[["Timestamp", numeric_cols[-1]]].rename(columns={numeric_cols[-1]: "Price"})
                    else:
                        raise ValueError("raw_data provided but no price-like numeric column found")
            else:
                # try index-based timestamp
                price_df = price_df.reset_index()
                price_df.rename(columns={price_df.columns[0]: "Timestamp", price_df.columns[1]: "Price"}, inplace=True)
                price_df["Timestamp"] = pd.to_datetime(price_df["Timestamp"])
                price_df = price_df[["Timestamp", "Price"]]
        else:
            # fallback: use trades timestamps & prices (sparse)
            price_df = trades_df[["Timestamp", "Price"]].copy()

        # Ensure timestamps
        price_df["Timestamp"] = pd.to_datetime(price_df["Timestamp"])

        # Overlay trades on top of full price series
        if use_plotly and _HAS_PLOTLY:
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=price_df["Timestamp"], y=price_df["Price"], mode="lines", name="Price", line=dict(color="gray")))

            # Trade markers from trades_df
            longs = trades_df[trades_df["Signal"] == "LONG"]
            shorts = trades_df[trades_df["Signal"] == "SHORT"]
            closes = trades_df[trades_df["Signal"] == "CLOSE"]
            if not longs.empty:
                fig.add_trace(go.Scatter(x=longs["Timestamp"], y=longs["Price"], mode="markers", name="LONG", marker=dict(symbol="triangle-up", color="green", size=9)))
            if not shorts.empty:
                fig.add_trace(go.Scatter(x=shorts["Timestamp"], y=shorts["Price"], mode="markers", name="SHORT", marker=dict(symbol="triangle-down", color="red", size=9)))
            if not closes.empty:
                fig.add_trace(go.Scatter(x=closes["Timestamp"], y=closes["Price"], mode="markers", name="CLOSE", marker=dict(symbol="x", color="black", size=8)))

            # shaded windows around trade times (sampled for performance)
            if show_windows and window_minutes > 0 and not trades_df.empty:
                shapes = []
                min_y = float(price_df["Price"].min())
                max_y = float(price_df["Price"].max())
                half = pd.Timedelta(minutes=window_minutes)
                times = trades_df["Timestamp"]
                max_shapes = 500
                if len(times) > max_shapes:
                    times = times.iloc[:: max(1, len(times) // max_shapes)]
                for t in times:
                    x0 = t - half
                    x1 = t + half
                    shapes.append(dict(type="rect", xref="x", yref="y", x0=x0, x1=x1, y0=min_y, y1=max_y, fillcolor="LightSalmon", opacity=0.12, line_width=0))
                fig.update_layout(shapes=shapes)

            fig.update_layout(
                title=f"Price with Trades (window={window_minutes}min)",
                xaxis=dict(rangeslider=dict(visible=True), type="date"),
                hovermode="x unified",
                height=600,
            )
            return fig

        # Matplotlib fallback: plot full price series and overlay trades
        fig, ax = plt.subplots(figsize=(14, 6))
        ax.plot(price_df["Timestamp"], price_df["Price"], color="gray", label="Price")
        ax.scatter(trades_df[trades_df["Signal"] == "LONG"]["Timestamp"], trades_df[trades_df["Signal"] == "LONG"]["Price"], marker="^", color="green", label="LONG")
        ax.scatter(trades_df[trades_df["Signal"] == "SHORT"]["Timestamp"], trades_df[trades_df["Signal"] == "SHORT"]["Price"], marker="v", color="red", label="SHORT")
        ax.scatter(trades_df[trades_df["Signal"] == "CLOSE"]["Timestamp"], trades_df[trades_df["Signal"] == "CLOSE"]["Price"], marker="x", color="black", label="CLOSE")

        if show_windows and window_minutes > 0 and not trades_df.empty:
            half = pd.Timedelta(minutes=window_minutes)
            times = trades_df["Timestamp"]
            max_patches = 200
            if len(times) > max_patches:
                times = times.iloc[:: max(1, len(times) // max_patches)]
            for t in times:
                start = t - half
                end = t + half
                ax.axvspan(start, end, alpha=0.12, color="orange")

        ax.set_title(f"Price with Trades (window={window_minutes}min)")
        ax.set_xlabel("Time")
        ax.set_ylabel("Price")
        ax.legend()
        ax.grid(alpha=0.3)
        fig.tight_layout()
        return fig

    def plot_performance(self, use_plotly: bool = True):
        # combined performance plots
        figs = {}
        figs["price_signals"] = self.plot_price_and_signals(use_plotly)
        figs["returns_dist"] = self.plot_returns_distribution(use_plotly)
        figs["cumulative"] = self.plot_cumulative(use_plotly)
        return figs

    # ------------------------- reporting helpers -------------------------
    def get_best_worst(self, n: int = 5) -> Dict[str, pd.DataFrame]:
        trades = self.analyzed_trades[self.analyzed_trades["Signal"].isin(["LONG", "SHORT"])].copy()
        best = trades.nlargest(n, "Return")[["Timestamp", "Signal", "Price", "Return"]]
        worst = trades.nsmallest(n, "Return")[["Timestamp", "Signal", "Price", "Return"]]
        return {"best": best, "worst": worst}

    def get_statistics(self) -> Dict[str, Any]:
        return {"basic": self.stats, "advanced": self.advanced_stats}


# If module executed directly, simple smoke test (won't run on import)
if __name__ == "__main__":
    print("TradingAnalyzer module loaded. Import and use in notebooks/script.")
