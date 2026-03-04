-- gridProjection.lua - COMPLETE OPTIMIZED REPLACEMENT
import "CoreLibs/graphics"
import "CoreLibs/math"

local gfx <const> = playdate.graphics

local math_rad = math.rad; local math_cos = math.cos; local math_sin = math.sin
local math_max = math.max; local math_min = math.min; local math_abs = math.abs
local math_sqrt = math.sqrt; local math_floor = math.floor; local math_ceil = math.ceil

local GridProjection = {}
GridProjection.__index = GridProjection

function GridProjection:new(config, maxGridSizeX, maxGridSizeZ, tile3DWidth, isValidTileCallback, screenCenterX, screenCenterY)
    local instance = {}
    setmetatable(instance, GridProjection)

    instance.config = config
    instance.maxGridSizeX = maxGridSizeX
    instance.maxGridSizeZ = maxGridSizeZ
    instance.tile3DWidth = tile3DWidth
    instance.isValidTile = isValidTileCallback
    instance.screenCenterX_global = screenCenterX
    instance.screenCenterY_global = screenCenterY

    instance.projectionScale = instance.config.projectionScale
    instance.focalLength = instance.config.focalLength
    instance.vanishingPointYOffset = instance.config.vanishingPointYOffset
    instance.nearClipDistance = instance.config.nearClipDistance
    instance.enablePerspectiveProjection = instance.config.enablePerspectiveProjection

    instance.projectionCache = {}
    instance.centerCache = {}
    
    -- OPTIMIZATION: Cache trig values
    instance.currentCosViewAngle = 1
    instance.currentSinViewAngle = 0
    instance.lastGridAngle = 0
    instance.lastCosGrid = 1
    instance.lastSinGrid = 0
    
    -- OPTIMIZATION: Reusable tables to reduce allocations
    instance.polygonCoords = {}
    instance.tempCorners = {}
    
    -- OPTIMIZATION: Cache for world coordinates
    instance.worldCache = {}

    return instance
end

-- OPTIMIZATION: Cache world coordinates
function GridProjection:_gridToWorld(gridX, gridZ)
    local key = gridX .. "," .. gridZ
    if self.worldCache[key] then
        return table.unpack(self.worldCache[key])
    end
    
    local centerGridCoordX = (self.maxGridSizeX - 1) / 2.0
    local centerGridCoordZ = (self.maxGridSizeZ - 1) / 2.0
    local offsetGridX = gridX - centerGridCoordX
    local offsetGridZ = gridZ - centerGridCoordZ
    local worldX = offsetGridX * self.tile3DWidth
    local worldY = 0 
    local worldZ = offsetGridZ * self.tile3DWidth
    if self.maxGridSizeX % 2 == 0 then worldX = worldX - self.tile3DWidth/2 end
    if self.maxGridSizeZ % 2 == 0 then worldZ = worldZ - self.tile3DWidth/2 end
    
    self.worldCache[key] = {worldX, worldY, worldZ}
    return worldX, worldY, worldZ
end

function GridProjection:_getRawProjection(worldX, worldY, worldZ, gridAngleRad, cosViewAngle, sinViewAngle)
    -- Use cached trig values when possible
    local cosGrid = self.lastCosGrid
    local sinGrid = self.lastSinGrid
    
    local yRotatedX = worldX * cosGrid + worldZ * sinGrid
    local yRotated_Y_temp = worldY
    local yRotatedZ_for_tilt = -worldX * sinGrid + worldZ * cosGrid
    
    local viewSpaceX = yRotatedX
    local viewSpaceY = yRotated_Y_temp * cosViewAngle - yRotatedZ_for_tilt * sinViewAngle
    local viewSpaceZ_depth = yRotated_Y_temp * sinViewAngle + yRotatedZ_for_tilt * cosViewAngle

    local rawProjX, rawProjY
    if self.enablePerspectiveProjection then
        local effectiveDivisor = self.focalLength + viewSpaceZ_depth
        if effectiveDivisor < self.nearClipDistance then
            effectiveDivisor = self.nearClipDistance 
        end
        local perspectiveFactor = self.focalLength / effectiveDivisor
        rawProjX = viewSpaceX * perspectiveFactor
        rawProjY = viewSpaceY * perspectiveFactor
        rawProjX = rawProjX * self.projectionScale; rawProjY = rawProjY * self.projectionScale
    else
        rawProjX = viewSpaceX * self.projectionScale
        rawProjY = viewSpaceY * self.projectionScale
    end
    return rawProjX, rawProjY
