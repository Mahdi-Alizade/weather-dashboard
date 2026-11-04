import pytest
import httpx
from httpx import AsyncClient, ASGITransport
import main
from main import app, weather_cache


@pytest.fixture(autouse=True)
def setup_test_environment(monkeypatch):
    """Ensure in-memory cache is empty and mock API key is present."""
    weather_cache._storage.clear()
    monkeypatch.setattr(main, "API_KEY", "test_mock_api_key_1234567890")
    yield
    weather_cache._storage.clear()


@pytest.mark.asyncio
async def test_health_and_index_route():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_missing_query_parameters_returns_400():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/weather")
        assert response.status_code == 400
        body = response.json()
        assert "detail" in body


@pytest.mark.asyncio
async def test_cache_hit_and_miss_headers(monkeypatch):
    async def mock_client_get(self, url, *args, **kwargs):
        url_str = str(url)

        if "/weather" in url_str:
            mock_data = {
                "name": "Tehran",
                "coord": {"lat": 35.68, "lon": 51.42},
                "sys": {"country": "IR"},
                "weather": [{"main": "Clear", "description": "clear sky", "icon": "01d"}],
                "main": {"temp": 22.0, "feels_like": 21.5, "humidity": 30, "pressure": 1015},
                "wind": {"speed": 3.2}
            }
            return httpx.Response(status_code=200, json=mock_data)

        elif "/forecast" in url_str:
            mock_data = {
                "list": [
                    {
                        "dt": 1700000000,
                        "dt_txt": "2026-11-04 12:00:00",
                        "main": {"temp": 20.0, "feels_like": 19.5, "humidity": 35},
                        "weather": [{"main": "Clear", "icon": "01d"}],
                        "pop": 0.1
                    }
                ]
            }
            return httpx.Response(status_code=200, json=mock_data)

        elif "/air_pollution" in url_str:
            mock_data = {
                "list": [
                    {
                        "main": {"aqi": 2},
                        "components": {"pm2_5": 14.2, "pm10": 25.0, "no2": 18.5, "o3": 30.1}
                    }
                ]
            }
            return httpx.Response(status_code=200, json=mock_data)

        return httpx.Response(status_code=404, json={"message": "Not found"})

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_client_get)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First call: cache MISS
        first_resp = await client.get("/api/weather?city=Tehran")
        assert first_resp.status_code == 200, f"Expected 200 but got {first_resp.status_code}: {first_resp.text}"
        assert first_resp.headers.get("x-cache") == "MISS" or first_resp.headers.get("X-Cache") == "MISS"

        first_data = first_resp.json()
        assert first_data["current"]["name"] == "Tehran"
        assert first_data["air_quality"]["status"] == "Fair"

        # Second call: cache HIT
        second_resp = await client.get("/api/weather?city=Tehran")
        assert second_resp.status_code == 200
        assert second_resp.headers.get("x-cache") == "HIT" or second_resp.headers.get("X-Cache") == "HIT"