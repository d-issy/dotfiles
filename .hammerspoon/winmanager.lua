-- global settings
hs.window.animationDuration = 0
offset = {top=0, bottom=0, left=0, right=0, gap=1}

-- settings
hs.grid.MARGINX = 0
hs.grid.MARGINY = 0
hs.grid.HINTS = {
    {'f1', 'f2', 'f3', 'f4'},
    {'f5', 'f6', 'f7', 'f8'},
    {'E', 'R', 'U', 'I'},
    {'D', 'F', 'J', 'K'},
}
hs.grid.ui.showExtraKeys = false

-- helper
function showMsg(text)
    hs.alert.closeAll()
    hs.alert.show(text)
end

function setGrid(x, y)
    fstr = string.format('%dx%d', x, y)
    hs.grid.setGrid(fstr)
end

-- full
hs.hotkey.bind({'alt'}, 'A', function()
    hs.grid.maximizeWindow()
end)

-- left side
hs.hotkey.bind({'alt', 'ctrl'}, 'H', function()
    setGrid(2, 1)
    hs.grid.adjustWindow(function(cell)
        cell.x = 0
        cell.y = 0
        cell.w = 1
        cell.h = 1
    end)
end)

-- 2/3 left side
hs.hotkey.bind({'alt', 'ctrl'}, 'J', function()
    setGrid(3, 1)
    hs.grid.adjustWindow(function(cell)
        cell.x = 0
        cell.y = 0
        cell.w = 2
        cell.h = 1
    end)
end)

-- right side
hs.hotkey.bind({'alt', 'ctrl'}, 'L', function()
    setGrid(2, 1)
    hs.grid.adjustWindow(function(cell)
        cell.x = 1
        cell.y = 0
        cell.w = 1
        cell.h = 1
    end)
end)

-- 1/3 right side
hs.hotkey.bind({'alt', 'ctrl'}, 'K', function()
    setGrid(3, 1)
    hs.grid.adjustWindow(function(cell)
        cell.x = 2
        cell.y = 0
        cell.w = 1
        cell.h = 1
    end)
end)

-- chooser
hs.hotkey.bind({'alt'}, 'N', function()
    setGrid(3, 2)
    hs.grid.show()
end)

hs.hotkey.bind({'alt'}, 'M', function()
    setGrid(4, 2)
    hs.grid.show()
end)

-- center
hs.hotkey.bind({'alt'}, 'C', function()
    local win = hs.window.focusedWindow()
    if win == nil then return end
    win:centerOnScreen(nil, true)
end)

-- other window hide
hs.hotkey.bind({'cmd', 'alt'}, 'H', function()
    local c = hs.window.frontmostWindow()
    if c == nil then return end
    local cid = c:application():bundleID()
    local wins = c:otherWindowsSameScreen()
    for _, w in ipairs(wins) do
        local app = w:application()
        if cid ~= app:bundleID() then
            app:hide()
        end
    end
end)

-- chooser
hs.hotkey.bind({'alt'}, 'S', function()
    local winChooser = hs.chooser.new(function(item)
        local win = hs.window.get(item['uuid'])
        if win then win:focus() end
    end)
    local winFilter = hs.window.filter.new(function(win)
        if win == nil then return false end
        if win:subrole() == 'AXUnknown' then return false end
        return true
    end)
    winFilter:setCurrentSpace(true)
    local wins = winFilter:getWindows()
    local choices = {}
    for i, w in ipairs(wins) do
        choices[i] = {
            text = w:application():title(),
            subText = w:title(),
            uuid = w:id(),
        }
    end
    winChooser:searchSubText(true)
    winChooser:choices(choices)
    winChooser:show()
end)

---- switcher
function getWinInfo()
    local c = hs.window.focusedWindow()
    local cid = c and c:id() or nil
    local rs = {
        windows = {},
        current = c,
        currentID = cid,
    }
    local wins = hs.window.visibleWindows()
    table.sort(wins, function(a, b)
        return a:frame().x < b:frame().x
    end)
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

function showAlert(str)
    local win = hs.window.focusedWindow()
    local f = win:frame()
    if boxTimer ~= nil then boxTimer:fire() end
    box = hs.drawing.rectangle(hs.geometry.rect(f.x + f.w - 15, f.y + 5, 10, 10))
    box:setFillColor{red = 0.1, green = 0.3, blue = 0.7, alpha = 1.0}
    box:setStrokeWidth(0)
    box:show()
    boxTimer = hs.timer.doAfter(1.0, function()
        box:delete()
        box = nil
    end)
end

function focusLeftWindow()
    local w = getWinInfo()
    local idx
    if w.currentIdx == nil then idx = 1
    else
        idx = (w.currentIdx-2) % (#w.windows) + 1
    end
    w.windows[idx]:focus()
    showAlert()
end

function focusRightWindow()
    local w = getWinInfo()
    local idx
    if w.currentIdx == nil then idx = 1
    else
        idx =(w.currentIdx) % (#w.windows) + 1
    end
    w.windows[idx]:focus()
    showAlert()
end

function focusApp(appInfo)
    local app = hs.application.find(appInfo)
    if app == nil then
        hs.application.open(appInfo)
        return
    end
    local mainWin = app:mainWindow()
    if mainWin ~= nil then
        app:activate(true)
        return
    end
    local wins = app:allWindows()
    if #wins >= 1 then
        local w = wins[1]
        if w:isMinimized() then
            w:unminimize()
        end
        w:focus()
        w:becomeMain()
    end
end

-- bind
hs.hotkey.bind({'alt'}, 'H', focusLeftWindow)
hs.hotkey.bind({'alt'}, 'L', focusRightWindow)

--

hs.hotkey.bind({'alt'}, 'D', function() focusApp('com.kapeli.dashdoc') end)
hs.hotkey.bind({'alt'}, 'E', function() focusApp('com.googlecode.iterm2') end)
hs.hotkey.bind({'alt'}, 'F', function() focusApp('com.google.Chrome') end)
hs.hotkey.bind({'alt'}, 'I', function() focusApp('com.jetbrains.intellij') end)
hs.hotkey.bind({'alt'}, 'O', function() focusApp('com.tinyspeck.slackmacgap') end)
hs.hotkey.bind({'alt'}, 'U', function() focusApp('com.microsoft.VSCode') end)
