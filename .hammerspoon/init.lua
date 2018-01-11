-- KeyCode
Escape = 0x35
RightCmd = 0x36
LeftCmd = 0x37
Eisuu = 0x66
Kana = 0x68

-- Option
hs.window.animationDuration = 0
rightSpace = 3

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
singleCmd = false
eikanaEventTap = hs.eventtap.new({
    hs.eventtap.event.types.flagsChanged,
    hs.eventtap.event.types.keyDown
}, function(event)
    local eventType = event:getType()
    local keyCode = event:getKeyCode()

    -- keyDown Event
    if eventType == hs.eventtap.event.types.keyDown then
        singleCmd = false
        if keyCode == Escape then
            hs.eventtap.keyStroke({}, Eisuu)
        end
        return
    end
    
    -- except VMWare Fusion
    local activeApplication = hs.application.frontmostApplication()
    if activeApplication:bundleID() == 'com.vmware.fusion' then
        return
    end

    local flags = event:getFlags()
    if flags['cmd'] then
        singleCmd = true
        return
    end

    if singleCmd then
        singleCmd = false
        if keyCode == RightCmd then
            hs.eventtap.keyStroke({}, Kana)
        elseif keyCode == LeftCmd then
            hs.eventtap.keyStroke({}, Eisuu)
        end
    end
end)
eikanaEventTap:start()

-- wifiWatcher
netConfig = hs.network.configuration.open()
proxy = false
interface = 'en0'

function setProxy()
    proxy = true
    netConfig:setLocation('school')
end

function unsetProxy()
    proxy = false
    netConfig:setLocation('local')
end

wifiWatcher = hs.wifi.watcher.new(function(watcher, message, _) 
    if message ~= 'SSIDChange' then
        return
    end

    local nextSSID = hs.wifi.currentNetwork(interface)
    if nextSSID == 'KIT-WLAP2' and (not proxy) then
        setProxy()
    elseif nextSSID ~= 'KIT-WLAP2' and proxy  then
        unsetProxy()
    end
end)

if hs.wifi.currentNetwork(interface) == 'KIT-WLAP2' then
    setProxy()
else
    unsetProxy()
end

wifiWatcher:start()

-- App Switcher
hs.hotkey.bind({'cmd', 'ctrl'}, 'D', function()
    hs.application.launchOrFocus('Dash')
end)

hs.hotkey.bind({'cmd', 'ctrl'}, 'K', function()
    hs.application.launchOrFocus('Keynote')
end)

hs.hotkey.bind({'cmd', 'ctrl'}, 'N', function()
    hs.application.launchOrFocus('Numi')
end)

hs.hotkey.bind({'cmd', 'ctrl'}, 'P', function()
    hs.application.launchOrFocus('Microsoft PowerPoint')
end)

hs.hotkey.bind({'cmd', 'ctrl'}, 'V', function()
    hs.application.launchOrFocus('Vivaldi')
end)

--- reload
hs.hotkey.bind({'cmd', 'alt', 'ctrl'}, 'R', function() 
    hs.reload()
end)

--- show config loaded
hs.alert.show('config loaded')
