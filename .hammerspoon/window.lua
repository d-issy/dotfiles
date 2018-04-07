-- Option
hs.window.animationDuration = 0

-- Window fit: up
hs.hotkey.bind({'cmd', 'ctrl'}, 'Up', function()
    local win = hs.window.focusedWindow()
    local screen = win:screen()
    local max = screen:frame()
    win:setFrame(hs.geometry.rect(0, 0, max.w, max.h))
end)

-- Window fit: left
hs.hotkey.bind({'cmd', 'ctrl'}, 'Left', function()
    local win = hs.window.focusedWindow()
    local screen = win:screen()
    local max = screen:frame()
    win:setFrame(hs.geometry.rect(0, 0, max.w/2, max.h))
end)

-- Window fit: right
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

-- move
moveSize = 50

-- Window move: up
hs.hotkey.bind({'cmd', 'ctrl', 'shift'}, 'Up', function()
    local win = hs.window.focusedWindow()
    local frame = win:frame()
    frame.y = frame.y - moveSize
    if frame.y < 0 then
        frame.y = 0
    end
    win:move(frame)
end)

-- Window move: down
hs.hotkey.bind({'cmd', 'ctrl', 'shift'}, 'Down', function()
    local win = hs.window.focusedWindow()
    local screen = win:screen()
    local frame = win:frame()
    frame.y = frame.y + moveSize
    if frame.y > screen:frame().h - frame.h then
        frame.y = screen:frame().h - frame.h
    end
    win:move(frame)
end)

-- Window move: left
hs.hotkey.bind({'cmd', 'ctrl', 'shift'}, 'Left', function()
    local win = hs.window.focusedWindow()
    local frame = win:frame()
    frame.x = frame.x - moveSize
    if frame.x < 0 then
        frame.x = 0
    end
    win:move(frame)
end)

-- Window move: right
hs.hotkey.bind({'cmd', 'ctrl', 'shift'}, 'Right', function()
    local win = hs.window.focusedWindow()
    local screen = win:screen()
    local frame = win:frame()
    frame.x = frame.x + moveSize
    if frame.x > screen:frame().w - frame.w then
        frame.x = screen:frame().w - frame.w
    end
    win:move(frame)
end)
