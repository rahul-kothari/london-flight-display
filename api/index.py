import httpx
from fastapi import FastAPI
from fr24.livefeed import (
    livefeed_message_create,
    livefeed_post,
    livefeed_request_create,
    livefeed_response_parse,
)
from fr24.proto.request_pb2 import LiveFeedResponse
from google.protobuf.json_format import MessageToDict

app = FastAPI()

async def flight_data() -> LiveFeedResponse:
    async with httpx.AsyncClient() as client:
        message = livefeed_message_create(north=51.80, west=-0.70, south=51.20, east=0.35)
        request = livefeed_request_create(message)
        data = await livefeed_post(client, request)
        return livefeed_response_parse(data)

@app.get("/api/flights")
async def get_data():
    data = await flight_data()
    data_dict = MessageToDict(data)
    return data_dict