end

function GridProjection:_projectPoint(worldX, worldY, worldZ, gridAngleRad, cosViewAngle, sinViewAngle, cameraOffsetX, cameraOffsetY)
    local rawProjX, rawProjY = self:_getRawProjection(worldX, worldY, worldZ, gridAngleRad, cosViewAngle, sinViewAngle)
    
    local currentScreenCenterX = self.screenCenterX_global
    local currentScreenCenterY = self.screenCenterY_global
    if self.enablePerspectiveProjection then
        currentScreenCenterY = currentScreenCenterY + self.vanishingPointYOffset
    end
    
    local screenX = currentScreenCenterX + rawProjX - cameraOffsetX
    local screenY = currentScreenCenterY + rawProjY - cameraOffsetY
    
    return screenX, screenY
end

function GridProjection:_drawOverlayOnImage(imageBeingDrawnOn, overlayType, overlayImageToDraw, tileCornersSxSy)
    if not overlayImageToDraw then return end
    
    local sx1, sy1 = tileCornersSxSy[1], tileCornersSxSy[2]
    local sx2, sy2 = tileCornersSxSy[3], tileCornersSxSy[4]
    local sx3, sy3 = tileCornersSxSy[5], tileCornersSxSy[6]
    local sx4, sy4 = tileCornersSxSy[7], tileCornersSxSy[8]
    
    local minX = math_min(sx1, sx2, sx3, sx4)
    local maxX = math_max(sx1, sx2, sx3, sx4)
    local minY = math_min(sy1, sy2, sy3, sy4)
    local maxY = math_max(sy1, sy2, sy3, sy4)
    
    local boxWidth = maxX - minX + 1
    local boxHeight = maxY - minY + 1

    if boxWidth <= 0 or boxHeight <= 0 then return end
    
    local tempImage = gfx.image.new(boxWidth, boxHeight)
    if not tempImage then return end
    
    gfx.pushContext(tempImage)
    gfx.clear(gfx.kColorClear)
    
    local polyX1, polyY1 = sx1 - minX, sy1 - minY
    local polyX2, polyY2 = sx2 - minX, sy2 - minY
    local polyX3, polyY3 = sx3 - minX, sy3 - minY
    local polyX4, polyY4 = sx4 - minX, sy4 - minY
    
    gfx.setColor(gfx.kColorBlack)
    gfx.fillPolygon(polyX1, polyY1, polyX2, polyY2, polyX3, polyY3, polyX4, polyY4)
    
    local overlayWidth, overlayHeight = overlayImageToDraw:getSize()
    
    local scaleX = boxWidth / overlayWidth
    local scaleY = boxHeight / overlayHeight
    local scale = math_min(scaleX, scaleY) * 0.9 
    
    local scaledWidth = overlayWidth * scale
    local scaledHeight = overlayHeight * scale
    local posX = (boxWidth - scaledWidth) / 2
    local posY = (boxHeight - scaledHeight) / 2
    
    gfx.setImageDrawMode(gfx.kDrawModeWhiteTransparent)
    overlayImageToDraw:drawScaled(posX, posY, scale)
    
    gfx.setImageDrawMode(gfx.kDrawModeCopy)
    gfx.popContext()
    
    gfx.pushContext(imageBeingDrawnOn)
    gfx.setImageDrawMode(gfx.kDrawModeNXOR)  
    tempImage:draw(minX, minY)
    gfx.setImageDrawMode(gfx.kDrawModeCopy)  
    gfx.popContext()
end

