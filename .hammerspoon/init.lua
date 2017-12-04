-- reload
hs.hotkey.bind({'cmd', 'alt', 'ctrl'}, 'R', function() 
    hs.reload()
end)

-- KeyCode
local Escape = 0x35
local RightCmd = 0x36
local LeftCmd = 0x37
local Eisuu = 0x66
local Kana = 0x68

-- Option
hs.window.animationDuration = 0
local rightSpace = 3

-- Window move: up
hs.hotkey.bind({'cmd', 'ctrl'}, 'Up', function()
    local win = hs.window.focusedWindow()
    local screen = win:screen()
    local max = screen:frame()
    win:setFrame(hs.geometry.rect(0, 0, max.w + rightSpace, max.h))
end)

-- Window move: left
hs.hotkey.bind({'cmd', 'ctrl'}, 'Left', function()
    local win = hs.window.focusedWindow()
    local screen = win:screen()
    local max = screen:frame()
    win:setFrame(hs.geometry.rect(0, 0, max.w/2, max.h))
end)

-- Window move: right
hs.hotkey.bind({'cmd', 'ctrl'}, 'Right', function()
    local win = hs.window.focusedWindow()
    local screen = win:screen()
    local max = screen:frame()
    win:setFrame(hs.geometry.rect(max.w/2, 0, max.w/2 + rightSpace, max.h))
end)

-- Window move: center
hs.hotkey.bind({'cmd', 'ctrl'}, 'C', function()
    local win = hs.window.focusedWindow()
    win:centerOnScreen()
end)

-- Window move: full screen
hs.hotkey.bind({'cmd', 'ctrl'}, 'F', function()
    local win = hs.window.focusedWindow()
    win:toggleFullScreen()
end)

-- eikana
local singleCmd = false

local function eikanaEvent(event)
    local eventType = event:getType()
    if eventType == hs.eventtap.event.types.keyDown and singleCmd then
        singleCmd = false
    elseif eventType == hs.eventtap.event.types.flagsChanged then
        local flags = event:getFlags()
        if flags['cmd'] then
            singleCmd = true
        else
            local keyCode = event:getKeyCode()
            if singleCmd then
                if keyCode == RightCmd then
                    hs.eventtap.keyStroke({}, Kana)
                elseif keyCode == LeftCmd then
                    hs.eventtap.keyStroke({}, Eisuu)
                end
                singleCmd = false
            end
        end
    end
end

local eikanaEventTap = hs.eventtap.new({
    hs.eventtap.event.types.flagsChanged,
    hs.eventtap.event.types.keyDown
}, eikanaEvent)
eikanaEventTap:start()

-- loaded: if debug
hs.alert.show('config loaded')
