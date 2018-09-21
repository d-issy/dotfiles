-- animationDuration
hs.window.animationDuration = 0

-- wmMode 0 single window mode
-- wmMode 1 tile window mode

wmMode = 0

-- wmOffset
wmOffset = {top=10, bottom=36, left=8, right=8, gap=10}

--
wmAppFilter = hs.window.filter.new()
wmAppFilter:setCurrentSpace(true)
wmAppFilter:setSortOrder(hs.window.filter.sortByCreated)
wmAppFilter:setAppFilter('Hammerspoon', false)

--
wmAppSwitcher = hs.window.switcher.new(wmAppFilter, {
    showTitles = false,
    showThumbnails = false,
    showSelectedThumbnail = false
})

xApps = {
    'Activity Monitor',
    'Finder',
    'FortiClient',
    'Hammerspoon',
    'System Preferences',
    'loginwindow',
}

function isNotChange(appName)
    for i=1, #xApps do
        if appName == xApps[i] then
            return true
        end
    end
    local win = hs.window.focusedWindow()
    if win == nil then return true end
    if win:title() == '' then
        return true
    end
    if win:title() == 'Open' then
        return true
    end
    return false
end

wmAppManager = hs.application.watcher.new(function(appName, eType)
    if isNotChange(appName) then
        return
    end
    if eType == hs.application.watcher.activated then
        local win = hs.window.focusedWindow()
        if wmMode == 0 then
            toFull()
        end
    end
end):start()

function toFull()
    local scFrame = hs.screen.mainScreen():frame()
    local win = hs.window.focusedWindow()
    local width = scFrame.w - wmOffset.left - wmOffset.right
    local heigth = scFrame.h - wmOffset.top - wmOffset.bottom
    win:setFrameInScreenBounds(hs.geometry.rect(
        wmOffset.left,
        wmOffset.top,
        width,
        heigth
    ))
    local f = win:frame()
    if f.w < width or f.h < heigth then
        win:centerOnScreen()
    end
end

function toWest()
    wmMode = 1
    local scFrame = hs.screen.mainScreen():frame()
    local win = hs.window.focusedWindow()
    win:setFrameInScreenBounds(hs.geometry.rect(
        wmOffset.left,
        wmOffset.top,
        scFrame.w/2 - wmOffset.left - wmOffset.gap/2,
        scFrame.h - wmOffset.top - wmOffset.bottom
    ))
end

function toEast()
    wmMode = 1
    local scFrame = hs.screen.mainScreen():frame()
    local win = hs.window.focusedWindow()
    win:setFrameInScreenBounds(hs.geometry.rect(
        scFrame.w/2 + wmOffset.gap/2,
        wmOffset.top,
        scFrame.w/2 - wmOffset.right - wmOffset.gap/2,
        scFrame.h - wmOffset.top - wmOffset.bottom
    ))
end

function toCenter()
    local win = hs.window.focusedWindow()
    if win ~= nil then
        win:centerOnScreen()
    end
end

-- keybind
-- mode
hs.hotkey.bind({'ctrl', 'alt'}, 'A', function()
    wmMode = 0
    toFull()
end)
hs.hotkey.bind({'ctrl', 'alt'}, 'S', function()
    wmMode = 1
end)
-- move
hs.hotkey.bind({'ctrl', 'alt'}, 'C', toCenter)
-- switch
hs.hotkey.bind({'alt'}, 'L', function() wmAppSwitcher:next() end)
hs.hotkey.bind({'alt'}, 'H', function() wmAppSwitcher:previous() end)
-- wrap
hs.hotkey.bind({'ctrl', 'alt'}, 'H', function() toWest() end)
hs.hotkey.bind({'ctrl', 'alt'}, 'L', function() toEast() end)
