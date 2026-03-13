import math
import logging
from fastapi import FastAPI, Query
from fr24 import FR24, BoundingBox

logger = logging.getLogger(__name__)
app = FastAPI()

LONDON_BBOX = BoundingBox(north=51.80, south=51.20, west=-0.70, east=0.35)
MAX_DISTANCE_KM = 5
# Reject coordinates more than this far from central London before hitting FR24.
# Prevents the endpoint being used as a free FR24 proxy for arbitrary locations.
LONDON_LAT = 51.5
LONDON_LON = -0.1
MAX_HOME_OFFSET_KM = 50


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@app.get("/api/flights")
async def get_data(
    lat: float = Query(..., ge=-90, le=90, description="Home latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Home longitude"),
):
    # Guard: reject coordinates outside the London area to prevent proxy abuse.
    if haversine_km(lat, lon, LONDON_LAT, LONDON_LON) > MAX_HOME_OFFSET_KM:
        return {"flights_list": []}

    try:
        async with FR24() as fr24:
            result = await fr24.live_feed.fetch(LONDON_BBOX)
            data = result.to_dict()
    except Exception as exc:
        logger.error("FR24 fetch failed: %s", exc)
        return {"flights_list": []}

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
