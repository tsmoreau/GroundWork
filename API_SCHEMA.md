# Bird Wars API Schema

This document provides complete API documentation for the Bird Wars async battle server. Use this reference when building game client logic to communicate with the server.

## Base URL

```
https://your-deployment-url.replit.app/api
```

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <secret-token>
```

The `secret-token` is obtained during device registration and must be stored securely on the device. It cannot be retrieved after registration.

---

## Server Rules

These are automatic behaviors enforced by the server. Clients don't need to implement these rules—they happen automatically on the server side.

### Auto-Forfeit (Inactivity Timeout)

| Rule | Value |
|------|-------|
| **Timeout** | 7 days |
| **Trigger** | When `GET /api/mybattles` is called |
| **Condition** | Active battle where current turn holder hasn't moved in 7+ days |
| **Result** | Battle status → `completed`, endReason → `forfeit`, winner → waiting player |

**How it works:** When a player fetches their battles, the server checks all their active games. If the opponent (whose turn it is) hasn't submitted a turn in 7 days, they automatically forfeit. This ensures players waiting on inactive opponents eventually win.

**Important:** This check only runs when `GET /api/mybattles` is called—not on a background timer. If neither player checks their battles, no forfeit occurs.

---

### Active Game Limit

| Rule | Value |
|------|-------|
| **Max Active Games** | 9 per player |
| **Applies to** | `POST /api/battles` (create) and `PATCH /api/battles/[id]` (join) |
| **Counts** | Battles with status `pending` or `active` |
| **Error** | `403` with `error: "limit_reached"` |

**How it works:** Players cannot have more than 9 battles in pending or active status at once. Completed and abandoned battles don't count. To start a new game, players must finish or forfeit existing ones.

---

### Registration Rate Limit

| Rule | Value |
|------|-------|
| **Limit** | 10 new devices per minute (global) |
| **Applies to** | `POST /api/register` without token (new registrations only) |
| **Error** | `429` with `error: "Rate limit exceeded. Try again later."` |

**Note:** This is a global rate limit, not per-IP. It prevents abuse but doesn't affect existing device verification (calling with a token).

---

### Pagination Limits

| Endpoint | Default | Maximum |
|----------|---------|---------|
| `GET /api/battles` | 9 | 50 |
| `GET /api/mybattles` | 9 | 50 |
| `GET /api/ping` | 50 | 100 |
| `GET /api/turns` | 200 (fixed) | 200 |

---

### Battle Status Transitions

```
pending → active     (player 2 joins via PATCH /api/battles/[id] or POST /api/battles/[id]/join)
pending → abandoned  (creator cancels via DELETE /api/battles/[id] or POST /api/battles/[id]/cancel)
active  → completed  (winner declared via gameState.winner in turn submission)
active  → completed  (forfeit via 7-day timeout, checked on GET /api/mybattles)
```

**Status definitions:**
- `pending`: Waiting for player 2 to join
- `active`: Game in progress, both players present
- `completed`: Game ended with a result (victory, forfeit, or draw)
- `abandoned`: Creator cancelled before anyone joined

**Note:** Abandoned battles are excluded from list endpoints by default.

---

## Endpoints

### 1. Device Registration

#### POST /api/register

Register a new device, verify registration, or update profile.

**Authentication:** Optional (Bearer token)

**Request Body:**
```json
{
  "serialNumber": "PDU1-Y123456",  // optional, device serial number (kept for future use)
  "displayName": "My Playdate",   // optional, max 100 chars
  "avatar": "BIRD1",              // optional, BIRD1-BIRD12 (default: BIRD1)
  "isSimulator": false,           // optional, boolean (default: false)
  "deviceId": "abc123..."         // optional, for device recovery via stored deviceId
}
```

**Avatar Options:**
BIRD1, BIRD2, BIRD3, BIRD4, BIRD5, BIRD6, BIRD7, BIRD8, BIRD9, BIRD10, BIRD11, BIRD12

**Notes:**
- `serialNumber` is optional and kept for future use
- `isSimulator` should be set to `true` when registering from the Playdate Simulator
- `deviceId` can be passed to recover an existing account if the client has stored it

---

**Scenario 1: New Registration**

**Success Response (201):**
```json
{
  "success": true,
  "registered": false,
  "deviceId": "a1b2c3d4e5f6...",
  "secretToken": "abc123xyz...",
  "displayName": "My Playdate",
  "avatar": "BIRD1",
  "isSimulator": false,
  "minClientVersion": "0.0.1",
  "message": "Device registered successfully."
}
```

---

**Scenario 2: Account Recovery Pending (admin created recovery link)**

When an admin has created a recovery link for this device, the response includes recovery information:

**Success Response (200/201):**
```json
{
  "success": true,
  "registered": true,
  "deviceId": "new-device-id...",
  "displayName": "My Playdate",
  "avatar": "BIRD1",
  "isSimulator": false,
  "minClientVersion": "0.0.1",
  "message": "Account recovery is pending.",
  "recoveryPending": true,
  "targetDeviceId": "old-device-id-to-recover..."
}
```

**Important:** When `recoveryPending: true` is present, the client should:
1. Block normal gameplay
2. Show a recovery screen to the user
3. Call `POST /api/recover` with `newDeviceId` and `targetDeviceId`
4. Replace local deviceId with the `targetDeviceId` and clear cached battle data

---

**Scenario 3: Verify Existing Registration (with valid Authorization header)**

```
Authorization: Bearer <secret-token>
```

**Success Response (200):**
```json
{
  "success": true,
  "registered": true,
  "deviceId": "a1b2c3d4e5f6...",
  "displayName": "My Playdate",
  "avatar": "BIRD1",
  "isSimulator": false,
  "registeredAt": "2025-01-23T12:00:00.000Z",
  "message": "Device already registered."
}
```

---

**Scenario 4: Update Profile (with valid token + displayName/avatar in body)**

```
Authorization: Bearer <secret-token>
Content-Type: application/json

