-- global settings
hs.window.animationDuration = 0
offset = {top=10, bottom=36, left=8, right=8, gap=10}

-- mode
-- 0: single app mode
-- 1: original mode
mode = 1

-- applications settings
xApps = {
    'Alfred 3',
    'Finder',
    'Hammerspoon',
    'System Preferences',
}

xTitles = {
    '',
    'Open',
}

-- show
winFilter = hs.window.filter.new(nil, nil, 'debug')
winFilter:subscribe(hs.window.filter.windowFocused, function(win, app)
    if mode == 1 then return end
    if not win:isStandard() then return end
    for i=1, #xApps do
        if app == xApps[i] then return end
    end
    for i=1, #xTitles do
        if win:title() == xTitles[i] then return end
    end
    toFull()
end)

function toCenter(win)
    win = win or hs.window.focusedWindow()
    if win == nil then return end
    win:centerOnScreen(nil, true)
end

function toFull(win)
    win = win or hs.window.focusedWindow()
    if win == nil then return end
    local max = hs.screen.mainScreen():frame()
    win:setFrame({
        offset.left,
        offset.top,
        max.w - offset.left - offset.right,
        max.h - offset.top - offset.bottom
    })
    mode = 0
end

function toLeftSide(win)
    win = win or hs.window.focusedWindow()
    if win == nil then return end
    local max = hs.screen.mainScreen():frame()
    win:setFrame({
        offset.left,
        offset.top,
        max.w/2 - offset.left - offset.gap/2,
        max.h - offset.top - offset.bottom
    })
    mode = 1
end

function toRightSide(win)
    win = win or hs.window.focusedWindow()
    if win == nil then return end
    local max = hs.screen.mainScreen():frame()
    win:setFrame({
        max.w/2 + offset.gap/2,
        offset.top,
        max.w/2 - offset.right - offset.gap/2,
        max.h - offset.top - offset.bottom
    })
    mode = 1
end

function disableSingleAppMode()
    mode = 1
end

---- switch
switcher = hs.window.switcher.new(winFilter, {
    showTitles = false,
    showThumbnails = true,
    showSelectedThumbnail = false,
    showSelectedTitle = false,
})

function focusLeftWindow()
    if mode == 1 then
        winFilter:focusWindowWest()
    else
        switcher:previous()
    end
end

function focusRightWindow()
    if mode == 1 then
        winFilter:focusWindowEast()
    else
        switcher:next()
    end
end

function focusApp(name)
    local app = hs.appfinder.appFromName(name)
    if app ~= nil and app:isRunning() then
        app:activate(true)
    else
        hs.application.open(name)
    end
end


-- bind
hs.hotkey.bind({'alt'}, 'A', toFull)
hs.hotkey.bind({'alt'}, 'S', disableSingleAppMode)
hs.hotkey.bind({'alt'}, 'C', toCenter)

hs.hotkey.bind({'ctrl', 'alt'}, 'H', toLeftSide)
hs.hotkey.bind({'ctrl', 'alt'}, 'L', toRightSide)

hs.hotkey.bind({'alt'}, 'H', focusLeftWindow)
hs.hotkey.bind({'alt'}, 'L', focusRightWindow)

--
hs.hotkey.bind({'alt'}, 'E', function() focusApp('com.googlecode.iterm2') end)
hs.hotkey.bind({'alt'}, 'V', function() focusApp('com.vivaldi.Vivaldi') end)
