-- source/battle/battle/battleConfig.lua

-- MODIFIED: Added isTransport and canBeCarried flags to BIRD_CONFIG entries.

print("battleConfig.lua: MODULE EXECUTION STARTED")

-- Keep GRID_SETUP as a local variable within this module's scope
local GRID_SETUP = {
    maxGridSizeX = nil,
    maxGridSizeZ = nil,
    unitPlacement = {},
    itemPlacement = {},
    nestPlacement = {}, --For nest placements
    worldItemPlacement = {}, 
    defaultDitherPatternKey = nil,
    tileDitherPatternOverrides = {},
    gameplayTerrain = {},
    maxTiles = 500, -- Default, can be overridden
    loadedMapMetadata = nil, -- To store metadata from the loaded map
}

local DAMAGE_CHART = {
    BIRD1 = {           -- Pigeon (Infantry) - Cost: 10, Flight: 1.0x
        BIRD1 = 55,     -- VS Pigeon (unchanged - good baseline)
        BIRD2 = 35,     -- VS Bluejay (unchanged - decent vs recon)
        BIRD3 = 45,     -- VS Raven (unchanged - decent vs mech)
        BIRD4 = 10,     -- VS Duck (unchanged - weak vs tank)
        BIRD5 = 15,     -- VS Seagull (unchanged - good vs artillery)
        BIRD6 = 5,     -- VS Goose (unchanged - very weak vs heavy tank)
        BIRD7 = 15,     -- VS Toucan (unchanged - good vs rockets)
        BIRD8 = 15,     -- VS Pelican (weak vs
        BIRD9 = 15,     -- VS Hummingbird (unchanged - poor vs air)
        BIRD10 = 10,    -- VS Owl (weak vs stealth)
        BIRD11 = 10,    -- VS Eagle (very weak vs jet)
        BIRD12 = 10     -- VS Penguin (very weak vs anti-air)
    },
    BIRD2 = {           -- Bluejay (Recon) - Cost: 40, Flight: 1.2x
        BIRD1 = 70,     -- VS Pigeon (unchanged - strong vs infantry)
        BIRD2 = 55,     -- VS Bluejay (unchanged)
        BIRD3 = 40,     -- VS Raven (unchanged)
        BIRD4 = 20,     -- VS Duck (unchanged - weak vs tank)
        BIRD5 = 40,     -- VS Seagull (unchanged - good vs artillery)
        BIRD6 = 15,     -- VS Goose (unchanged - weak vs heavy tank)
        BIRD7 = 30,     -- VS Toucan (unchanged - good vs rockets)
        BIRD8 = 15,     -- VS Pelican (reduced from 85 - still very good vs APC)
        BIRD9 = 15,     -- VS Hummingbird (unchanged - poor vs air)
        BIRD10 = 10,    -- VS Owl (weak vs stealth)
        BIRD11 = 10,    -- VS Eagle (very weak vs jet)
        BIRD12 = 20     -- VS Penguin (good vs anti-air)
    },
    BIRD3 = {           -- Raven (Mech) - Cost: 30, Flight: 1.5x
        BIRD1 = 65,     -- VS Pigeon (unchanged)
        BIRD2 = 60,     -- VS Bluejay (unchanged)
        BIRD3 = 55,     -- VS Raven (unchanged)
        BIRD4 = 65,     -- VS Duck (unchanged - decent vs tank)
        BIRD5 = 75,     -- VS Seagull (unchanged - good vs artillery)
        BIRD6 = 55,     -- VS Goose (unchanged - weak vs heavy tank)
        BIRD7 = 80,     -- VS Toucan (unchanged - very good vs rockets)
        BIRD8 = 85,     -- VS Pelican (reduced from 90 - excellent but not overwhelming)
        BIRD9 = 45,     -- VS Hummingbird (unchanged - poor vs air)
        BIRD10 = 50,    -- VS Owl (decent vs stealth)
        BIRD11 = 35,    -- VS Eagle (weak vs jet)
        BIRD12 = 80     -- VS Penguin (very good vs anti-air)
    },
    BIRD4 = {           -- Duck (Light Tank) - Cost: 80, Flight: 2.0x
        BIRD1 = 75,     -- VS Pigeon (reduced from 85 - matches AW2 Tank vs Infantry)
        BIRD2 = 75,     -- VS Bluejay (unchanged - good vs recon)
        BIRD3 = 70,     -- VS Raven (reduced from 75 - matches AW2 balance)
        BIRD4 = 45,     -- VS Duck (unchanged)
        BIRD5 = 75,     -- VS Seagull (reduced from 85 - strong but not overwhelming)
        BIRD6 = 35,     -- VS Goose (unchanged - weak vs heavy tank)
        BIRD7 = 80,     -- VS Toucan (reduced from 90 - strong vs rockets)
        BIRD8 = 85,     -- VS Pelican (reduced from 95 - excellent but not devastating)
        BIRD9 = 60,     -- VS Hummingbird (unchanged - decent vs air)
        BIRD10 = 55,    -- VS Owl (decent vs stealth)
        BIRD11 = 40,    -- VS Eagle (weak vs jet)
        BIRD12 = 85     -- VS Penguin (excellent vs anti-air)
    },
    BIRD5 = {           -- Seagull (Artillery) - Cost: 60, Flight: 2.5x
        BIRD1 = 85,     -- VS Pigeon (reduced from 90 - accounts for flight mobility)
        BIRD2 = 75,     -- VS Bluejay (reduced from 80 - still very good)
        BIRD3 = 80,     -- VS Raven (reduced from 75 - good vs mech)
        BIRD4 = 65,     -- VS Duck (reduced from 70 - decent vs tank)
        BIRD5 = 60,     -- VS Seagull (reduced from 65 - artillery duels)
        BIRD6 = 55,     -- VS Goose (reduced from 60 - struggles vs heavy armor)
        BIRD7 = 70,     -- VS Toucan (reduced from 75 - indirect vs indirect)
        BIRD8 = 85,     -- VS Pelican (reduced from 95 - excellent but not one-shot)
        BIRD9 = 25,     -- VS Hummingbird (unchanged - can't elevate well)
        BIRD10 = 40,    -- VS Owl (decent vs stealth)
        BIRD11 = 20,    -- VS Eagle (very weak vs jet)
        BIRD12 = 70     -- VS Penguin (good vs anti-air)
    },
    BIRD6 = {           -- Goose (Heavy Tank) - Cost: 160, Flight: 3.5x
        BIRD1 = 85,     -- VS Pigeon (reduced from 95 - strong but not overwhelming)
        BIRD2 = 80,     -- VS Bluejay (reduced from 85 - very good vs recon)
        BIRD3 = 75,     -- VS Raven (reduced from 80 - good vs mech)
        BIRD4 = 60,     -- VS Duck (reduced from 65 - decent vs light tank)
        BIRD5 = 85,     -- VS Seagull (reduced from 95 - excellent vs artillery)
        BIRD6 = 55,     -- VS Goose (unchanged)
        BIRD7 = 85,     -- VS Toucan (reduced from 95 - excellent vs rockets)
        BIRD8 = 90,     -- VS Pelican (reduced from 99 - devastating but not instant)
        BIRD9 = 70,     -- VS Hummingbird (unchanged - good vs air)
        BIRD10 = 65,    -- VS Owl (decent vs stealth)
        BIRD11 = 45,    -- VS Eagle (weak vs jet)
        BIRD12 = 90     -- VS Penguin (devastating vs anti-air)
    },
    BIRD7 = {           -- Toucan (Rockets) - Cost: 150, Flight: 3.0x
        BIRD1 = 85,     -- VS Pigeon (reduced from 95 - excellent vs infantry)
        BIRD2 = 80,     -- VS Bluejay (reduced from 85 - very good vs recon)
        BIRD3 = 75,     -- VS Raven (reduced from 80 - good vs mech)
        BIRD4 = 75,     -- VS Duck (reduced from 80 - good vs light tank)
        BIRD5 = 80,     -- VS Seagull (reduced from 85 - very good vs artillery)
        BIRD6 = 70,     -- VS Goose (reduced from 75 - decent vs heavy tank)
        BIRD7 = 65,     -- VS Toucan (reduced from 70 - rocket duels)
        BIRD8 = 85,     -- VS Pelican (reduced from 95 - excellent but not devastating)
        BIRD9 = 20,     -- VS Hummingbird (unchanged - can't elevate well)
        BIRD10 = 70,    -- VS Owl (good vs stealth)
        BIRD11 = 15,    -- VS Eagle (very weak vs jet)
        BIRD12 = 80     -- VS Penguin (very good vs anti-air)
    },
    BIRD8 = {           -- Pelican (APC) - Cost: 50, Flight: 1.8x
        BIRD1 = 0,      -- VS Pigeon (unchanged - no attack)
        BIRD2 = 0,      -- VS Bluejay (unchanged - no attack)
        BIRD3 = 0,      -- VS Raven (unchanged - no attack)
        BIRD4 = 0,      -- VS Duck (unchanged - no attack)
        BIRD5 = 0,      -- VS Seagull (unchanged - no attack)
        BIRD6 = 0,      -- VS Goose (unchanged - no attack)
        BIRD7 = 0,      -- VS Toucan (unchanged - no attack)
        BIRD8 = 0,      -- VS Pelican (unchanged - no attack)
        BIRD9 = 0,      -- VS Hummingbird (unchanged - no attack)
        BIRD10 = 0,     -- VS Owl (no attack)
        BIRD11 = 0,     -- VS Eagle (no attack)
        BIRD12 = 0      -- VS Penguin (no attack)
    },
    BIRD9 = {           -- Hummingbird (B-Copter) - Cost: 90, Flight: 0.5x (always flying)
        BIRD1 = 65,     -- VS Pigeon (unchanged - good vs infantry)
        BIRD2 = 65,     -- VS Bluejay (unchanged - good vs recon)
        BIRD3 = 60,     -- VS Raven (unchanged - decent vs mech)
        BIRD4 = 55,     -- VS Duck (unchanged - poor vs tank armor)
        BIRD5 = 65,     -- VS Seagull (unchanged - very good vs artillery)
        BIRD6 = 25,     -- VS Goose (unchanged - very poor vs heavy tank)
        BIRD7 = 75,     -- VS Toucan (unchanged - very good vs rockets)
        BIRD8 = 75,     -- VS Pelican (reduced from 90 - excellent but not overwhelming)
        BIRD9 = 55,     -- VS Hummingbird (unchanged - air-to-air combat)
        BIRD10 = 50,    -- VS Owl (decent vs stealth)
        BIRD11 = 35,    -- VS Eagle (weak vs jet)
        BIRD12 = 20     -- VS Penguin (very weak vs anti-air)
    },
    BIRD10 = {          -- Owl (Stealth) - Cost: 180, Flight: ?, 1.25x vs flying
        BIRD1 = 85,     -- VS Pigeon (excellent vs infantry)
        BIRD2 = 80,     -- VS Bluejay (very good vs recon)
        BIRD3 = 75,     -- VS Raven (good vs mech)
        BIRD4 = 70,     -- VS Duck (good vs light tank)
        BIRD5 = 80,     -- VS Seagull (very good vs artillery)
        BIRD6 = 65,     -- VS Goose (decent vs heavy tank)
        BIRD7 = 75,     -- VS Toucan (good vs rockets)
        BIRD8 = 85,     -- VS Pelican (excellent vs APC)
        BIRD9 = 60,     -- VS Hummingbird (poor vs air, always flying so gets 1.25x = 75)
        BIRD10 = 55,    -- VS Owl (stealth vs stealth)
        BIRD11 = 45,    -- VS Eagle (weak vs jet)
        BIRD12 = 90     -- VS Penguin (excellent vs grounded anti-air)
    },
    BIRD11 = {          -- Eagle (Jet) - Cost: 200, Flight: ?, 1.5x vs flying
        BIRD1 = 85,     -- VS Pigeon (very good vs infantry)
        BIRD2 = 70,     -- VS Bluejay (good vs recon)  
        BIRD3 = 75,     -- VS Raven (good vs mech)
        BIRD4 = 65,     -- VS Duck (decent vs light tank)
        BIRD5 = 75,     -- VS Seagull (good vs artillery)
        BIRD6 = 55,     -- VS Goose (decent vs heavy tank)
        BIRD7 = 70,     -- VS Toucan (good vs rockets)
        BIRD8 = 80,     -- VS Pelican (very good vs APC)
        BIRD9 = 85,     -- VS Hummingbird (excellent vs air, always flying so gets 1.5x = 127, capped at 99)
        BIRD10 = 65,    -- VS Owl (good vs stealth)
        BIRD11 = 55,    -- VS Eagle (jet vs jet)
        BIRD12 = 55     -- VS Penguin (excellent vs grounded anti-air)
    },
    BIRD12 = {          -- Penguin (Anti-Air) - Cost: ?, Flight: 0x (cannot fly), 2x vs flying
        BIRD1 = 105,    -- VS Pigeon (strong vs infantry, matches AW)
        BIRD2 = 60,     -- VS Bluejay (strong vs recon, matches AW)
        BIRD3 = 105,    -- VS Raven (strong vs mech, matches AW)
        BIRD4 = 25,     -- VS Duck (very weak vs tank on ground)
        BIRD5 = 45,     -- VS Seagull (decent vs artillery on ground)
        BIRD6 = 15,     -- VS Goose (very weak vs heavy tank)
        BIRD7 = 50,     -- VS Toucan (decent vs rockets on ground)
        BIRD8 = 65,     -- VS Pelican (good vs APC)
        BIRD9 = 120,    -- VS Hummingbird (excellent vs air, always flying so gets 2x = 240, capped at 99)
        BIRD10 = 50,    -- VS Owl (base damage, +25% if flying)
        BIRD11 = 55,    -- VS Eagle (base damage, +50% if flying)
        BIRD12 = 45     -- VS Penguin (anti-air vs anti-air)
    }
}

local BIRD_CONFIG = {
    BIRD1 = {
        name = "Pigeon", imagePath = "images/birb001", iconPath = "images/icon001", moveSpaces = 4, health = 10, food = 99, attackRange = 1,
        damageChart = DAMAGE_CHART.BIRD1, terrainDefense = 1, nestBuildRate = 4, captureRate = 4, attackType = "Peck", buildCost = 10, canCounterattack = true, flightCostMultiplier = 1.0,
        movementType = 'fly', isFlying = false,
        canBeCarried = true, isTransport = false,
        imageOffset30 = {x = 0, y = -8}, imageOffsetFar30 = {x = 0, y = -10},
        imageOffset60 = {x = 0, y = -2}, imageOffsetFar60 = {x = 0, y = -4},
        imageOffset90 = {x = 0, y = 4},  imageOffsetFar90 = {x = 0, y = 4},
        healthDisplayOffset = {x = 5, y = -4}, image = nil, icon = nil, imageHighlighted = nil
    },
    BIRD2 = {
        name = "Bluejay", imagePath = "images/birb002", iconPath = "images/icon002", moveSpaces = 7, health = 10, food = 99, attackRange = 1,
        damageChart = DAMAGE_CHART.BIRD2, terrainDefense = 1, nestBuildRate = 4, captureRate = 2, attackType = "Peck", buildCost = 40, canCounterattack = true, flightCostMultiplier = 1.2,
        movementType = 'fly', isFlying = false,
        canBeCarried = true, isTransport = false,
        imageOffset30 = {x = 0, y = -8}, imageOffsetFar30 = {x = 0, y = -10},
        imageOffset60 = {x = 0, y = 0},  imageOffsetFar60 = {x = 0, y = -3},
        imageOffset90 = {x = 0, y = 4},  imageOffsetFar90 = {x = 0, y = 4},
        healthDisplayOffset = {x = 5, y = -4}, image = nil, icon = nil, imageHighlighted = nil
    },
    BIRD3 = {
        name = "Raven", imagePath = "images/birb003", iconPath = "images/icon003", moveSpaces = 4, health = 10, food = 99, attackRange = 1,
        damageChart = DAMAGE_CHART.BIRD3, terrainDefense = 1, nestBuildRate = 1, captureRate = 4, attackType = {"Peck", "Claw"}, buildCost = 40, canCounterattack = true, flightCostMultiplier = 1.5,
        movementType = 'fly', isFlying = false,  damageBonuses = { vsFlying = 1.25 },
        canBeCarried = true, isTransport = false,
        imageOffset30 = {x = 0, y = -8}, imageOffsetFar30 = {x = 0, y = -10},
        imageOffset60 = {x = 0, y = -2}, imageOffsetFar60 = {x = 0, y = -4},
        imageOffset90 = {x = 0, y = 4},  imageOffsetFar90 = {x = 0, y = 4},
        healthDisplayOffset = {x = 5, y = -4}, image = nil, icon = nil, imageHighlighted = nil
    },
    BIRD4 = {
        name = "Duck", imagePath = "images/birb004", iconPath = "images/icon004", moveSpaces = 5, health = 10, food = 99, attackRange = 1,
        damageChart = DAMAGE_CHART.BIRD4, terrainDefense = 1, nestBuildRate = 1, captureRate = 0, attackType = {"Peck", "Charge"}, buildCost = 80, canCounterattack = true, flightCostMultiplier = 2.0,
        movementType = 'fly', isFlying = false, damageBonuses = { vsFlying = 1.15 },
        canBeCarried = true, isTransport = false,
        imageOffset30 = {x = 0, y = -8}, imageOffsetFar30 = {x = 0, y = -12},
        imageOffset60 = {x = 0, y = -2}, imageOffsetFar60 = {x = 0, y = -4},
        imageOffset90 = {x = 0, y = 4},  imageOffsetFar90 = {x = 0, y = 4},
        healthDisplayOffset = {x = 5, y = -4}, image = nil, icon = nil, imageHighlighted = nil
    },
    BIRD5 = {
        name = "Seagull", imagePath = "images/birb005", iconPath = "images/icon005", moveSpaces = 4, health = 10, food = 99, attackRange = {2, 3},
        damageChart = DAMAGE_CHART.BIRD5, terrainDefense = 1, nestBuildRate = 1, captureRate = 0, attackType = "Trash Toss", buildCost = 60, canCounterattack = false, flightCostMultiplier = 2.5,
        movementType = 'fly', isFlying = false,
        canBeCarried = true, isTransport = false,
        imageOffset30 = {x = 0, y = -8}, imageOffsetFar30 = {x = 0, y = -12},
        imageOffset60 = {x = 0, y = -2}, imageOffsetFar60 = {x = 0, y = -4},
        imageOffset90 = {x = 0, y = 4},  imageOffsetFar90 = {x = 0, y = 4},
        healthDisplayOffset = {x = 5, y = -4}, image = nil, icon = nil, imageHighlighted = nil
    },
     BIRD6 = {
        name = "Goose", imagePath = "images/birb006", iconPath = "images/icon006", moveSpaces = 4, health = 10, food = 99, attackRange = 1,
        damageChart = DAMAGE_CHART.BIRD6, terrainDefense = 1, nestBuildRate = 1, captureRate = 0, attackType = {"Peck", "Charge"}, buildCost = 160, canCounterattack = true, flightCostMultiplier = 3.5,
        movementType = 'fly', isFlying = false, damageBonuses = { vsFlying = 1.1 },
        canBeCarried = true, isTransport = false,
        imageOffset30 = {x = 0, y = -8}, imageOffsetFar30 = {x = 0, y = -14},
        imageOffset60 = {x = 0, y = -2}, imageOffsetFar60 = {x = 0, y = -4},
        imageOffset90 = {x = 0, y = 2},  imageOffsetFar90 = {x = 0, y = 2},
        healthDisplayOffset = {x = 5, y = -4}, image = nil, icon = nil, imageHighlighted = nil
    },
     BIRD7 = {
        name = "Toucan", imagePath = "images/birb007", iconPath = "images/icon007", moveSpaces = 4, health = 10, food = 99, attackRange = {3, 4,5},
        damageChart = DAMAGE_CHART.BIRD7, terrainDefense = 1, nestBuildRate = 1, captureRate = 0, attackType = "Seed Bomb", buildCost = 150, canCounterattack = false, flightCostMultiplier = 3.0,
        movementType = 'fly', isFlying = false,
        canBeCarried = true, isTransport = false,
        imageOffset30 = {x = 0, y = -8}, imageOffsetFar30 = {x = 0, y = -12},
        imageOffset60 = {x = 0, y = -2}, imageOffsetFar60 = {x = 0, y = -4},
        imageOffset90 = {x = 0, y = 4},  imageOffsetFar90 = {x = 0, y = 4},
        healthDisplayOffset = {x = 5, y = -4}, image = nil, icon = nil, imageHighlighted = nil
    },
     BIRD8 = {
        name = "Pelican", imagePath = "images/birb008", iconPath = "images/icon008", moveSpaces = 4, health = 10, food = 99, attackRange = 0,
        damageChart = DAMAGE_CHART.BIRD8, terrainDefense = 1, nestBuildRate = 1, captureRate = 0, attackType = "N/A", buildCost = 50, canCounterattack = false, flightCostMultiplier = 1.8,
        movementType = 'fly', isFlying = false,
        isTransport = true, canBeCarried = false,
        canSupply = true,
        imageOffset30 = {x = 0, y = -8}, imageOffsetFar30 = {x = 0, y = -9},
        imageOffset60 = {x = 0, y = -2}, imageOffsetFar60 = {x = 0, y = -2},
        imageOffset90 = {x = 0, y = 4},  imageOffsetFar90 = {x = 0, y = 4},
        healthDisplayOffset = {x = 5, y = -4}, image = nil, icon = nil, imageHighlighted = nil
    },
     BIRD9 = {
        name = "Hummingbird", imagePath = "images/birb009", iconPath = "images/icon009", moveSpaces = 7, health = 10, food = 99, attackRange = 1,
        damageChart = DAMAGE_CHART.BIRD9, terrainDefense = 1, nestBuildRate = 1, captureRate = 0, attackType = "Peck, Assualt", buildCost = 90, canCounterattack = false, flightCostMultiplier = 0.5,
        movementType = 'fly', isFlying = true, canLand = false,  damageBonuses = { vsFlying = 1.15 },
        canBeCarried = true, isTransport = false,
        imageOffset30 = {x = 0, y = -8}, imageOffsetFar30 = {x = 0, y = -12},
        imageOffset60 = {x = 0, y = -2}, imageOffsetFar60 = {x = 0, y = -4},
        imageOffset90 = {x = 0, y = 4},  imageOffsetFar90 = {x = 0, y = 4},
        healthDisplayOffset = {x = 5, y = -4}, image = nil, icon = nil, imageHighlighted = nil
    },
     BIRD10 = {
        name = "Owl", imagePath = "images/birb010", iconPath = "images/icon010", moveSpaces = 5, health = 10, food = 99, attackRange = 1,
        damageChart = DAMAGE_CHART.BIRD10, terrainDefense = 1, nestBuildRate = 1, captureRate = 0, attackType = "Peck, Assualt", buildCost = 180, canCounterattack = true, flightCostMultiplier = 2.0,
        movementType = 'fly', isFlying = false, damageBonuses = { vsFlying = 1.35 },
        canBeCarried = true, isTransport = false,
        imageOffset30 = {x = 0, y = -8}, imageOffsetFar30 = {x = 0, y = -12},
        imageOffset60 = {x = 0, y = -2}, imageOffsetFar60 = {x = 0, y = -4},
        imageOffset90 = {x = 0, y = 4},  imageOffsetFar90 = {x = 0, y = 4},
        healthDisplayOffset = {x = 5, y = -4}, image = nil, icon = nil, imageHighlighted = nil
    },
     BIRD11 = {
        name = "Eagle", imagePath = "images/birb011", iconPath = "images/icon011", moveSpaces = 7, health = 10, food = 99, attackRange = 1,
        damageChart = DAMAGE_CHART.BIRD11, terrainDefense = 1, nestBuildRate = 1, captureRate = 0, attackType = "Peck, Assualt", buildCost = 200, canCounterattack = true, flightCostMultiplier = 2.5,
        movementType = 'fly', isFlying = false, damageBonuses = { vsFlying = 1.5 },
        canBeCarried = true, isTransport = false,
        imageOffset30 = {x = 0, y = -8}, imageOffsetFar30 = {x = 0, y = -12},
        imageOffset60 = {x = 0, y = -2}, imageOffsetFar60 = {x = 0, y = -4},
        imageOffset90 = {x = 0, y = 0},  imageOffsetFar90 = {x = 0, y = 0},
        healthDisplayOffset = {x = 5, y = 0}, image = nil, icon = nil, imageHighlighted = nil
    },
    BIRD12 = {
        name = "Penguin", imagePath = "images/birb012", iconPath = "images/icon012", moveSpaces = 6, health = 10, food = 99, attackRange = 1,
        damageChart = DAMAGE_CHART.BIRD12, terrainDefense = 1, nestBuildRate = 1, captureRate = 0, attackType = "Peck", buildCost = 70, canCounterattack = true,
        movementType = 'ground', isFlying = false, damageBonuses = { vsFlying = 2.0 },
        canBeCarried = true, isTransport = false,
        imageOffset30 = {x = 0, y = -8}, imageOffsetFar30 = {x = 0, y = -12},
        imageOffset60 = {x = 0, y = -2}, imageOffsetFar60 = {x = 0, y = -4},
        imageOffset90 = {x = 0, y = 0},  imageOffsetFar90 = {x = 0, y = 0},
        healthDisplayOffset = {x = 5, y = 0}, image = nil, icon = nil, imageHighlighted = nil
    }
}

local SPAWNABLE_UNITS_ORDER = {
    "BIRD1", "BIRD2", "BIRD3", "BIRD4", "BIRD6", "BIRD8", "BIRD5", "BIRD7", "BIRD9", "BIRD10", "BIRD11", "BIRD12"
}

local TERRAIN_DEFENSE = {
    sand = 10, grass = 20, concrete = 0, asphalt = 0, water = 0, dirt = 10, dirt2 = 10,
    mediumDither = 0, grass2 = 20,
}

local MOVEMENT_COSTS = {
    plain = 1, grass = 2, grass2 = 2, sand = 2, concrete = 1, asphalt = 1, dirt = 1, dirt2 = 1, water = 3, 
    mediumDither = 1
}

local FOOD_CONFIG = {
    fries = { 
        name = "Fries", imagePath = "images/fries", iconPath = "images/friesIcon", defenseBonus = 10, power = 150, image = nil, icon = nil,
        offset = {x = 1, y = 7},
        imageOffset30 = {x = 0, y = 2}, imageOffsetFar30 = {x = 0, y = 0},
        imageOffset60 = {x = 0, y = 6}, imageOffsetFar60 = {x = 0, y = 6},
        imageOffset90 = {x = 0, y = 10},imageOffsetFar90 = {x = 0, y = 10}
    },
    burger = { 
        name = "Burger", imagePath = "images/burger", iconPath = "images/burgerIcon", defenseBonus = 10, power = 300, image = nil, icon = nil,
        offset = {x = 0, y = 4},
        imageOffset30 = {x = 0, y = 0}, imageOffsetFar30 = {x = 0, y = -2},
        imageOffset60 = {x = 0, y = 3}, imageOffsetFar60 = {x = 0, y = 3},
        imageOffset90 = {x = 0, y = 6}, imageOffsetFar90 = {x = 0, y = 6}
    }
}

local ITEM_CONFIG = {
    garbageCan = { 
        name = "Trash Can",
        imagePath30 = "images/can001", imagePath60 = "images/can002", imagePath90 = "images/can003", 
        iconPath = "", 
        itemSize = {width = 2, height = 2}, 
        canMoveOn = false, 
        defenseBonus = 0,
        imageOffset30 = {x = 0, y = -35}, imageOffsetFar30 = {x = 0, y = -45}, -- Far Y is more negative (up) or less negative (down)
        imageOffset60 = {x = 0, y = -15}, imageOffsetFar60 = {x = 0, y = -25},
        imageOffset90 = {x = 0, y = -10},  imageOffsetFar90 = {x = 0, y = -10},  -- Far Y might be more positive (down)
        foodSpawnRange = {},
        foodSpawnRate = {},
        foodSpawnTypes = {},
        foodSpawnIsRandom = true,
        foodSpawnLocations = {}
    },
    parkBench = { 
        name = "Bench",
        imagePath30 = "images/bench001", imagePath60 = "images/bench001", imagePath90 = "images/bench001", 
        iconPath = "",
        itemSize = {width = 4, height = 2}, 
        canMoveOn = false, 
        defenseBonus = 0,
        imageOffset30 = {x = -3, y = -40}, imageOffsetFar30 = {x = 0, y = -45},
        imageOffset60 = {x = 0, y = -40}, imageOffsetFar60 = {x = 0, y = -60},
        imageOffset90 = {x = 0, y = 0}, imageOffsetFar90 = {x = 0, y = 1}
    }
}

local NEST_CONFIG = {
    nest = { 
        name = "Nest", imagePath = "images/nest", iconPath = "images/nestIcon", defenseBonus = 30, power = 80, image = nil, icon = nil,
        offset = {x = 1, y = 7},
        imageOffset30 = {x = 0, y = -2}, imageOffsetFar30 = {x = 0, y = -8},
        imageOffset60 = {x = 0, y = 2},  imageOffsetFar60 = {x = 0, y = -2},
        imageOffset90 = {x = 0, y = 4},  imageOffsetFar90 = {x = 0, y = 4} 
    },
    sticks = { 
        name = "Sticks", imagePath = "images/sticks", iconPath = "images/sticksIcon", defenseBonus = 20, power = 80, image = nil, icon = nil,
        offset = {x = 1, y = 7},
        imageOffset30 = {x = 0, y = -2}, imageOffsetFar30 = {x = 0, y = -8},
        imageOffset60 = {x = 0, y = 2},  imageOffsetFar60 = {x = 0, y = -2},
        imageOffset90 = {x = 0, y = 4},  imageOffsetFar90 = {x = 0, y = 4} 
    },
    megaNest = { 
        name = "Big Nest", imagePath = "images/megaNest", iconPath = "", defenseBonus = 20, power = 80, image = nil, icon = nil,
        offset = {x = 1, y = 7},
        imageOffset30 = {x = 0, y = -6}, imageOffsetFar30 = {x = 0, y = -10},
        imageOffset60 = {x = 0, y = -3}, imageOffsetFar60 = {x = 0, y = -3},
        imageOffset90 = {x = 0, y = 0},  imageOffsetFar90 = {x = 0, y = 0} 
    }
}

local function calculateDamage(attacker, defender, terrainDefenseValue)
    local baseDamage = attacker.config.damageChart[defender.unitType] or 0
    terrainDefenseValue = terrainDefenseValue or 0
    local attackerHpMultiplier = attacker.health / 10
    local actualTerrainDefenseBenefit = terrainDefenseValue * defender.config.terrainDefense
    local finalTerrainDefenseToConsider = actualTerrainDefenseBenefit * (defender.health / 10)
    local terrainMultiplier = (100 - finalTerrainDefenseToConsider) / 100
    local damage = math.floor(baseDamage * attackerHpMultiplier * terrainMultiplier)
    if baseDamage > 0 and damage < 1 then damage = 1 end
    return damage
end

local BattleConfigManager = {}

-- NEW: Add gameMode property and a setter function
BattleConfigManager.gameMode = "vs_ai" -- Default game mode

function BattleConfigManager.setGameMode(mode)
    BattleConfigManager.gameMode = mode
end

function BattleConfigManager.getGridSetup() return GRID_SETUP end

function BattleConfigManager.updateGridSetupFromMapData(mapData)
    if type(mapData) ~= "table" then print("ERROR (battleConfig.updateGridSetup): mapData is not a table."); return end
    GRID_SETUP.maxGridSizeX = nil; GRID_SETUP.maxGridSizeZ = nil
    GRID_SETUP.unitPlacement = {}; GRID_SETUP.itemPlacement = {}; GRID_SETUP.nestPlacement = {} 
    GRID_SETUP.worldItemPlacement = {}; GRID_SETUP.defaultDitherPatternKey = nil
    GRID_SETUP.tileDitherPatternOverrides = {}; GRID_SETUP.gameplayTerrain = {}; GRID_SETUP.loadedMapMetadata = nil
    if mapData.grid then
        GRID_SETUP.maxGridSizeX = mapData.grid.maxGridSizeX
        GRID_SETUP.maxGridSizeZ = mapData.grid.maxGridSizeZ
        GRID_SETUP.defaultDitherPatternKey = mapData.grid.defaultDitherPatternKey
    end
    GRID_SETUP.unitPlacement = mapData.units or {}
    GRID_SETUP.itemPlacement = mapData.items or {}
    GRID_SETUP.nestPlacement = mapData.nests or {} 
    GRID_SETUP.worldItemPlacement = mapData.worldItemPlacement or {}
    GRID_SETUP.tileDitherPatternOverrides = mapData.tileDitherPatternOverrides or {}
    GRID_SETUP.gameplayTerrain = mapData.gameplayTerrain or {}
    GRID_SETUP.loadedMapMetadata = mapData.metadata or nil
end

BattleConfigManager.BIRD_CONFIG = BIRD_CONFIG
BattleConfigManager.FOOD_CONFIG = FOOD_CONFIG
BattleConfigManager.NEST_CONFIG = NEST_CONFIG
BattleConfigManager.ITEM_CONFIG = ITEM_CONFIG
BattleConfigManager.DAMAGE_CHART = DAMAGE_CHART
BattleConfigManager.TERRAIN_DEFENSE = TERRAIN_DEFENSE
BattleConfigManager.MOVEMENT_COSTS = MOVEMENT_COSTS
BattleConfigManager.calculateDamage = calculateDamage
BattleConfigManager.SPAWNABLE_UNITS_ORDER = SPAWNABLE_UNITS_ORDER

print("battleConfig.lua: MODULE EXECUTION FINISHED, returning BattleConfigManager table.")
return BattleConfigManager