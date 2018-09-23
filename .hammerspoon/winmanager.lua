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
winFilter:setCurrentSpace(true)
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

---- switcher
function getWinInfo()
    local c = hs.window.focusedWindow()
    local cid = c and c:id() or nil
    local rs = {
        windows = {},
        current = c,
        currentID = cid,
    }
    local wins = hs.window.allWindows()
    if mode ~= 0 then
        table.sort(wins, function(a, b)
            return a:frame().x < b:frame().x
        end)
    end
    for i=1, #wins do
        local win = wins[i]
        local idx = #rs.windows+1
        if cid == win:id() then
            rs.currentIdx = idx
            rs.windows[idx] = win
        elseif win:isStandard() then
            rs.windows[idx] = win
        end
    end
    return rs
end

function focusLeftWindow()
    local w = getWinInfo()
    local idx
    if w.currentIdx == nil then idx = 1
    else
        idx = (w.currentIdx-2) % (#w.windows) + 1
    end
    w.windows[idx]:focus()
end

function focusRightWindow()
    local w = getWinInfo()
    local idx
    if w.currentIdx == nil then idx = 1
    else
        idx =(w.currentIdx) % (#w.windows) + 1
    end
    w.windows[idx]:focus()
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
