-- wmMode 0 single window mode
-- wmMode 1 tile window mode
wmMode = 0

-- wmOffset
wmOffset = {top=13, bottom=30, left=7, right=7, gap=15}

--
wmApps = {}

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

function isNotChange(appName, win)
    if appName == 'Hammerspoon' then
        return true
    end
    if appName == 'Finder' then
        return true
    end
    if appName == 'System Preferences' then
        return true
    end
    if win == nil then
        return true
    end
    if win:title() == 'Open' then
        return true
    end
    return false
end

wmAppManager = hs.application.watcher.new(function(appName, eType, app)
    local win = hs.window.focusedWindow()
    if isNotChange(appName, win) then
        return
    end
    if eType == hs.application.watcher.activated then
        -- hs.alert.show('activated')
        if wmMode == 0 then
            toFull()
        end
    end
    if eType == hs.application.watcher.deactivated then
        -- hs.alert.show('deactivated')
    end
    if eType == hs.application.watcher.hidden then
        -- hs.alert.show('hidden')
    end
    if eType == hs.application.watcher.launching then
        -- hs.alert.show('launching')
    end
    if eType == hs.application.watcher.launched then
        -- hs.alert.show('launched')
    end
    if eType == hs.application.watcher.terminated then
        -- hs.alert.show('terminated')
    end
    if eType == hs.application.watcher.unhidden then
        -- hs.alert.show('unhidden')
    end
    -- hs.alert.show(appName)
    -- hs.alert.show(app:mainWindow():title())
end):start()

function toFull()
    local scFrame = hs.screen.mainScreen():frame()
    local win = hs.window.focusedWindow()
    win:setFrameInScreenBounds(hs.geometry.rect(
        wmOffset.left,
        wmOffset.top,
        scFrame.w - wmOffset.left - wmOffset.right,
        scFrame.h - wmOffset.top  - wmOffset.bottom
    ), 0)
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
    ), 0)
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
    ), 0)
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
hs.hotkey.bind({'alt'}, 'L', function() wmAppSwitcher:next() end)
hs.hotkey.bind({'alt'}, 'H', function() wmAppSwitcher:previous() end)
-- wrap
hs.hotkey.bind({'ctrl', 'alt'}, 'H', function() toWest() end)
hs.hotkey.bind({'ctrl', 'alt'}, 'L', function() toEast() end)
