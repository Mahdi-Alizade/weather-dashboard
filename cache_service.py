import time
from typing import Any, Optional, Dict


class SimpleMemoryCache:
    """
    A simple in-memory key-value cache with time-to-live (TTL) expiration.
    Keeps API calls low and prevents hitting OpenWeather rate limits.
    """
    def __init__(self, default_ttl_seconds: int = 600):
        self.default_ttl = default_ttl_seconds
        self._storage: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        cache_key = key.strip().lower()
        
        if cache_key not in self._storage:
            return None

        record = self._storage[cache_key]
        expire_at = record.get("expire_at", 0)
        current_time = time.time()

        # Check if cache entry is expired
        if current_time > expire_at:
            # Delete stale item
            del self._storage[cache_key]
            return None

        data_value = record.get("data")
        return data_value

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        cache_key = key.strip().lower()
        
        duration = self.default_ttl
        if ttl_seconds is not None:
            duration = ttl_seconds

        expire_time = time.time() + duration

        record = {
            "data": value,
            "expire_at": expire_time
        }

        self._storage[cache_key] = record

    def clear(self) -> None:
        self._storage.clear()