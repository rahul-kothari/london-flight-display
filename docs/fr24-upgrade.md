# Plan: Upgrade fr24 0.1.2 → 0.2.4

## Background

`api/index.py` uses `fr24==0.1.2`, pinned at June 2024. Latest is `0.2.4` (December 2025).
The package is undocumented/reverse-engineered — it could break at any time regardless of version.
Versions 0.2.3 and 0.2.4 mention "Flightradar24 client compatibility updates", which is the main
motivation to upgrade.

---

## What Changed (Breaking)

### v0.1.3 — Module restructure
- `fr24.livefeed` namespace removed — functions moved to `fr24.grpc` and `fr24.json`
- All `livefeed_*` functions renamed to `live_feed_*`

### v0.2.0 — Full API redesign
- Low-level functions replaced by a service/cache pattern (`fr24.service`, `fr24.cache`)
- Responses are now `LiveFeedResult` wrapper objects with `.to_dict()` / `.to_polars()` methods — `google.protobuf.json_format.MessageToDict` is no longer needed
- `BoundingBox` is now a required typed dataclass, replacing bare `north=`, `south=`, `east=`, `west=` kwargs
- The service manages its own HTTP client — `httpx.AsyncClient` is no longer passed in manually

### v0.2.3 / v0.2.4 — No breaking changes
- TUI improvements and FR24 client compatibility fixes only

---

## Current Code (`api/index.py`)

```python
from fr24.livefeed import (
    livefeed_message_create,
    livefeed_post,
    livefeed_request_create,
    livefeed_response_parse,
)
from fr24.proto.request_pb2 import LiveFeedResponse
from google.protobuf.json_format import MessageToDict

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
```

---

## What Needs to Change

| Area | Old (0.1.2) | New (0.2.x) |
|---|---|---|
| Import path | `fr24.livefeed` | `fr24.grpc` or `fr24.service` |
| Function names | `livefeed_message_create` etc. | `live_feed_*` or service API |
| Bounding box | `north=51.80, west=-0.70, ...` | `BoundingBox(north=51.80, ...)` typed dataclass |
| HTTP client | caller creates `httpx.AsyncClient` | service manages internally |
| Response parsing | `MessageToDict(response)` | `result.to_dict()` |
| Return type | `LiveFeedResponse` (protobuf) | `LiveFeedResult` wrapper |

---

## Implementation Steps

- [ ] **1.** Read the 0.2.4 source / docs to confirm exact new import paths and service API shape (`https://abc8747.github.io/fr24/usage/quickstart/`)
- [ ] **2.** Update `requirements.txt`: `fr24==0.1.2` → `fr24==0.2.4`
- [ ] **3.** Rewrite `api/index.py`:
  - Replace all `fr24.livefeed` imports with new paths
  - Replace `livefeed_*` calls with `live_feed_*` / service API
  - Replace bare bbox kwargs with `BoundingBox` dataclass
  - Drop `httpx.AsyncClient` manual management
  - Replace `MessageToDict(data)` with `result.to_dict()`
- [ ] **4.** Verify the response shape returned to the frontend hasn't changed — `FlightList.tsx` depends on `data.flightsList[*].lat`, `.lon`, `.speed`, `.extraInfo.flight`, `.extraInfo.type`, `.extraInfo.route.from/to`
- [ ] **5.** Test locally with `npm run dev` and confirm flights appear in the UI
- [ ] **6.** If response shape changed, update `FlightList.tsx` field access accordingly

---

## Response Shape Change (Confirmed)

The new `to_dict()` uses **snake_case** field names instead of the **camelCase** that `MessageToDict` produced:

| Old (MessageToDict) | New (to_dict()) |
|---|---|
| `flightsList` | `flights_list` |
| `extraInfo` | `extra_info` |

Fields *within* each flight are unchanged: `lat`, `lon`, `speed`, `callsign`, `extra_info.flight`, `extra_info.type`, `extra_info.route.from`, `extra_info.route.to`.

The frontend (`FlightList.tsx`) must update: `data.flightsList` → `data.flights_list`, and all `extraInfo` → `extra_info`.

---

## Risk

**Low.** The rewrite is small (one 16-line file) and the response shape has been confirmed by testing against the live API. The only field name changes are the top-level casing convention.
