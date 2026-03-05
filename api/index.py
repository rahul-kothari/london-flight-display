import time
from fastapi import FastAPI
from fr24 import FR24, BoundingBox

app = FastAPI()

LONDON_BBOX = BoundingBox(north=51.80, south=51.20, west=-0.70, east=0.35)
CACHE_TTL_SECONDS = 10

_cache: dict = {"data": None, "timestamp": 0}

async def flight_data() -> dict:
    now = time.monotonic()
    if _cache["data"] is not None and (now - _cache["timestamp"]) < CACHE_TTL_SECONDS:
        return _cache["data"]
    async with FR24() as fr24:
        result = await fr24.live_feed.fetch(LONDON_BBOX)
        data = result.to_dict()
    _cache["data"] = data
    _cache["timestamp"] = now
    return data

@app.get("/api/flights")
async def get_data():
    return await flight_data()
