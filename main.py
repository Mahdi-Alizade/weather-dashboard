import os
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import httpx
from dotenv import load_dotenv

from cache_service import SimpleMemoryCache

# Load environment variables
load_dotenv(override=True)

# Sanitize API key from environment
raw_api_key = os.getenv("OPENWEATHER_API_KEY", "")
API_KEY = raw_api_key.strip().strip('"').strip("'")
BASE_URL = "https://api.openweathermap.org/data/2.5"

app = FastAPI(title="Weather Dashboard API", version="1.3.0")

# In-memory cache with 10 minutes TTL
weather_cache = SimpleMemoryCache(default_ttl_seconds=600)

# Ensure static folder exists and mount it
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


def extract_hourly_forecast(forecast_data: Dict[str, Any], count: int = 8) -> List[Dict[str, Any]]:
    """
    Extracts the nearest future 3-hour forecast intervals (up to 24 hours).
    """
    if not forecast_data:
        return []

    forecast_items = forecast_data.get("list", [])
    if not forecast_items:
        return []

    hourly_list = []
    # Take first slots (~24 hours: 8 intervals x 3 hours)
    for entry in forecast_items[:count]:
        time_text = entry.get("dt_txt", "")
        formatted_hour = ""
        if len(time_text) >= 16:
            formatted_hour = time_text[11:16]

        main_info = entry.get("main", {})
        weather_arr = entry.get("weather", [])
        weather_first = weather_arr[0] if weather_arr else {}

        hourly_list.append({
            "timestamp": entry.get("dt"),
            "hour": formatted_hour,
            "temp": round(main_info.get("temp", 0)),
            "feels_like": round(main_info.get("feels_like", 0)),
            "humidity": main_info.get("humidity", 0),
            "pop": round(entry.get("pop", 0) * 100),
            "icon": weather_first.get("icon", "01d"),
            "condition": weather_first.get("main", "")
        })

    return hourly_list


def parse_air_quality(pollution_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Interprets OpenWeather Air Pollution response and maps AQI scale (1 to 5).
    """
    if not pollution_data:
        return {}

    items = pollution_data.get("list", [])
    if not items:
        return {}

    target = items[0]
    main_section = target.get("main", {})
    aqi_index = main_section.get("aqi", 1)
    components = target.get("components", {})

    status_mapping = {
        1: {"label": "Good", "color": "#10b981", "advisory": "Air quality is ideal for outdoor activities."},
        2: {"label": "Fair", "color": "#84cc16", "advisory": "Acceptable air quality for most individuals."},
        3: {"label": "Moderate", "color": "#f59e0b", "advisory": "Sensitive groups should limit prolonged exertion."},
        4: {"label": "Poor", "color": "#f97316", "advisory": "Wear a mask if sensitive; reduce outdoor exercise."},
        5: {"label": "Very Poor", "color": "#ef4444", "advisory": "Health alert: Avoid extended outdoor exposure."}
    }

    meta = status_mapping.get(aqi_index, status_mapping[1])

    return {
        "aqi": aqi_index,
        "status": meta["label"],
        "color": meta["color"],
        "advisory": meta["advisory"],
        "pm2_5": round(components.get("pm2_5", 0), 1),
        "pm10": round(components.get("pm10", 0), 1),
        "no2": round(components.get("no2", 0), 1),
        "o3": round(components.get("o3", 0), 1)
    }


@app.get("/")
async def serve_index():
    return FileResponse("static/index.html")


@app.get("/api/weather")
async def get_weather(
    response: Response,
    city: Optional[str] = Query(None, description="City name"),
    lat: Optional[float] = Query(None, description="Latitude"),
    lon: Optional[float] = Query(None, description="Longitude"),
    units: str = Query("metric", description="Temperature unit (metric/imperial)")
):
    if not API_KEY or API_KEY == "your_openweather_api_key_here":
        raise HTTPException(
            status_code=500,
            detail="OpenWeather API key is not configured in .env file."
        )

    if not city and (lat is None or lon is None):
        raise HTTPException(
            status_code=400,
            detail="Please provide either a city name or latitude/longitude coordinates."
        )

    # Build unique cache key
    if city:
        normalized_city = city.strip().lower()
        cache_key = f"city:{normalized_city}:{units}"
    else:
        cache_key = f"geo:{lat:.2f}:{lon:.2f}:{units}"

    # Check cache
    cached_payload = weather_cache.get(cache_key)
    if cached_payload is not None:
        response.headers["X-Cache"] = "HIT"
        return cached_payload

    # Upstream query parameters
    weather_params = {
        "appid": API_KEY,
        "units": units
    }
    forecast_params = {
        "appid": API_KEY,
        "units": units
    }

    if city:
        weather_params["q"] = city.strip()
        forecast_params["q"] = city.strip()
    else:
        weather_params["lat"] = lat
        weather_params["lon"] = lon
        forecast_params["lat"] = lat
        forecast_params["lon"] = lon

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            current_resp = await client.get(f"{BASE_URL}/weather", params=weather_params)

            if current_resp.status_code == 401:
                upstream_body = current_resp.json()
                detail_msg = upstream_body.get("message", "Invalid API key.")
                raise HTTPException(
                    status_code=401,
                    detail=f"OpenWeather authentication failed: {detail_msg}"
                )
            elif current_resp.status_code == 404:
                raise HTTPException(status_code=404, detail="City not found.")
            elif current_resp.status_code != 200:
                raise HTTPException(
                    status_code=current_resp.status_code,
                    detail="Failed to fetch weather data from upstream service."
                )

            current_data = current_resp.json()

            # Coordinates for pollution and forecast
            coord_info = current_data.get("coord", {})
            resolved_lat = coord_info.get("lat")
            resolved_lon = coord_info.get("lon")

            # 5-day / 3-hour forecast
            forecast_resp = await client.get(f"{BASE_URL}/forecast", params=forecast_params)
            forecast_data = {}
            if forecast_resp.status_code == 200:
                forecast_data = forecast_resp.json()

            # Air pollution data (requires coordinates)
            air_quality_data = {}
            if resolved_lat is not None and resolved_lon is not None:
                pollution_params = {
                    "lat": resolved_lat,
                    "lon": resolved_lon,
                    "appid": API_KEY
                }
                poll_resp = await client.get(f"{BASE_URL}/air_pollution", params=pollution_params)
                if poll_resp.status_code == 200:
                    air_quality_data = parse_air_quality(poll_resp.json())

            # Parse 24h hourly segments
            hourly_data = extract_hourly_forecast(forecast_data, count=8)

            result_payload = {
                "current": current_data,
                "forecast": forecast_data,
                "hourly": hourly_data,
                "air_quality": air_quality_data
            }

            # Cache the compiled payload
            weather_cache.set(cache_key, result_payload)
            response.headers["X-Cache"] = "MISS"

            return result_payload

        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Network error while connecting to weather service: {str(exc)}"
            )


if __name__ == "__main__":
    import uvicorn
    port_number = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="127.0.0.1", port=port_number, reload=True)