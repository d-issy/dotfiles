WinManager = (function()
  local MARGIN = 10
  local DIFF = 30

  hs.window.animationDuration = 0
  hs.grid.setMargins({ x = MARGIN, y = MARGIN })

  local M = { _ = {} }
  local currentWindow = function()
    return hs.window.frontmostWindow()
  end

  local moveGrid = function(win, rect)
    rect = rect or {}
    hs.grid.setGrid(string.format('%dx%d', rect.w or 1, rect.h or 1))
    if win == nil then
      win = currentWindow()
    end
    hs.grid.set(win, { x = (rect.x or 1) - 1, y = (rect.y or 1) - 1, w = 1, h = 1 })
  end

  local findApplication = function(app)
    if hs.fnutils.contains({ 'string', 'number' }, type(app)) then
      app = hs.application.find(app)
    elseif app == nil then
      app = hs.application.open(app)
    end
    return app
  end

  local mainWindow = function(app)
    local win = app:mainWindow()
    if win == nil then
      local wins = app:allWindows()
      if #wins >= 1 then win = wins[1] end
    end
    return win
  end


  local setWindowPositionDiff = function(win, pos)
    local screen = win:screen():frame()
    local f = win:frame()

    win:setTopLeft({
      x = Helper.clamp(
        f.x + (pos.x or 0),
        MARGIN,
        screen.w - f.w - MARGIN
      ),
      y = Helper.clamp(
        f.y + (pos.y or 0),
        MARGIN + screen.y,
        screen.h - f.h - MARGIN + screen.y
      )
    })
  end

  M._.arangeMode = hs.eventtap.new({ hs.eventtap.event.types.keyDown }, function(event)
    local quit = true
    local key = hs.keycodes.map[event:getKeyCode()]
    local win = currentWindow()

    local fn = ({
      a = function() M.moveFull() end,
      h = function()
        setWindowPositionDiff(win, { x = -DIFF })
        quit = false
      end,
      j = function()
        setWindowPositionDiff(win, { y = DIFF })
        quit = false
      end,
      k = function()
        setWindowPositionDiff(win, { y = -DIFF })
        quit = false
      end,
      l = function()
        setWindowPositionDiff(win, { x = DIFF })
        quit = false
      end,
      H = function()
        setWindowPositionDiff(win, { x = -DIFF })
        quit = false
      end,
      J = function()
        setWindowPositionDiff(win, { y = DIFF })
        quit = false
      end,
      K = function()
        setWindowPositionDiff(win, { y = -DIFF })
        quit = false
      end,
      L = function()
        setWindowPositionDiff(win, { x = DIFF })
        quit = false
      end,
    })[key]
    if fn then fn() end

    if quit then M._.arangeMode:stop() end
    return true
  end)

  M.arrangeMode = function()
    if not M._.arangeMode:isEnabled() then
      M._.arangeMode:start()
      hs.alert.show('ArrangeMode')
    end
  end

  M.moveLeft = function(win) moveGrid(win, { w = 2, x = 1 }) end
  M.moveRight = function(win) moveGrid(win, { w = 2, x = 2 }) end
  M.moveFull = function(win) moveGrid(win) end
  M.toggleZoom = function() currentWindow():toggleZoom() end
  M.toggleFullScreen = function() currentWindow():toggleFullScreen() end

  M.focusApplication = function(app)
    app = findApplication(app)
    if app == nil then return end
    local win = mainWindow(app)
    if win == nil then return end
    if win:isMinimized() then
      win:unminimize()
    end
    win:focus()
  end
  return M
end)()
