-- str keymap
keyCodes = hs.hotkey.modal.new(nil)

function keyCodes:newMap(mods, key, fn)
    self:bind(mods, key, fn, nil, fn)
end

keyCodes:newMap({'ctrl'}, 'W', function()
    hs.eventtap.keyStroke({'alt'}, 'Delete', 0)
end)

keyCodes:newMap({'ctrl'}, 'N', function()
    hs.eventtap.keyStroke({}, 'Down', 0)
end)

keyCodes:newMap({'ctrl'}, 'P', function()
    hs.eventtap.keyStroke({}, 'Up', 0)
end)

keyCodes:newMap({'ctrl'}, 'H', function()
    hs.eventtap.keyStroke({}, 'Left', 0)
end)

keyCodes:newMap({'ctrl'}, 'L', function()
    hs.eventtap.keyStroke({}, 'Right', 0)
end)

-- hotkey toggle by application
appWatcher = hs.window.filter.new()
appWatcher:allowApp'Alfred 3'
appWatcher:allowApp'Spotlight'

appWatcher:subscribe({
    hs.window.filter.windowFocused,
}, function(win, app)
    if app == 'Terminal'
        or app == 'iTerm2'
        or app == 'Alacritty'
        or app == 'Hyper' then
        keyCodes:exit()
    else
        keyCodes:enter()
    end
end)

--- reload
hs.hotkey.bind({'cmd', 'alt', 'ctrl'}, 'R', function()
    hs.reload()
end)