{ "serialNumber": "PDU1-Y123456", "displayName": "New Name", "avatar": "BIRD7", "isSimulator": true }
```

**Success Response (200):**
```json
{
  "success": true,
  "registered": true,
  "deviceId": "a1b2c3d4e5f6...",
  "displayName": "New Name",
  "avatar": "BIRD7",
  "isSimulator": true,
  "registeredAt": "2025-01-23T12:00:00.000Z",
  "message": "Device verified and profile updated."
}
```

---

**Error Responses:**
- `400` - Invalid request body
- `429` - Rate limit exceeded (max 10 registrations per minute, only applies to new registrations)
- `500` - Server error

**Client Flow:**
1. On first launch, call `POST /api/register` → store returned `deviceId` and `secretToken`
2. On subsequent launches, call `POST /api/register` with stored token in Authorization header → verify registration
3. Check for `recoveryPending: true` in response - if present, show recovery screen and call `/api/recover`
4. To change name, call with token + new `displayName` in body

**Account Recovery Flow (via admin):**
1. User loses device data but has QR code backup of their deviceId
2. User contacts admin with QR code
3. Admin creates recovery link in dashboard (old deviceId → new deviceId)
4. User's next login returns `recoveryPending: true` with `targetDeviceId`
5. Client shows recovery screen and calls `POST /api/recover`
6. Client replaces local deviceId with `targetDeviceId` and clears cached data

---

#### POST /api/recover

Complete an account recovery that was initiated by an admin.

**Authentication:** Required (Bearer token from the NEW device)

```
Authorization: Bearer <new-device-secret-token>
```

**Request Body:**
```json
{
  "targetDeviceId": "old-device-id-to-recover..."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Account recovery completed successfully",
  "deviceId": "old-device-id...",
  "secretToken": "new-token-for-recovered-account...",
  "displayName": "Recovered Player Name",
  "avatar": "BIRD1"
}
```

**Security:** 
- The Bearer token must belong to the new device that was linked by the admin
- On successful recovery, the new device is deactivated and a new token is issued for the recovered device

**Error Responses:**
- `400` - Missing required fields
- `401` - Authentication required (no/invalid token)
- `404` - No pending recovery found for this device combination
- `500` - Server error

**Client Implementation:**
After receiving a successful response, the client should:
1. Store the returned `deviceId` as the new local deviceId
2. Store the returned `secretToken` as the new authentication token
3. Clear any cached battle data from the abandoned new profile

---

#### GET /api/register

List all registered devices (for admin/dashboard use).

**Authentication:** None required

**Success Response (200):**
```json
{
  "success": true,
  "devices": [
    {
      "deviceId": "a1b2c3d4e5f6...",
      "displayName": "My Playdate",
      "registeredAt": "2025-01-23T12:00:00.000Z",
      "lastSeen": "2025-01-23T14:30:00.000Z"
    }
  ]
}
```

---

### 2. Battle Management

#### GET /api/battles

List all public battles (excludes private battles). Returns the 50 most recently updated battles.

**Authentication:** None required

**Success Response (200):**
```json
{
  "success": true,
  "battles": [
    {
      "battleId": "abc123def456",
      "displayName": "Molting-Siege-42",
      "player1DisplayName": "PlayerOne",
      "player1Avatar": "BIRD4",
      "player2DisplayName": "PlayerTwo" | null,
      "player2Avatar": "BIRD7" | null,
      "status": "pending" | "active" | "completed" | "abandoned",
      "currentTurn": 0,
      "currentPlayerIndex": 0,
      "isPrivate": false,
      "lastTurnAt": "2025-01-23T14:30:00.000Z" | null,
      "mapName": "Forest Arena",
      "winner": 0 | 1 | null
    }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| battleId | string | Unique battle identifier |
| displayName | string | Human-readable battle name |
| player1DisplayName | string | Player 1's display name (or "Unknown Player") |
| player1Avatar | string | Player 1's avatar (BIRD1-BIRD12) |
| player2DisplayName | string/null | Player 2's display name (null if not joined) |
| player2Avatar | string/null | Player 2's avatar (null if not joined) |
| status | string | Battle status |
| currentTurn | number | Current turn number |
| currentPlayerIndex | number | Whose turn it is (0 or 1) |
| isPrivate | boolean | Whether battle is private |
| lastTurnAt | string/null | ISO timestamp of last turn |
| mapName | string | Map name from mapData.selection (or "Unknown Map") |
| winner | number/null | Player index of winner (0 or 1) when status is "completed", null otherwise |

---

#### POST /api/battles

Create a new battle.

**Authentication:** Required

**Request Body:**
```json
{
  "mapData": {},        // optional, custom map configuration
  "isPrivate": false    // optional, if true the battle won't appear in public listings
}
```

**Success Response (201):**

For public battles:
```json
{
  "success": true,
  "battle": {
    "battleId": "abc123def456",
    "displayName": "Molting-Siege-42",
    "status": "pending",
    "currentTurn": 0,
    "isPrivate": false
  },
  "message": "Battle created. Waiting for opponent to join."
}
```

For private battles:
```json
{
  "success": true,
  "battle": {
    "battleId": "abc123def456",
    "displayName": "Molting-Siege-42",
    "status": "pending",
    "currentTurn": 0,
    "isPrivate": true
  },
  "message": "Private battle created. Share the battleId with your opponent to join."
}
```

**Error Responses:**
- `400` - Invalid request body
- `401` - Authentication required
- `500` - Server error

---

#### GET /api/battles/[id]

Get battle details and turn history.

**Authentication:** None required

**URL Parameters:**
- `id` - The battle ID

**Success Response (200):**
```json
{
  "success": true,
  "battle": {
    "_id": "697e381a3290814be556f817",
    "battleId": "abc123def456",
    "displayName": "Molting-Siege-42",
    "player1DeviceId": "device1...",
    "player1DisplayName": "PlayerOne",
    "player1Avatar": "BIRD4",
    "player2DeviceId": "device2...",
    "player2DisplayName": "PlayerTwo",
    "player2Avatar": "BIRD7",
    "status": "active",
    "currentTurn": 5,
    "currentPlayerIndex": 1,
    "winnerId": null,
    "endReason": null,
    "lastTurnAt": "2025-01-23T14:30:00.000Z",
    "createdAt": "2025-01-23T12:00:00.000Z",
    "updatedAt": "2025-01-23T14:30:00.000Z",
    "isPrivate": false,
    "mapData": {
      "selection": "Bathroom Blitz",
      "unitPlacement": [...],
      "itemPlacement": [...]
    },
    "currentState": {
      "units": [
        { "unitId": "device1_u0", "type": "BIRD1", "x": 2, "y": 3, "hp": 10, "owner": "device1..." }
      ],
      "blockedTiles": [
        { "x": 5, "y": 5, "itemType": "garbageCan" }
      ]
    }
  },
  "turns": [
    {
      "turnId": "turn123...",
      "battleId": "abc123def456",
      "deviceId": "device1...",
      "turnNumber": 1,
      "actions": [...],
      "timestamp": "2025-01-23T12:05:00.000Z",
      "isValid": true,
      "validationErrors": [],
      "gameState": {}
    }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| _id | string | MongoDB document ID |
| battleId | string | Unique battle identifier |
| displayName | string | Human-readable battle name |
| player1DeviceId | string | Player 1's device ID |
| player1DisplayName | string | Player 1's display name (resolved from Device) |
| player1Avatar | string | Player 1's avatar (BIRD1-BIRD12) |
| player2DeviceId | string/null | Player 2's device ID (null if pending) |
| player2DisplayName | string/null | Player 2's display name |
| player2Avatar | string/null | Player 2's avatar |
| status | string | Battle status: `pending`, `active`, `completed`, `abandoned` |
| currentTurn | number | Current turn number |
| currentPlayerIndex | number | Whose turn it is (0 = player1, 1 = player2) |
| winnerId | string/null | Device ID of winner (null if not completed) |
| endReason | string/null | How game ended: `victory`, `forfeit`, `draw`, `cancelled` |
| lastTurnAt | string/null | ISO timestamp of last turn |
| createdAt | string | ISO timestamp when battle was created |
| updatedAt | string | ISO timestamp of last update |
| isPrivate | boolean | Whether battle is private |
| mapData | object | Map configuration (see below) |
| mapData.selection | string | **Map name** (e.g., "Bathroom Blitz", "Forest Arena") |
| currentState | object | Current game state with units and blocked tiles |
| turns | array | All turns sorted by turnNumber |

**Error Responses:**
- `404` - Battle not found
- `500` - Server error

---

#### PATCH /api/battles/[id]

Join a pending battle as player 2.

**Authentication:** Required

**URL Parameters:**
- `id` - The battle ID to join

**Success Response (200):**
```json
{
  "success": true,
  "battle": {
    "battleId": "abc123def456",
    "status": "active",
    "currentTurn": 0,
    "player1DeviceId": "device1...",
    "player2DeviceId": "device2...",
    "currentState": {
      "units": [
        { "unitId": "device1_u0", "type": "BIRD1", "x": 2, "y": 3, "hp": 10, "owner": "device1..." },
        { "unitId": "device2_u0", "type": "BIRD4", "x": 10, "y": 3, "hp": 10, "owner": "device2..." }
      ],
      "blockedTiles": [
        { "x": 5, "y": 5, "itemType": "garbageCan" }
      ]
    }
  },
  "message": "Joined battle successfully. Battle is now active."
}
```

**Note:** When a battle becomes active (player 2 joins), the server initializes `currentState` from the battle's `mapData`:
- `units` array is seeded from `mapData.unitPlacement`
- `blockedTiles` array is seeded from `mapData.itemPlacement` (items with `canMoveOn: false`)

**Error Responses:**
- `400` - Battle is not in pending state
- `400` - Cannot join your own battle
- `401` - Authentication required
- `404` - Battle not found
- `500` - Server error

---

#### POST /api/battles/[id]/join

Join a pending battle as player 2. This is an alternative to `PATCH /api/battles/[id]` for devices that don't support PATCH requests.

**Authentication:** Required

**URL Parameters:**
- `id` - The battle ID to join

**Success Response (200):**
```json
{
  "success": true,
  "battle": {
    "battleId": "abc123def456",
    "status": "active",
    "currentTurn": 0,
    "player1DeviceId": "device1...",
    "player2DeviceId": "device2...",
    "currentState": {
      "units": [
        { "unitId": "device1_u0", "type": "BIRD1", "x": 2, "y": 3, "hp": 10, "owner": "device1..." },
        { "unitId": "device2_u0", "type": "BIRD4", "x": 10, "y": 3, "hp": 10, "owner": "device2..." }
      ],
      "blockedTiles": [
        { "x": 5, "y": 5, "itemType": "garbageCan" }
      ]
    }
  },
  "message": "Joined battle successfully. Battle is now active."
}
```

**Note:** When a battle becomes active (player 2 joins), the server initializes `currentState` from the battle's `mapData`:
- `units` array is seeded from `mapData.unitPlacement`
- `blockedTiles` array is seeded from `mapData.itemPlacement` (items with `canMoveOn: false`)

**Error Responses:**
- `400` - Battle is not in pending state
- `400` - Cannot join your own battle
- `401` - Authentication required
- `404` - Battle not found
- `500` - Server error

---

#### GET /api/battles/[id]/poll

Poll for new turns in a battle. Returns basic battle metadata (status, current turn info) and any turns submitted after the specified turn number. Useful for lightweight polling to check if the opponent has moved without fetching the full battle state.

**Authentication:** None required

**URL Parameters:**
- `id` - The battle ID to poll

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| since | number | (Optional) Return only turns after this turn number. Defaults to 0 (returns all turns). |

**Success Response (200):**
```json
{
  "success": true,
  "battleId": "abc123def456",
  "currentTurn": 5,
  "currentPlayerIndex": 1,
  "status": "active",
  "turns": [
    {
      "turnNumber": 3,
      "deviceId": "device1...",
      "actions": [
        { "type": "move", "unitId": "device1_u0", "toX": 5, "toY": 4 },
        { "type": "attack", "unitId": "device1_u0", "targetId": "device2_u1" }
      ]
    },
    {
      "turnNumber": 4,
      "deviceId": "device2...",
      "actions": [
        { "type": "move", "unitId": "device2_u0", "toX": 6, "toY": 3 }
      ]
    }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| battleId | string | The battle identifier |
| currentTurn | number | Current turn number |
| currentPlayerIndex | number | Whose turn it is (0 or 1) |
| status | string | Battle status: `pending`, `active`, `completed`, `abandoned` |
| winnerId | string/null | (Optional) The device ID of the winner, only present if status is `completed` |
| turns | array | Turns submitted after the `since` parameter |
| turns[].turnNumber | number | The turn number |
| turns[].deviceId | string | Device that submitted the turn |
| turns[].actions | array | Actions taken during the turn |

**Example Usage:**
```
GET /api/battles/abc123def456/poll?since=2
```
Returns all turns after turn 2 (i.e., turns 3, 4, 5, etc.).

**Error Responses:**
- `404` - Battle not found
- `500` - Server error

---

#### GET /api/mybattles

Get all battles where the authenticated device is a participant (includes private battles). Returns up to 100 battles.

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: `pending`, `active`, `completed`, `abandoned` |

**Auto-Forfeit Behavior:**
When this endpoint is called, the server checks all active battles. If the opponent (current turn holder) hasn't submitted a turn in **7 days**, they automatically forfeit:
- Battle status → `completed`
- Winner → the waiting player
- endReason → `forfeit`

**Success Response (200):**
```json
{
  "success": true,
  "battles": [
    {
      "battleId": "abc123...",
      "displayName": "Molting-Siege-42",
      "player1DisplayName": "PlayerOne",
      "player1Avatar": "BIRD4",
      "player2DisplayName": "PlayerTwo",
      "player2Avatar": "BIRD7",
      "status": "active",
      "currentTurn": 5,
      "currentPlayerIndex": 1,
      "myPlayerIndex": 0,
      "isMyTurn": false,
      "isPrivate": false,
      "lastTurnAt": "2025-01-20T10:30:00.000Z",
      "mapName": "Forest Arena"
    }
  ],
  "count": 5
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| battleId | string | Unique battle identifier |
| displayName | string | Human-readable battle name |
| player1DisplayName | string | Player 1's display name (or "Unknown Player") |
| player1Avatar | string | Player 1's avatar (BIRD1-BIRD12) |
| player2DisplayName | string/null | Player 2's display name (null if not joined) |
| player2Avatar | string/null | Player 2's avatar (null if not joined) |
| status | string | Battle status |
| currentTurn | number | Current turn number |
| currentPlayerIndex | number | Whose turn it is (0 or 1) |
| myPlayerIndex | number | Your player index (0 = player1, 1 = player2) |
| isMyTurn | boolean | Whether it's your turn |
| isPrivate | boolean | Whether battle is private |
| lastTurnAt | string/null | ISO timestamp of last turn |
| mapName | string | Map name from mapData.selection (or "Unknown Map") |
| count | number | Total number of battles returned |

---

#### GET /api/myActiveTurns

Get a lightweight list of battles where it's the authenticated device's turn. Useful for quick polling to check if action is needed.

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "count": 2,
  "battles": ["abc123def456", "xyz789ghi012"]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Always true on success |
| count | number | Number of battles awaiting your turn |
| battles | string[] | Array of battleIds where it's your turn |

**Error Responses:**
- `401` - Authentication required
- `500` - Server error

---

### 3. Turn Submission

#### POST /api/turns

Submit a turn for a battle. Player 1 can submit turns while the battle is still `pending` (before player 2 joins). Once player 2 joins and the battle becomes `active`, normal turn-based play continues.

**Authentication:** Required

**Status Requirements:**
- `pending`: Only player 1 (currentPlayerIndex === 0) can submit turns
- `active`: The current player (based on currentPlayerIndex) can submit turns

**Request Body:**
```json
{
  "battleId": "abc123def456",
  "actions": [
    {
      "type": "move",
      "unitId": "unit1",
      "from": { "x": 1, "y": 2 },
      "to": { "x": 3, "y": 2 }
    },
    {
      "type": "attack",
      "unitId": "unit1",
      "targetId": "enemy1"
    },
    {
      "type": "end_turn"
    }
  ],
  "gameState": {
    "units": [...],
    "winner": null  // set to deviceId to end the game
  }
}
```

**Action Types:**

All action fields except `type` are optional. The server validates the schema but does not enforce game logic. Client should implement its own validation for game rules.

| Type | Description | Common Fields |
|------|-------------|---------------|
| `move` | Move a unit | `unitId`, `from`, `to` |
| `attack` | Attack a target | `unitId`, `targetId` |
| `build` | Build something | `unitId`, `to`, `data` |
| `capture` | Capture a target | `unitId`, `targetId` |
| `wait` | Unit waits | `unitId` |
| `take_off` | Transition unit from ground to air | `unitId` |
| `land` | Transition unit from air to ground | `unitId` |
| `supply` | Replenish food for adjacent units | `unitId` |
| `load` | Load unit into transport | `unitId`, `targetId` |
| `unload` | Unload unit from transport | `unitId`, `to` |
| `combine` | Merge two units of the same type | `unitId`, `targetId` |
| `end_turn` | End the turn | none |

**Note:** Only `type` is required by the server. All other fields are optional and should be validated client-side based on your game logic.

**Position Schema:**
```json
{
  "x": -1000 to 1000,  // integer
  "y": -1000 to 1000   // integer
}
```

**Validation Rules:**
- Must include `end_turn` action

**Success Response (201):**
```json
{
  "success": true,
  "turn": {
    "turnId": "turn123...",
    "turnNumber": 6,
    "isValid": true,
    "validationErrors": []
  },
  "battle": {
    "battleId": "abc123def456",
    "currentTurn": 6,
    "currentPlayerIndex": 0,
    "status": "active",
    "currentState": {
      "units": [
        { "unitId": "device1_u0", "type": "BIRD1", "x": 3, "y": 2, "hp": 10, "owner": "device1..." },
        { "unitId": "device2_u0", "type": "BIRD4", "x": 10, "y": 3, "hp": 7, "owner": "device2..." }
      ],
      "blockedTiles": [
        { "x": 5, "y": 5, "itemType": "garbageCan" }
      ]
    }
  },
  "message": "Turn submitted successfully"
}
```

**Note:** The `currentState` is updated based on the client's submitted `gameState.units`. Dead units (HP <= 0) are automatically filtered out.

**Error Responses:**
- `400` - Invalid request body / Battle not active
- `401` - Authentication required
- `403` - Not your turn / Not a participant
- `404` - Battle not found
- `409` - Turn already submitted (replay attack prevention)
- `413` - Request payload too large
- `500` - Server error

---

#### GET /api/turns

Get all turns for a battle.

**Authentication:** None required

**Query Parameters:**
- `battleId` (required) - The battle ID

**Example:**
```
GET /api/turns?battleId=abc123def456
```

**Success Response (200):**
```json
{
  "success": true,
  "turns": [
    {
      "turnId": "turn123...",
      "battleId": "abc123def456",
      "deviceId": "device1...",
      "turnNumber": 1,
      "actions": [...],
      "timestamp": "2025-01-23T12:05:00.000Z",
      "isValid": true,
      "validationErrors": [],
      "gameState": {}
    }
  ]
}
```

**Error Responses:**
- `400` - Battle ID is required (missing `battleId` query param)
- `500` - Server error

---

### Player Statistics

#### GET /api/stats

Get player statistics for the authenticated device.

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "stats": {
    "deviceId": "a0dcb007...",
    "displayName": "My Playdate",
    "avatar": "BIRD4",
    "memberSince": "2025-01-15T10:30:00.000Z",
    "totalBattles": 15,
    "completedBattles": 12,
    "activeBattles": 2,
    "pendingBattles": 1,
    "wins": 8,
    "losses": 3,
    "draws": 1,
    "winRate": "66.7%",
    "totalTurnsSubmitted": 142
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| deviceId | string | Device identifier |
| displayName | string | Device display name |
| avatar | string | Bird avatar (BIRD1-BIRD12) |
| memberSince | string | ISO date when device registered |
| totalBattles | number | Total battles participated in |
| completedBattles | number | Battles that have ended |
| activeBattles | number | Currently active battles |
| pendingBattles | number | Battles waiting for opponent |
| wins | number | Total victories |
| losses | number | Total defeats |
| draws | number | Battles with no winner |
| winRate | string | Win percentage (e.g., "66.7%") |
| totalTurnsSubmitted | number | Total turns across all battles |

**Error Responses:**
- `401` - Authentication required
- `500` - Server error

---

### Device Ping

#### POST /api/ping

Record a ping from a device. Useful for connectivity testing and activity tracking.

**Authentication:** Required

**Request Body:**
```json
{
  "message": "Hello from Playdate!"  // optional, max 500 chars
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Ping received",
  "pingId": "6975e77b60630a547b8b8f9d",
  "displayName": "My Playdate",
  "timestamp": "2026-01-25T09:50:51.867Z"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Always true on success |
| message | string | Confirmation message |
| pingId | string | Unique identifier for this ping |
| displayName | string | Device's display name |
| timestamp | string | ISO timestamp when ping was recorded |

**Error Responses:**
- `400` - Invalid request body
- `401` - Authentication required
- `500` - Server error

---

#### GET /api/ping

List recorded pings.

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| limit | number | Max pings to return (default: 50, max: 100) |
| deviceId | string | Filter by specific device ID |

**Example:**
```
GET /api/ping?limit=10
GET /api/ping?deviceId=abc123...
```

**Success Response (200):**
```json
{
  "success": true,
  "pings": [
    {
      "id": "6975e77b60630a547b8b8f9d",
      "deviceId": "0c32ad1f...",
      "displayName": "My Playdate",
      "ipAddress": "127.0.0.1",
      "message": "Hello from Playdate!",
      "createdAt": "2026-01-25T09:50:51.867Z"
    }
  ]
}
```

**Ping Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ping identifier |
| deviceId | string | Device that sent the ping |
| displayName | string | Device's display name at time of ping |
| ipAddress | string | Device's IP address (if available) |
| message | string/null | Optional message sent with ping |
| createdAt | string | ISO timestamp of ping |

**Error Responses:**
- `401` - Authentication required
- `500` - Server error

---

## Data Models

### Device
```typescript
{
  deviceId: string;        // Unique device identifier
  displayName: string;     // Human-readable name
  avatar: string;          // Bird avatar (BIRD1-BIRD12)
  isSimulator: boolean;    // true if registered from Playdate Simulator
  registeredAt: Date;      // Registration timestamp
  lastSeen: Date;          // Last activity timestamp
  isActive: boolean;       // Whether device is active
}
```

### Battle
```typescript
{
  battleId: string;              // Unique battle identifier (16 chars)
  displayName: string;           // Deterministic friendly name (e.g., "Molting-Siege-42")
  player1DeviceId: string;       // Creator's device ID
  player2DeviceId: string | null; // Opponent's device ID (null if pending)
  status: 'pending' | 'active' | 'completed' | 'abandoned';
  currentTurn: number;           // Current turn number (0-indexed)
  currentPlayerIndex: number;    // 0 = player1's turn, 1 = player2's turn
  createdAt: Date;
  updatedAt: Date;
  winnerId: string | null;       // Winner's device ID
  endReason: 'victory' | 'forfeit' | 'draw' | null;  // How battle ended
  lastTurnAt: Date | null;       // Timestamp of last turn submission
  mapData: object;               // Custom map configuration
  isPrivate: boolean;            // If true, hidden from public listings
}
```

### Turn
```typescript
{
  turnId: string;           // Unique turn identifier
  battleId: string;         // Associated battle
  deviceId: string;         // Device that submitted the turn
  turnNumber: number;       // Sequential turn number (1-indexed)
  actions: Action[];        // Array of actions taken
  timestamp: Date;          // Submission timestamp
  isValid: boolean;         // Whether turn passed validation
  validationErrors: string[]; // List of validation errors
  gameState: object;        // Snapshot of game state after turn
}
```

### Action
```typescript
{
  type: 'move' | 'attack' | 'build' | 'capture' | 'wait' | 'end_turn' | 'take_off' | 'land' | 'supply';
  unitId?: string;          // Unit performing the action
  from?: { x: number, y: number };  // Starting position
  to?: { x: number, y: number };    // Target position
  targetId?: string;        // Target unit/building ID
  data?: object;            // Additional action-specific data
}
```

### Ping
```typescript
{
  id: string;              // Unique ping identifier
  deviceId: string;        // Device that sent the ping
  displayName: string;     // Device's display name at time of ping
  ipAddress?: string;      // Device's IP address (if available)
  userAgent?: string;      // Request user agent (if available)
  message?: string;        // Optional message sent with ping
  createdAt: Date;         // When ping was recorded
}
```

---

## Common Patterns

### Game Flow

1. **Device Registration**
   ```
   POST /api/register → Store secretToken
   ```

2. **Create Battle**
   ```
   POST /api/battles (with auth) → Get battleId
   Share battleId with opponent
   ```

3. **Join Battle**
   ```
   POST /api/battles/{battleId}/join (with auth) → Battle becomes "active"
   ```
   Alternative (for devices supporting PATCH):
   ```
   PATCH /api/battles/{battleId} (with auth) → Battle becomes "active"
   ```

4. **Game Loop**
   ```
   GET /api/battles/{battleId} → Check currentPlayerIndex
   If my turn:
     POST /api/turns → Submit actions
   Poll for opponent's turn
   ```

5. **End Game**
   ```
   POST /api/turns with gameState.winner set → Battle becomes "completed"
   ```

### Polling Strategy

For Playdate's limited connectivity, recommend:
- Poll every 30-60 seconds when waiting for opponent
- Use exponential backoff on errors
- Cache battle state locally

### Error Handling

All error responses follow this format:
```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": [...]  // Optional validation details
}
```

---

## Rate Limits

- Device registration: 10 per minute (global)
- Other endpoints: No specific limits, but be respectful

## Security Notes

- Tokens are hashed with HMAC-SHA256 before storage
- Always use HTTPS in production
- Never log or expose secret tokens
- Validate all user input on both client and server
