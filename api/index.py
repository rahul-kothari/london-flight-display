from fastapi import FastAPI
from fr24 import FR24, BoundingBox

app = FastAPI()

LONDON_BBOX = BoundingBox(north=51.80, south=51.20, west=-0.70, east=0.35)

async def flight_data() -> dict:
    async with FR24() as fr24:
        result = await fr24.live_feed.fetch(LONDON_BBOX)
        return result.to_dict()

@app.get("/api/flights")
async def get_data():
    return await flight_data()
