-- keymap
function remap(mods, key, fn)
    return hs.hotkey.bind(mods, key, fn, nil, fn)
end

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
    if app == 'Terminal'
        or app == 'iTerm2'
        or app == 'Alacritty'
        or app == 'Hyper' then
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
