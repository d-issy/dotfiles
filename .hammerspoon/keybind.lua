-- Option
hs.window.animationDuration = 0

-- launchOrFocus does not work for multiscreen
-- this is an alternative method
function focusApp(name)
    local app = hs.appfinder.appFromName(name)
    if app ~= nil and app:isRunning() then
        app:activate(true)
    else
        hs.application.open(name)
    end
end

-- keymap
function remap(mods, key, fn)
    return hs.hotkey.bind(mods, key, fn, nil, fn)
end

hs.hotkey.bind({'cmd', 'ctrl'}, 'D', function()
    focusApp('Finder')
end)

hs.hotkey.bind({'cmd', 'ctrl'}, 'E', function()
    focusApp('iTerm2')
end)

hs.hotkey.bind({'cmd', 'ctrl'}, 'K', function()
    focusApp('Keynote')
end)

hs.hotkey.bind({'cmd', 'ctrl'}, 'P', function()
    focusApp('Microsoft PowerPoint')
end)

hs.hotkey.bind({'cmd', 'ctrl'}, 'V', function()
    focusApp('Vivaldi')
end)

-- app shortcut handling
keyCodes = {}
keyCodes[#keyCodes+1] = remap({'ctrl'}, 'W', function()
    hs.eventtap.keyStroke({'alt'}, 'Delete', 0)
end)

keyCodes[#keyCodes+1] = remap({'ctrl'}, 'H', function()
    hs.eventtap.keyStroke({}, 'Left', 0)
end)

keyCodes[#keyCodes+1] = remap({'ctrl'}, 'N', function()
    hs.eventtap.keyStroke({}, 'Down', 0)
end)

keyCodes[#keyCodes+1] = remap({'ctrl'}, 'P', function()
    hs.eventtap.keyStroke({}, 'Up', 0)
end)

keyCodes[#keyCodes+1] = remap({'ctrl'}, 'L', function()
    hs.eventtap.keyStroke({}, 'Right', 0)
end)

appWatcher = hs.application.watcher.new(function(app, eType)
    if eType ~= hs.application.watcher.activated then
        return
    end
    if app == 'Terminal' or app == 'iTerm2' or app == 'Alacritty' then
        for i=1, #keyCodes do
            keyCodes[i]:disable()
        end
    else
        for i=1, #keyCodes do
            keyCodes[i]:enable()
        end
    end
end):start()

--- reload
hs.hotkey.bind({'cmd', 'alt', 'ctrl'}, 'R', function()
    hs.reload()
end)
