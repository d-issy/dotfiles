-- KeyCode
local LeftBracket = 0x21
local Escape      = 0x35
local RightCmd    = 0x36
local LeftCmd     = 0x37
local Eisu        = 0x66
local Kana        = 0x68

-- eventTypes
local flagsChanged = hs.eventtap.event.types.flagsChanged
local keyDown      = hs.eventtap.event.types.keyDown

-- eisu
hs.hotkey.bind({'ctrl', 'shift'}, ';', function()
    hs.eventtap.keyStroke({}, Eisu, 0)
end)

-- kana
hs.hotkey.bind({'ctrl', 'shift'}, 'j', function()
    hs.eventtap.keyStroke({}, Kana, 0)
end)

-- eikana
--- variable
local singleCmd = false
--- event
eikanaEventTap = hs.eventtap.new({flagsChanged, keyDown}, function(event)
    local eventType = event:getType()
    local keyCode = event:getKeyCode()
    local flags = event:getFlags()

    -- except app
    local activeApp = hs.application.frontmostApplication()
    if activeApp:bundleID() == 'com.vmware.fusion' or
        activeApp:bundleID() == 'org.virtualbox.app.VirtualBox' then
        singleCmd = false
        return
    end

    -- keyDown
    if eventType == keyDown then
        if keyCode == Escape then
            hs.eventtap.keyStroke({}, Eisu, 0)
        elseif flags['ctrl'] and keyCode == LeftBracket then
            hs.eventtap.keyStroke({}, Escape, 0)
        end
        singleCmd = false
        return
    end

    -- cmdPress
    if flags['cmd'] then
        singleCmd = true
        return
    end

    -- cmdRelease
    if singleCmd then
        if keyCode == RightCmd then
            hs.eventtap.keyStroke({}, Kana, 0)
        elseif keyCode == LeftCmd then
            hs.eventtap.keyStroke({}, Eisu, 0)
        end
        singleCmd = false
    end

end):start()
