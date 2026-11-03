import os
from typing import Optional
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

app = FastAPI(title="Weather Dashboard API", version="1.1.0")

# Initialize in-memory cache with 10 minutes (600 seconds) TTL
weather_cache = SimpleMemoryCache(default_ttl_seconds=600)

# Ensure static folder exists and mount it
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


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

    # Build unique cache key based on query parameters
    if city:
        normalized_city = city.strip().lower()
        cache_key = f"city:{normalized_city}:{units}"
    else:
        cache_key = f"geo:{lat:.2f}:{lon:.2f}:{units}"

    # Check in-memory cache first
    cached_payload = weather_cache.get(cache_key)
    if cached_payload is not None:
        response.headers["X-Cache"] = "HIT"
        return cached_payload

    # Prepare upstream API query parameters
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

    # Fetch data asynchronously from OpenWeatherMap
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

            # Fetch 5-day / 3-hour forecast
            forecast_resp = await client.get(f"{BASE_URL}/forecast", params=forecast_params)
            forecast_data = {}
            if forecast_resp.status_code == 200:
                forecast_data = forecast_resp.json()

            result_payload = {
                "current": current_data,
                "forecast": forecast_data
            }

            # Store result in cache
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