function GridProjection:generateProjectionCache(displayGridAngle, currentVerticalViewAngle)
    local verticalViewAngleRad = math_rad(currentVerticalViewAngle)
    local cosViewAngle = math_cos(verticalViewAngleRad)
    local sinViewAngle = math_sin(verticalViewAngleRad)
    
    self.currentCosViewAngle = cosViewAngle 
    self.currentSinViewAngle = sinViewAngle

    local angleKey = currentVerticalViewAngle .. "_" .. displayGridAngle
    
    if not self.projectionCache[angleKey] then self.projectionCache[angleKey] = {} end
    if not self.centerCache[angleKey] then self.centerCache[angleKey] = {} end
    
    local displayAngleRad = math_rad(displayGridAngle)
    
    -- OPTIMIZATION: Cache trig calculations
    if displayGridAngle ~= self.lastGridAngle then
        self.lastGridAngle = displayGridAngle
        self.lastCosGrid = math_cos(displayAngleRad)
        self.lastSinGrid = math_sin(displayAngleRad)
    end
    
    for z = 0, self.maxGridSizeZ - 1 do
        for x = 0, self.maxGridSizeX - 1 do
            if self.isValidTile(x, z) then
                local tileKey = x .. "," .. z
                
                local x1_3d, y1_3d, z1_3d = self:_gridToWorld(x, z)
                local x2_3d, y2_3d, z2_3d = self:_gridToWorld(x + 1, z)
                local x3_3d, y3_3d, z3_3d = self:_gridToWorld(x + 1, z + 1)
                local x4_3d, y4_3d, z4_3d = self:_gridToWorld(x, z + 1)
                
                local sx1_raw, sy1_raw = self:_getRawProjection(x1_3d, y1_3d, z1_3d, displayAngleRad, cosViewAngle, sinViewAngle)
                local sx2_raw, sy2_raw = self:_getRawProjection(x2_3d, y2_3d, z2_3d, displayAngleRad, cosViewAngle, sinViewAngle)
                local sx3_raw, sy3_raw = self:_getRawProjection(x3_3d, y3_3d, z3_3d, displayAngleRad, cosViewAngle, sinViewAngle)
                local sx4_raw, sy4_raw = self:_getRawProjection(x4_3d, y4_3d, z4_3d, displayAngleRad, cosViewAngle, sinViewAngle)
                
                self.projectionCache[angleKey][tileKey] = {
                    raw_sx1 = sx1_raw, raw_sy1 = sy1_raw,
                    raw_sx2 = sx2_raw, raw_sy2 = sy2_raw,
                    raw_sx3 = sx3_raw, raw_sy3 = sy3_raw,
                    raw_sx4 = sx4_raw, raw_sy4 = sy4_raw
                }
                
                local centerX_3d, centerY_3d, centerZ_3d = self:_gridToWorld(x + 0.5, z + 0.5)
                local centerSx_raw, centerSy_raw = self:_getRawProjection(centerX_3d, centerY_3d, centerZ_3d, displayAngleRad, cosViewAngle, sinViewAngle)
                self.centerCache[angleKey][tileKey] = {x = centerSx_raw, y = centerSy_raw}
            end
        end
    end
end

