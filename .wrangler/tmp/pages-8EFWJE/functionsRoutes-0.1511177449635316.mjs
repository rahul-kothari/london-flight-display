import { onRequest as __api_flights_ts_onRequest } from "/Users/rahulkothari/Desktop/london-flight-display/.worktrees/cloudflare/functions/api/flights.ts"

export const routes = [
    {
      routePath: "/api/flights",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_flights_ts_onRequest],
    },
  ]