import logging
import random
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

PROPHET_AVAILABLE = False
try:
    from prophet import Prophet
    import pandas as pd
    PROPHET_AVAILABLE = True
    logger.info("Prophet library is available")
except ImportError:
    logger.warning("Prophet library not available, using moving average fallback")


class ProphetService:

    @staticmethod
    def predict(historical_data: list, periods: int = 1) -> dict:
        if PROPHET_AVAILABLE:
            return ProphetService._prophet_predict(historical_data, periods)
        else:
            return ProphetService._moving_average_predict(historical_data, periods)

    @staticmethod
    def _prophet_predict(historical_data: list, periods: int = 1) -> dict:
        try:
            df = pd.DataFrame(historical_data)
            df = df.rename(columns={"date": "ds", "value": "y"})
            df["ds"] = pd.to_datetime(df["ds"])
            df = df.sort_values("ds")

            model = Prophet(
                seasonality_mode="multiplicative",
                changepoint_prior_scale=0.05,
                yearly_seasonality=False,
                weekly_seasonality=True,
                daily_seasonality=False,
            )
            model.fit(df)

            future = model.make_future_dataframe(periods=periods)
            forecast = model.predict(future)

            last = forecast.iloc[-1]

            trend_value = float(last.get("trend", 0))
            weekly_vals = []
            for col in forecast.columns:
                if col.startswith("weekly"):
                    weekly_vals.append(float(last.get(col, 0)))

            result = {
                "yhat": round(float(last["yhat"]), 2),
                "yhat_lower": round(float(last["yhat_lower"]), 2),
                "yhat_upper": round(float(last["yhat_upper"]), 2),
                "trend": round(trend_value, 2),
                "model_params": {
                    "seasonality_mode": "multiplicative",
                    "changepoint_prior_scale": 0.05,
                    "weekly_seasonality_components": weekly_vals,
                },
                "method": "prophet",
            }
            return result

        except Exception as e:
            logger.warning(f"Prophet prediction failed, falling back to moving average: {e}")
            return ProphetService._moving_average_predict(historical_data, periods)

    @staticmethod
    def _moving_average_predict(historical_data: list, periods: int = 1) -> dict:
        values = [d["value"] for d in historical_data if d.get("value") is not None]

        if not values:
            return {
                "yhat": 0,
                "yhat_lower": 0,
                "yhat_upper": 0,
                "trend": 0,
                "model_params": {"method": "moving_average", "window": 0},
                "method": "moving_average",
            }

        window = min(7, len(values))
        recent = values[-window:]
        yhat = sum(recent) / len(recent)

        std_dev = (sum((x - yhat) ** 2 for x in recent) / len(recent)) ** 0.5 if len(recent) > 1 else yhat * 0.2

        trend = 0.0
        if len(values) >= 2:
            half = len(values) // 2
            first_half_avg = sum(values[:half]) / half
            second_half_avg = sum(values[half:]) / (len(values) - half)
            trend = round((second_half_avg - first_half_avg) / half, 2)

        result = {
            "yhat": round(yhat, 2),
            "yhat_lower": round(max(0, yhat - 1.96 * std_dev), 2),
            "yhat_upper": round(yhat + 1.96 * std_dev, 2),
            "trend": trend,
            "model_params": {
                "method": "moving_average",
                "window": window,
            },
            "method": "moving_average",
        }
        return result

    @staticmethod
    def determine_label(predicted_sales: float, current_stock: int) -> tuple:
        if current_stock <= 0:
            return "缺货", "inventory_shortage_out_of_stock"

        days_of_stock = current_stock / predicted_sales if predicted_sales > 0 else float('inf')

        if days_of_stock < 2:
            return "缺货", "inventory_shortage_low_stock"
        elif days_of_stock > 14:
            return "堆积", "inventory_oversupply"
        else:
            return "正常", "normal"
