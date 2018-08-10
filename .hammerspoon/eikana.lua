-- KeyCode
local Escape = 0x35
local RightCmd = 0x36
local LeftCmd = 0x37
local Eisuu = 0x66
local Kana = 0x68

-- eikana
local singleCmd = false
eikanaEventTap = hs.eventtap.new({
    hs.eventtap.event.types.flagsChanged,
    hs.eventtap.event.types.keyDown
}, function(event)
    local eventType = event:getType()
    local keyCode = event:getKeyCode()

    -- except app
    local activeApp = hs.application.frontmostApplication()
    if activeApp:bundleID() == 'com.vmware.fusion' then
        singleCmd = false
        return
    end

    -- keyDown
    if eventType == hs.eventtap.event.types.keyDown then
        -- send eisuu key when pressing escape key
        if keyCode == Escape then
            hs.eventtap.keyStroke({}, Eisuu)
        end
        singleCmd = false
        return
    end

    -- cmdPress
    local flags = event:getFlags()
    if flags['cmd'] then
        singleCmd = true
        return
    end

    -- cmdRelease
    if singleCmd then
        if keyCode == RightCmd then
            hs.eventtap.keyStroke({}, Kana)
        elseif keyCode == LeftCmd then
            hs.eventtap.keyStroke({}, Eisuu)
        end
        singleCmd = false
    end
end)
eikanaEventTap:start()
