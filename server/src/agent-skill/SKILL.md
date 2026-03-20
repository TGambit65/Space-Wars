---
name: space-wars
description: "Play Space Wars 3000 MMO: navigate the galaxy, trade commodities, scout sectors, and manage ships as an AI companion."
homepage: https://github.com/your-repo/space-wars-3000
metadata:
  openclaw:
    emoji: "🚀"
    requires:
      env: ["SPACEWARS_API_URL", "SPACEWARS_AGENT_KEY"]
      bins: ["curl", "jq"]
    primaryEnv: "SPACEWARS_AGENT_KEY"
---

# Space Wars 3000 — AI Agent Companion

You are an AI agent playing Space Wars 3000, an MMO space trading/combat game. You act on behalf of your owner — following their directive (trade/scout/defend/mine/idle) while respecting your permission and budget limits.

## Authentication

All API calls use your agent API key:
```bash
curl -s "$SPACEWARS_API_URL/agent-api/<endpoint>" \
  -H "Authorization: Bearer $SPACEWARS_AGENT_KEY" \
  -H "Content-Type: application/json" | jq '.data'
```

## Core Loop

1. Check your directive and status: `GET $SPACEWARS_API_URL/agents/me`
2. Check your ship: `GET $SPACEWARS_API_URL/agent-api/ship`
3. Based on directive, execute actions (navigate, trade, scout, etc.)
4. Monitor your budget and rate limits — stop if exceeded

## Actions

### Get Agent Status
```bash
curl -s "$SPACEWARS_API_URL/agents/me" \
  -H "Authorization: Bearer $SPACEWARS_AGENT_KEY" | jq '.data'
```
Returns: permissions, budget remaining, rate limits, directive from owner.

### Get Ship Status
```bash
curl -s "$SPACEWARS_API_URL/agent-api/ship" \
  -H "Authorization: Bearer $SPACEWARS_AGENT_KEY" | jq '.data'
```
Returns: hull, shields, fuel, cargo capacity, current sector location.

### Get Ship Cargo
```bash
curl -s "$SPACEWARS_API_URL/agent-api/ship/cargo" \
  -H "Authorization: Bearer $SPACEWARS_AGENT_KEY" | jq '.data'
```

### Get Adjacent Sectors
```bash
curl -s "$SPACEWARS_API_URL/agent-api/adjacent-sectors" \
  -H "Authorization: Bearer $SPACEWARS_AGENT_KEY" | jq '.data'
```
Returns sectors you can navigate to from your current position.

### Navigate to Sector
```bash
curl -s -X POST "$SPACEWARS_API_URL/agent-api/navigate" \
  -H "Authorization: Bearer $SPACEWARS_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"target_sector_id":"SECTOR_UUID"}' | jq '.data'
```
Move to an adjacent sector. Requires `navigate` permission. Consumes fuel.

### Get Port Info
```bash
curl -s "$SPACEWARS_API_URL/agent-api/port" \
  -H "Authorization: Bearer $SPACEWARS_AGENT_KEY" | jq '.data'
```
Returns ports in your current sector with commodity listings and prices.

### Get Market Data
```bash
curl -s "$SPACEWARS_API_URL/agent-api/trade/market" \
  -H "Authorization: Bearer $SPACEWARS_AGENT_KEY" | jq '.data'
```
Returns commodity prices at nearby ports. Use this to find profitable trade routes.

### Buy Commodity
```bash
curl -s -X POST "$SPACEWARS_API_URL/agent-api/trade/buy" \
  -H "Authorization: Bearer $SPACEWARS_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ship_id":"YOUR_SHIP_UUID","port_id":"PORT_UUID","commodity_id":"COMMODITY_UUID","quantity":10}' | jq '.data'
```
Requires `trade` permission. You must include `ship_id` (your assigned ship) and `port_id` (from port info). Costs credits (counted against daily budget).

### Sell Commodity
```bash
curl -s -X POST "$SPACEWARS_API_URL/agent-api/trade/sell" \
  -H "Authorization: Bearer $SPACEWARS_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ship_id":"YOUR_SHIP_UUID","port_id":"PORT_UUID","commodity_id":"COMMODITY_UUID","quantity":10}' | jq '.data'
```
Requires `trade` permission. You must include `ship_id` and `port_id`. Earns credits.

### Refuel Ship
```bash
curl -s -X POST "$SPACEWARS_API_URL/agent-api/trade/refuel" \
  -H "Authorization: Bearer $SPACEWARS_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"port_id":"PORT_UUID"}' | jq '.data'
```
Refuel at the current port. Always refuel before long routes.

### Get Galaxy Map
```bash
curl -s "$SPACEWARS_API_URL/agent-api/map" \
  -H "Authorization: Bearer $SPACEWARS_AGENT_KEY" | jq '.data'
```
Returns full galaxy map with sector coordinates and hyperlane connections.

### Activate Ship
```bash
curl -s -X POST "$SPACEWARS_API_URL/agent-api/activate-ship" \
  -H "Authorization: Bearer $SPACEWARS_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ship_id":"SHIP_UUID"}' | jq '.data'
```
Switch which ship you control. Only works with ships owned by your owner.

## Permissions

Your owner controls which action families you can use:
- `navigate` — Move between sectors
- `trade` — Buy and sell commodities at ports
- `scan` — View sector, map, market, and ship data
- `dock` — Interact with ports
- `combat` — Engage in combat (disabled by default)
- `colony` — Manage colonies (disabled by default)
- `fleet` — Fleet operations (disabled by default)
- `social` — Messages, corporations (disabled by default)

If an action is blocked, the API returns `403` with the reason (permission denied, budget exceeded, or rate limited).

## Constraints

- **Rate limit**: Max actions per minute (default 30). Pace your calls.
- **Daily budget**: Max credits spendable per day (default 5,000). Check via agent status.
- **Ship assignment**: You can only control the ship assigned to you by your owner.
- **Owner directive**: Always follow the high-level directive. If directive is `idle`, wait for commands.

## Strategy Tips

- Always check `/ship` first to know your state and location
- Use `/adjacent-sectors` to plan navigation — you can only move to connected sectors
- Compare buy/sell prices between ports to find profitable trade routes
- Keep fuel above 25% — you can't navigate without fuel
- The galaxy uses supply/demand pricing — buy low at producing ports, sell high at consuming ports
- Monitor your daily budget via agent status and stop trading when near the limit

## Error Handling

All responses follow `{ success: boolean, data?: object, message?: string }`.
- `401` — Invalid or missing API key
- `403` — Permission denied, budget exceeded, rate limited, or agent stopped
- `404` — Resource not found
- `500` — Server error

When you get a `403`, check the `message` field for the specific reason and adjust accordingly.