function GridProjection:getProjectedTileCornersForImageDrawing(gridX, gridZ, imageBufferCenterX, imageBufferCenterY, displayGridAngle, currentVerticalViewAngle, cameraOffsetX, cameraOffsetY)
    local verticalViewAngleRad = math_rad(currentVerticalViewAngle)
    local cosViewAngle = self.currentCosViewAngle
    local sinViewAngle = self.currentSinViewAngle

    local angleKey = currentVerticalViewAngle .. "_" .. displayGridAngle
    local tileKey = gridX .. "," .. gridZ
    
    local projData = self.projectionCache[angleKey] and self.projectionCache[angleKey][tileKey]
    
    local sx1_img, sy1_img, sx2_img, sy2_img, sx3_img, sy3_img, sx4_img, sy4_img

    local effectiveGlobalScreenCenterX = self.screenCenterX_global
    local effectiveGlobalScreenCenterY = self.screenCenterY_global
    if self.enablePerspectiveProjection then
        effectiveGlobalScreenCenterY = effectiveGlobalScreenCenterY + self.vanishingPointYOffset
    end

    local displayAngleRad = math_rad(displayGridAngle) 

    if projData then
        local sx1_proj = effectiveGlobalScreenCenterX + projData.raw_sx1 - cameraOffsetX
        local sy1_proj = effectiveGlobalScreenCenterY + projData.raw_sy1 - cameraOffsetY
        local sx2_proj = effectiveGlobalScreenCenterX + projData.raw_sx2 - cameraOffsetX
        local sy2_proj = effectiveGlobalScreenCenterY + projData.raw_sy2 - cameraOffsetY
        local sx3_proj = effectiveGlobalScreenCenterX + projData.raw_sx3 - cameraOffsetX
        local sy3_proj = effectiveGlobalScreenCenterY + projData.raw_sy3 - cameraOffsetY
        local sx4_proj = effectiveGlobalScreenCenterX + projData.raw_sx4 - cameraOffsetX
        local sy4_proj = effectiveGlobalScreenCenterY + projData.raw_sy4 - cameraOffsetY

        sx1_img = math_floor(sx1_proj - self.screenCenterX_global + imageBufferCenterX + 0.5)
        sy1_img = math_floor(sy1_proj - self.screenCenterY_global + imageBufferCenterY + 0.5)
        sx2_img = math_floor(sx2_proj - self.screenCenterX_global + imageBufferCenterX + 0.5)
        sy2_img = math_floor(sy2_proj - self.screenCenterY_global + imageBufferCenterY + 0.5)
        sx3_img = math_floor(sx3_proj - self.screenCenterX_global + imageBufferCenterX + 0.5)
        sy3_img = math_floor(sy3_proj - self.screenCenterY_global + imageBufferCenterY + 0.5)
        sx4_img = math_floor(sx4_proj - self.screenCenterX_global + imageBufferCenterX + 0.5)
        sy4_img = math_floor(sy4_proj - self.screenCenterY_global + imageBufferCenterY + 0.5)
    else
        local x1_3d, y1_3d, z1_3d = self:_gridToWorld(gridX, gridZ)
        local x2_3d, y2_3d, z2_3d = self:_gridToWorld(gridX + 1, gridZ)
        local x3_3d, y3_3d, z3_3d = self:_gridToWorld(gridX + 1, gridZ + 1)
        local x4_3d, y4_3d, z4_3d = self:_gridToWorld(gridX, gridZ + 1)

        local sx1_proj, sy1_proj = self:_projectPoint(x1_3d, y1_3d, z1_3d, displayAngleRad, cosViewAngle, sinViewAngle, cameraOffsetX, cameraOffsetY)
        local sx2_proj, sy2_proj = self:_projectPoint(x2_3d, y2_3d, z2_3d, displayAngleRad, cosViewAngle, sinViewAngle, cameraOffsetX, cameraOffsetY)
        local sx3_proj, sy3_proj = self:_projectPoint(x3_3d, y3_3d, z3_3d, displayAngleRad, cosViewAngle, sinViewAngle, cameraOffsetX, cameraOffsetY)
        local sx4_proj, sy4_proj = self:_projectPoint(x4_3d, y4_3d, z4_3d, displayAngleRad, cosViewAngle, sinViewAngle, cameraOffsetX, cameraOffsetY)
        
        sx1_img = math_floor(sx1_proj - self.screenCenterX_global + imageBufferCenterX + 0.5)
        sy1_img = math_floor(sy1_proj - self.screenCenterY_global + imageBufferCenterY + 0.5)
        sx2_img = math_floor(sx2_proj - self.screenCenterX_global + imageBufferCenterX + 0.5)
        sy2_img = math_floor(sy2_proj - self.screenCenterY_global + imageBufferCenterY + 0.5)
        sx3_img = math_floor(sx3_proj - self.screenCenterX_global + imageBufferCenterX + 0.5)
        sy3_img = math_floor(sy3_proj - self.screenCenterY_global + imageBufferCenterY + 0.5)
        sx4_img = math_floor(sx4_proj - self.screenCenterX_global + imageBufferCenterX + 0.5)
        sy4_img = math_floor(sy4_proj - self.screenCenterY_global + imageBufferCenterY + 0.5)
    end
    
    return sx1_img, sy1_img, sx2_img, sy2_img, sx3_img, sy3_img, sx4_img, sy4_img
