-- Option
hs.window.animationDuration = 0

-- Window move: up
hs.hotkey.bind({'cmd', 'ctrl'}, 'Up', function()
    local win = hs.window.focusedWindow()
    local screen = win:screen()
    local max = screen:frame()
    win:setFrame(hs.geometry.rect(0, 0, max.w, max.h))
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
    win:setFrame(hs.geometry.rect(max.w/2, 0, max.w/2, max.h))
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
