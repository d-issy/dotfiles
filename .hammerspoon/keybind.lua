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

--- reload
hs.hotkey.bind({'cmd', 'alt', 'ctrl'}, 'R', function() 
    hs.reload()
end)