end

-- OPTIMIZATION: Completely rewritten for performance
function GridProjection:drawTilesToImage(imageToDrawOn, imageBufferCenterX, imageBufferCenterY,
                                        displayGridAngle, currentVerticalViewAngle,
                                        cameraOffsetX, cameraOffsetY,
                                        tileOverlays, overlayImagesTable, 
                                        resolvedDefaultDitherPattern,   
                                        tileDitherOverridesTable,       
                                        ditherPatternDefinitions)       
                                        
    local verticalViewAngleRad = math_rad(currentVerticalViewAngle) 
    local cosViewAngle = self.currentCosViewAngle 
    local sinViewAngle = self.currentSinViewAngle

    local angleKey = currentVerticalViewAngle .. "_" .. displayGridAngle
    local displayAngleRad = math_rad(displayGridAngle)

    gfx.pushContext(imageToDrawOn)
    local ultimateFallbackPattern = {0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF}

    -- OPTIMIZATION: Pre-calculate screen transform values
    local effectiveGlobalScreenCenterX = self.screenCenterX_global
    local effectiveGlobalScreenCenterY = self.screenCenterY_global
    if self.enablePerspectiveProjection then
        effectiveGlobalScreenCenterY = effectiveGlobalScreenCenterY + self.vanishingPointYOffset
    end
    
    local screenOffsetX = -self.screenCenterX_global + imageBufferCenterX
    local screenOffsetY = -self.screenCenterY_global + imageBufferCenterY

    -- OPTIMIZATION: Group tiles by pattern to reduce context switches
    local tileGroups = {
        empty = {},
        default = {},
        patterns = {}
    }

    -- First pass: categorize all tiles
    for z = 0, self.maxGridSizeZ - 1 do
        for x = 0, self.maxGridSizeX - 1 do
            local tileKey = x .. "," .. z
            local isTileEmpty = tileDitherOverridesTable and tileDitherOverridesTable[tileKey] == "empty"
            
            if isTileEmpty then
                table.insert(tileGroups.empty, {x = x, z = z, key = tileKey})
            elseif self.isValidTile(x, z) then
                local patternKey = nil
                if tileDitherOverridesTable and ditherPatternDefinitions then
                    local overrideKeyString = tileDitherOverridesTable[tileKey] 
                    if overrideKeyString and ditherPatternDefinitions[overrideKeyString] then
                        patternKey = overrideKeyString
                    end
                end
                
                if patternKey then
                    if not tileGroups.patterns[patternKey] then
                        tileGroups.patterns[patternKey] = {}
                    end
                    table.insert(tileGroups.patterns[patternKey], {x = x, z = z, key = tileKey})
                else
                    table.insert(tileGroups.default, {x = x, z = z, key = tileKey})
                end
            end
        end
    end

    -- OPTIMIZATION: Optimized coordinate calculation function
    local function getScreenCoords(x, z)
        local projData = self.projectionCache[angleKey] and self.projectionCache[angleKey][x .. "," .. z]
        
        if projData then
            local sx1 = math_floor(effectiveGlobalScreenCenterX + projData.raw_sx1 - cameraOffsetX + screenOffsetX + 0.5)
            local sy1 = math_floor(effectiveGlobalScreenCenterY + projData.raw_sy1 - cameraOffsetY + screenOffsetY + 0.5)
            local sx2 = math_floor(effectiveGlobalScreenCenterX + projData.raw_sx2 - cameraOffsetX + screenOffsetX + 0.5)
            local sy2 = math_floor(effectiveGlobalScreenCenterY + projData.raw_sy2 - cameraOffsetY + screenOffsetY + 0.5)
            local sx3 = math_floor(effectiveGlobalScreenCenterX + projData.raw_sx3 - cameraOffsetX + screenOffsetX + 0.5)
            local sy3 = math_floor(effectiveGlobalScreenCenterY + projData.raw_sy3 - cameraOffsetY + screenOffsetY + 0.5)
            local sx4 = math_floor(effectiveGlobalScreenCenterX + projData.raw_sx4 - cameraOffsetX + screenOffsetX + 0.5)
            local sy4 = math_floor(effectiveGlobalScreenCenterY + projData.raw_sy4 - cameraOffsetY + screenOffsetY + 0.5)
            return sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4
        end
        return nil
    end

    -- Second pass: Draw empty tiles (white)
    if #tileGroups.empty > 0 then
        gfx.setColor(gfx.kColorWhite)
        for _, tile in ipairs(tileGroups.empty) do
            local sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4 = getScreenCoords(tile.x, tile.z)
            if sx1 then
                gfx.fillPolygon(sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4)
            end
        end
    end

    -- Third pass: Draw default pattern tiles
    if #tileGroups.default > 0 then
        local pattern = resolvedDefaultDitherPattern or ultimateFallbackPattern
        gfx.setColor(gfx.kColorBlack)
        gfx.setPattern(pattern)
        
        for _, tile in ipairs(tileGroups.default) do
            local sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4 = getScreenCoords(tile.x, tile.z)
            if sx1 then
                gfx.fillPolygon(sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4)
            end
        end
    end

    -- Fourth pass: Draw pattern-specific tiles (grouped by pattern)
    for patternKey, tiles in pairs(tileGroups.patterns) do
        if #tiles > 0 and ditherPatternDefinitions[patternKey] then
            gfx.setColor(gfx.kColorBlack)
            gfx.setPattern(ditherPatternDefinitions[patternKey])
            
            for _, tile in ipairs(tiles) do
                local sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4 = getScreenCoords(tile.x, tile.z)
                if sx1 then
                    gfx.fillPolygon(sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4)
                end
            end
        end
    end

    -- Fifth pass: Draw overlays (only if needed)
    if tileOverlays and overlayImagesTable then
        for tileKey, overlayType in pairs(tileOverlays) do
            if overlayImagesTable[overlayType] then
                local x, z = tileKey:match("(%d+),(%d+)")
                if x and z then
                    x, z = tonumber(x), tonumber(z)
                    local sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4 = getScreenCoords(x, z)
                    if sx1 then
                        local corners = {sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4}
                        self:_drawOverlayOnImage(imageToDrawOn, overlayType, overlayImagesTable[overlayType], corners)
                    end
                end
            end
        end
    end

    gfx.popContext()
