-- ProceduralTilesetDefinitions.lua

-- This table defines the properties and drawing logic keys for various tile types.
-- The actual drawing functions (e.g., draw_straight_road, draw_curved_road)
-- would be defined elsewhere and called based on the 'render_key'.
-- ALL FRACTIONAL PARAMETERS ARE RELATIVE TO THE PROJECTED CORNERS OF THE TILE.
-- FILLS for surfaces are done using DITHER PATTERNS. NO EXPLICIT OUTLINES.

local ProceduralTilesetDefinitions = {

    -- =========================================================================
    -- STANDARD DITHER PATTERNS (examples)
    -- These can be referenced by name in the definitions below.
    -- Your actual dither pattern tables will be here.
    -- =========================================================================
    dither_patterns = {
        SOLID_BLACK = {0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF},
        SOLID_GRAY_75 = {0xEE,0xEE,0xEE,0xEE,0xEE,0xEE,0xEE,0xEE}, -- Approximation
        SOLID_GRAY_50 = {0xAA,0xAA,0xAA,0xAA,0xAA,0xAA,0xAA,0xAA},
        SOLID_GRAY_25 = {0x55,0x55,0x55,0x55,0x55,0x55,0x55,0x55}, -- Approximation
        SOLID_WHITE = {0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00}, -- Represents clear/no fill if background is white

        CHECKER_MEDIUM = {0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55},
        CHECKER_FINE = {0xCC, 0x33, 0xCC, 0x33, 0xCC, 0x33, 0xCC, 0x33},
        VERTICAL_LINES_MEDIUM = {0xCC,0xCC,0xCC,0xCC,0xCC,0xCC,0xCC,0xCC},
        HORIZONTAL_LINES_MEDIUM = {0xFF,0x00,0xFF,0x00,0xFF,0x00,0xFF,0x00},
        DIAGONAL_LINES_R = {0x88,0x44,0x22,0x11,0x88,0x44,0x22,0x11}, -- Example
        DIAGONAL_LINES_L = {0x11,0x22,0x44,0x88,0x11,0x22,0x44,0x88}, -- Example

        ROAD_ASPHALT_DARK = {0x77,0xDD,0x77,0xDD,0xBB,0xEE,0xBB,0xEE}, -- Example dense, darkish pattern
        GRASS_TEXTURE_LIGHT = {0x5A, 0xA5, 0x5A, 0xA5, 0x5A, 0xA5, 0x5A, 0xA5},
        WATER_RIPPLES = {0x55,0xAA,0x33,0xCC,0x55,0xAA,0x33,0xCC}, -- Example
        DIRT_MOTTLED = {0xA6,0xDA,0x69,0xAD,0xA6,0xDA,0x69,0xAD} -- Example
    },

    -- =========================================================================
    -- SHARED PARAMETERS
    -- =========================================================================
    shared_parameters = {
        -- This pattern is used to fill the base tile polygon before any specific
        -- features (like roads or grass patches) are drawn on top.
        default_background_dither_pattern_key = "SOLID_GRAY_25", -- Key from dither_patterns table

        road = {
            -- This fraction defines the road's thickness relative to the
            -- projected edges it runs perpendicular to.
            -- For a HORIZONTAL road, this is a fraction of the length of the
            -- tile's projected *vertical* edges. The road is centered.
            -- E.g., if 0.5, the road's top edge points are 25% down the vertical
            -- projected edges, and bottom edge points are 75% down.
            -- For a VERTICAL road, this is a fraction of the length of the
            -- tile's projected *horizontal* edges.
            width_fraction = 0.5,

            -- This factor influences how "tight" or "sweeping" the curves are.
            -- It's used to calculate Bezier control points by moving a certain
            -- fraction along the projected edges *from the relevant corner*.
            curve_control_point_factor = 0.55,

            -- Key for the dither pattern to fill the road surface polygon.
            surface_dither_pattern_key = "ROAD_ASPHALT_DARK",
        },

        grass = {
            -- Key for the dither pattern to fill grass areas.
            surface_dither_pattern_key = "GRASS_TEXTURE_LIGHT",
            -- Optional: for drawing multiple layers or variations of grass within one tile
            -- highlight_dither_pattern_key = "CHECKER_FINE",
            -- highlight_coverage_factor = 0.3 -- e.g., 30% of grass area gets highlight pattern
        },

        water = {
            surface_dither_pattern_key = "WATER_RIPPLES",
        },

        dirt = {
            surface_dither_pattern_key = "DIRT_MOTTLED",
        }
        -- Add other categories like 'building', 'forest', etc.
    },

    -- =========================================================================
    -- TILE DEFINITIONS
    -- Each key here represents a unique tile type your game grid can use.
    -- The 'render_key' points to a specific drawing function.
    -- 'params' can override or add to shared_parameters.
    -- The 'base_category' helps determine the default background fill if not
    -- overridden by a more specific feature covering the whole tile.
    -- =========================================================================
    tile_definitions = {
        -- Basic Ground Tiles
        GRASS_PLAIN = {
            description = "Standard grass field.",
            render_key = "draw_full_tile_pattern", -- A generic function that fills the whole tile
            category = "grass",                  -- Uses grass.surface_dither_pattern_key
            params = {
                -- No specific params needed if just filling with category's pattern
            }
        },
        DIRT_PLAIN = {
            description = "Plain dirt patch.",
            render_key = "draw_full_tile_pattern",
            category = "dirt",
        },
        WATER_PLAIN = {
            description = "Plain water tile.",
            render_key = "draw_full_tile_pattern",
            category = "water",
        },

        -- Road Tiles
        -- For roads, the 'category' defines the road itself.
        -- The background behind/around the road will use 'default_background_dither_pattern_key'
        -- or could be specified with a 'background_category' if roads are on, say, grass.
        ROAD_HORIZONTAL = {
            description = "Straight horizontal road segment.",
            render_key = "draw_road_straight", -- This function will draw the road shape
            category = "road",                 -- Defines road's appearance (pattern, width_fraction)
            background_category = "grass",     -- OPTIONAL: What's under/around the road. If nil, use default_background.
            params = {
                orientation = "horizontal"     -- Used by the draw_road_straight function
            }
        },
        ROAD_VERTICAL = {
            description = "Straight vertical road segment.",
            render_key = "draw_road_straight",
            category = "road",
            background_category = "grass",
            params = {
                orientation = "vertical"
            }
        },

        -- Road Curves
        ROAD_CURVE_TOP_LEFT = {
            description = "Road curve connecting top edge to left edge.",
            render_key = "draw_road_curve",
            category = "road",
            background_category = "grass",
            params = {
                corner_type = "TOP_LEFT"
            }
        },
        ROAD_CURVE_TOP_RIGHT = {
            description = "Road curve connecting top edge to right edge.",
            render_key = "draw_road_curve",
            category = "road",
            background_category = "grass",
            params = {
                corner_type = "TOP_RIGHT"
            }
        },
        ROAD_CURVE_BOTTOM_LEFT = {
            description = "Road curve connecting bottom edge to left edge.",
            render_key = "draw_road_curve",
            category = "road",
            background_category = "grass",
            params = {
                corner_type = "BOTTOM_LEFT"
            }
        },
        ROAD_CURVE_BOTTOM_RIGHT = {
            description = "Road curve connecting bottom edge to right edge.",
            render_key = "draw_road_curve",
            category = "road",
            background_category = "grass",
            params = {
                corner_type = "BOTTOM_RIGHT"
            }
        },

        -- Road Intersections (Examples - these would need more complex drawing functions)
        ROAD_T_JUNCTION_NORTH = { -- Main road horizontal, branch goes "north" (relative to tile)
            description = "T-junction, stem north.",
            render_key = "draw_road_t_junction",
            category = "road",
            background_category = "grass",
            params = {
                stem_direction = "NORTH" -- or "UP", "AWAY_FROM_VIEWER" depending on your coordinate system
            }
        },
        ROAD_T_JUNCTION_EAST = {
            description = "T-junction, stem east.",
            render_key = "draw_road_t_junction",
            category = "road",
            background_category = "grass",
            params = {
                stem_direction = "EAST"
            }
        },
        -- ... (T_JUNCTION_SOUTH, T_JUNCTION_WEST)

        ROAD_CROSS_JUNCTION = {
            description = "Four-way intersection.",
            render_key = "draw_road_cross_junction",
            category = "road",
            background_category = "grass",
            params = {}
        },

        -- Mixed Tiles (Example: Grass with a path)
        GRASS_WITH_PATH_HORIZONTAL = {
            description = "Grass tile with a narrower horizontal dirt path.",
            render_key = "draw_feature_on_background", -- Generic renderer
            base_category = "grass", -- The main fill of the tile
            features = {
                {
                    feature_type = "path_straight", -- A sub-type or specific drawing key
                    category = "dirt",          -- Path uses dirt parameters
                    params = {
                        orientation = "horizontal",
                        width_fraction = 0.3 -- Path is narrower than a full road
                    }
                }
            }
        },

        -- You would continue to define more tile types:
        -- GRASS_WITH_ROCKS, FOREST_EDGE, BUILDING_CORNER, etc.
        -- Each would have a 'render_key' pointing to a Lua function that knows
        -- how to interpret its 'params' and the shared parameters for its 'category'
        -- to draw the feature(s) onto the projected tile polygon using dither patterns.
    }
}

