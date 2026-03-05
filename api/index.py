import math
import time
from fastapi import FastAPI, Query
from fr24 import FR24, BoundingBox

app = FastAPI()

LONDON_BBOX = BoundingBox(north=51.80, south=51.20, west=-0.70, east=0.35)
CACHE_TTL_SECONDS = 10
MAX_DISTANCE_KM = 5

_cache: dict = {"data": None, "timestamp": 0}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


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
async def get_data(
    lat: float = Query(..., description="Home latitude"),
    lon: float = Query(..., description="Home longitude"),
):
    data = await flight_data()
    nearby = []
    for f in data.get("flights_list", []):
        flat = f.get("lat")
        flon = f.get("lon")
        if flat is None or flon is None:
            continue
        if haversine_km(lat, lon, flat, flon) > MAX_DISTANCE_KM:
            continue
        ei = f.get("extra_info") or {}
        nearby.append({
            "callsign": f.get("callsign"),
            "lat": flat,
            "lon": flon,
            "speed": f.get("speed"),
            "extra_info": {
                "flight": ei.get("flight"),
                "type": ei.get("type"),
                "route": ei.get("route"),
            },
        })
    return {"flights_list": nearby}