end

function GridProjection:getTileScreenCenter(gridX, gridZ, displayGridAngle, currentVerticalViewAngle, cameraOffsetX, cameraOffsetY)
    local verticalViewAngleRad = math_rad(currentVerticalViewAngle)
    local cosViewAngle = self.currentCosViewAngle
    local sinViewAngle = self.currentSinViewAngle

    local angleKey = currentVerticalViewAngle .. "_" .. displayGridAngle
    local tileKey = gridX .. "," .. gridZ
    
    local centerData = self.centerCache[angleKey] and self.centerCache[angleKey][tileKey]

    local effectiveGlobalScreenCenterX = self.screenCenterX_global
    local effectiveGlobalScreenCenterY = self.screenCenterY_global
    if self.enablePerspectiveProjection then
        effectiveGlobalScreenCenterY = effectiveGlobalScreenCenterY + self.vanishingPointYOffset
    end

    if centerData then
        local screenX = effectiveGlobalScreenCenterX + centerData.x - cameraOffsetX
        local screenY = effectiveGlobalScreenCenterY + centerData.y - cameraOffsetY
        return screenX, screenY
    else
        local tileWorldCenterX, tileWorldCenterY, tileWorldCenterZ = self:_gridToWorld(gridX + 0.5, gridZ + 0.5)
        return self:_projectPoint(tileWorldCenterX, tileWorldCenterY, tileWorldCenterZ, math_rad(displayGridAngle), cosViewAngle, sinViewAngle, cameraOffsetX, cameraOffsetY)
    end