--[[
Helper function to get effective parameters for a tile type.
This would merge shared_parameters with tile-specific parameters.

function ProceduralTilesetDefinitions:getEffectiveParams(tileDefinitionName)
    local def = self.tile_definitions[tileDefinitionName]
    if not def then return nil end

    local effective = {}

    -- Start with default background for the whole tile
    if self.shared_parameters.default_background_dither_pattern_key then
        effective.background_dither_pattern = self.dither_patterns[self.shared_parameters.default_background_dither_pattern_key]
    end

    -- If a base category is defined for the tile (e.g. GRASS_PLAIN)
    if def.category and self.shared_parameters[def.category] then
        local category_shared = self.shared_parameters[def.category]
        for k, v in pairs(category_shared) do
            if type(v) == "table" and k:match("_dither_pattern_key$") then
                effective[k:gsub("_key$", "")] = self.dither_patterns[v] -- Resolve pattern key
            elseif type(v) ~= "table" then -- Simple values
                effective[k] = v
            elseif type(v) == "table" then -- Nested tables (like road.width_fraction)
                 effective[k] = {}
                 for nk, nv in pairs(v) do effective[k][nk] = nv end
            end
        end
        -- If the main category has a surface pattern, it becomes the primary fill
        if category_shared.surface_dither_pattern_key then
             effective.primary_surface_dither_pattern = self.dither_patterns[category_shared.surface_dither_pattern_key]
        end
    end
    
    -- If a background_category is specified (e.g., for roads on grass)
    if def.background_category and self.shared_parameters[def.background_category] then
        local bg_category_shared = self.shared_parameters[def.background_category]
        if bg_category_shared.surface_dither_pattern_key then
            effective.background_dither_pattern = self.dither_patterns[bg_category_shared.surface_dither_pattern_key]
        end
    end


    -- Merge specific tile parameters, overriding shared ones
    if def.params then
        for k, v in pairs(def.params) do
            effective[k] = v -- Specific params override
        end
    end
    
    -- For complex tiles with multiple features, this helper would need to be more sophisticated
    -- or the drawing function would handle resolving feature-specific params.

    return effective
end

-- Example Usage (Illustrative - not for direct execution here)
-- local params_for_road_h = ProceduralTilesetDefinitions:getEffectiveParams("ROAD_HORIZONTAL")
-- if params_for_road_h then
--     print(params_for_road_h.surface_dither_pattern) -- Should print the resolved dither table
--     print(params_for_road_h.width_fraction)
--     print(params_for_road_h.background_dither_pattern) -- Should be grass pattern
-- end

-- local params_for_grass = ProceduralTilesetDefinitions:getEffectiveParams("GRASS_PLAIN")
-- if params_for_grass then
--    print(params_for_grass.primary_surface_dither_pattern) -- Should be grass pattern
--    print(params_for_grass.background_dither_pattern) -- Should be default_background or overridden by grass pattern itself
-- end

--]]

return ProceduralTilesetDefinitions