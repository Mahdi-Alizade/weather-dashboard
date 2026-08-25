import os
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

API_KEY = os.getenv("OPENWEATHER_API_KEY")
BASE_URL = "https://api.openweathermap.org/data/2.5"

app = FastAPI(title="Weather Dashboard API", version="1.0.0")

# Mount static files directory
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def serve_index():
    return FileResponse("static/index.html")


@app.get("/api/weather")
async def get_weather(
    city: Optional[str] = Query(None, description="City name"),
    lat: Optional[float] = Query(None, description="Latitude"),
    lon: Optional[float] = Query(None, description="Longitude"),
    units: str = Query("metric", description="Temperature unit (metric/imperial)")
):
    if not API_KEY or API_KEY == "your_openweather_api_key_here":
        raise HTTPException(
            status_code=500,
            detail="OpenWeather API key is not configured on the server."
        )

    if not city and (lat is None or lon is None):
        raise HTTPException(
            status_code=400,
            detail="Please provide either a city name or latitude/longitude coordinates."
        )

    # Base query parameters
    weather_params = {"appid": API_KEY, "units": units}
    forecast_params = {"appid": API_KEY, "units": units}

    if city:
        weather_params["q"] = city
        forecast_params["q"] = city
    else:
        weather_params["lat"] = lat
        weather_params["lon"] = lon
        forecast_params["lat"] = lat
        forecast_params["lon"] = lon

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            # Fetch current weather
            current_resp = await client.get(f"{BASE_URL}/weather", params=weather_params)
            
            if current_resp.status_code == 404:
                raise HTTPException(status_code=404, detail="City not found.")
            elif current_resp.status_code != 200:
                raise HTTPException(
                    status_code=current_resp.status_code,
                    detail="Failed to fetch weather data from upstream service."
                )

            current_data = current_resp.json()

            # Fetch 5-day / 3-hour forecast
            forecast_resp = await client.get(f"{BASE_URL}/forecast", params=forecast_params)
            forecast_data = forecast_resp.json() if forecast_resp.status_code == 200 else {}

            return {
                "current": current_data,
                "forecast": forecast_data
            }

        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Network error while connecting to weather service: {str(exc)}"
            )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)