end

function GridProjection:getRawProjectedTileCorners(gridX, gridZ, displayGridAngle, currentVerticalViewAngle)
    local verticalViewAngleRad = math_rad(currentVerticalViewAngle)
    local cosViewAngle = self.currentCosViewAngle
    local sinViewAngle = self.currentSinViewAngle

    local angleKey = currentVerticalViewAngle .. "_" .. displayGridAngle
    local tileKey = gridX .. "," .. gridZ

    local projData = self.projectionCache[angleKey] and self.projectionCache[angleKey][tileKey]

    if projData then
        return projData.raw_sx1, projData.raw_sy1,
               projData.raw_sx2, projData.raw_sy2,
               projData.raw_sx3, projData.raw_sy3,
               projData.raw_sx4, projData.raw_sy4
    else
        local displayAngleRad = math_rad(displayGridAngle)
        local x1_3d, y1_3d, z1_3d = self:_gridToWorld(gridX, gridZ)
        local x2_3d, y2_3d, z2_3d = self:_gridToWorld(gridX + 1, gridZ)
        local x3_3d, y3_3d, z3_3d = self:_gridToWorld(gridX + 1, gridZ + 1)
        local x4_3d, y4_3d, z4_3d = self:_gridToWorld(gridX, gridZ + 1)

        local sx1_raw, sy1_raw = self:_getRawProjection(x1_3d, y1_3d, z1_3d, displayAngleRad, cosViewAngle, sinViewAngle)
        local sx2_raw, sy2_raw = self:_getRawProjection(x2_3d, y2_3d, z2_3d, displayAngleRad, cosViewAngle, sinViewAngle)
        local sx3_raw, sy3_raw = self:_getRawProjection(x3_3d, y3_3d, z3_3d, displayAngleRad, cosViewAngle, sinViewAngle)
        local sx4_raw, sy4_raw = self:_getRawProjection(x4_3d, y4_3d, z4_3d, displayAngleRad, cosViewAngle, sinViewAngle)
        return sx1_raw, sy1_raw, sx2_raw, sy2_raw, sx3_raw, sy3_raw, sx4_raw, sy4_raw
    end
end

function GridProjection:getRawProjectedTileCenter(gridX, gridZ, displayGridAngle, currentVerticalViewAngle)
    local verticalViewAngleRad = math_rad(currentVerticalViewAngle)
    local cosViewAngle = self.currentCosViewAngle
    local sinViewAngle = self.currentSinViewAngle

    local angleKey = currentVerticalViewAngle .. "_" .. displayGridAngle
    local tileKey = gridX .. "," .. gridZ
    
    local centerData = self.centerCache[angleKey] and self.centerCache[angleKey][tileKey]

    if centerData then
        return centerData.x, centerData.y
    else
        local displayAngleRad = math_rad(displayGridAngle)
        local centerX_3d, centerY_3d, centerZ_3d = self:_gridToWorld(gridX + 0.5, gridZ + 0.5)
        return self:_getRawProjection(centerX_3d, centerY_3d, centerZ_3d, displayAngleRad, cosViewAngle, sinViewAngle)
    end
end

function GridProjection:projectWorldPointToScreen(worldX, worldY, worldZ, displayGridAngle, currentVerticalViewAngle, cameraOffsetX, cameraOffsetY)
    local verticalViewAngleRad = math_rad(currentVerticalViewAngle)
    local cosViewAngle = self.currentCosViewAngle
    local sinViewAngle = self.currentSinViewAngle
    local displayAngleRad = math_rad(displayGridAngle)

    return self:_projectPoint(worldX, worldY, worldZ, displayAngleRad, cosViewAngle, sinViewAngle, cameraOffsetX, cameraOffsetY)
end

function GridProjection:getCacheEntryCount()
    local count = 0
    if self.projectionCache then
        for _, angleCacheData in pairs(self.projectionCache) do
            for _, _ in pairs(angleCacheData) do
                count = count + 1
            end
        end
    end
    return count
end

return GridProjection