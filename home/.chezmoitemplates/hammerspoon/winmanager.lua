WinManager = (function()
  local M = {}

  local margin = 10
  local diff = 30

  hs.window.animationDuration = 0
  hs.grid.setMargins({ x = margin, y = margin })

  M._ = {}

  local _currentWindow = function()
    return hs.window.frontmostWindow()
  end

  local _moveGrid = function(w, h, x, y, win)
    hs.grid.setGrid(string.format('%dx%d', w, h))
    if win == nil then
      win = _currentWindow()
    end
    hs.grid.set(win, { x = x - 1, y = y - 1, w = 1, h = 1 })
  end

  local _findApplication = function(app)
    if hs.fnutils.contains({ 'string', 'number' }, type(app)) then
      app = hs.application.find(app)
    elseif app == nil then
      app = hs.application.open(app)
    end
    return app
  end

  local _mainWindow = function(app)
    local win = app:mainWindow()
    if win == nil then
      local wins = app:allWindows()
      if #wins >= 1 then win = wins[1] end
    end
    return win
  end

  local _clamp = function(value, min, max)
    return math.min(math.max(value, min), max)
  end

  local _setWindowPositionDiff = function(win, pos)
    local screen = win:screen():frame()
    local f = win:frame()

    win:setTopLeft({
      x = _clamp(
        f.x + (pos.x or 0),
        margin,
        screen.w - f.w - margin
      ),
      y = _clamp(
        f.y + (pos.y or 0),
        screen.y + margin,
        screen.y + screen.h - f.h - margin
      )
    })
  end

  M.moveLeft = function(win) _moveGrid(2, 1, 1, 1, win) end
  M.moveRight = function(win) _moveGrid(2, 1, 2, 1, win) end
  M.moveFull = function(win) _moveGrid(1, 1, 1, 1, win) end
  M.toggleZoom = function() _currentWindow():toggleZoom() end
  M.toggleFullScreen = function() _currentWindow():toggleFullScreen() end

  M.focusApplication = function(app)
    app = _findApplication(app)
    if app == nil then return end
    local win = _mainWindow(app)
    if win == nil then return end
    if win:isMinimized() then
      win:unminimize()
    end
    win:focus()
  end

  M._._arrangeMode = hs.eventtap.new({ hs.eventtap.event.types.keyDown }, function(event)
    local quit = true
    local key = hs.keycodes.map[event:getKeyCode()]
    local win = _currentWindow()

    local fn = ({
      a = function() M.moveFull() end,
      h = function()
        _setWindowPositionDiff(win, { x = -diff })
        quit = false
      end,
      j = function()
        _setWindowPositionDiff(win, { y = diff })
        quit = false
      end,
      k = function()
        _setWindowPositionDiff(win, { y = -diff })
        quit = false
      end,
      l = function()
        _setWindowPositionDiff(win, { x = diff })
        quit = false
      end,
      H = function()
        _setWindowPositionDiff(win, { x = -diff })
        quit = false
      end,
      J = function()
        _setWindowPositionDiff(win, { y = diff })
        quit = false
      end,
      K = function()
        _setWindowPositionDiff(win, { y = -diff })
        quit = false
      end,
      L = function()
        _setWindowPositionDiff(win, { x = diff })
        quit = false
      end,
    })[key]
    if fn then fn() end

    if quit then M._._arrangeMode:stop() end
    return true
  end)

  M.arrangeMode = function()
    if not M._._arrangeMode:isEnabled() then
      M._._arrangeMode:start()
      hs.alert.show('ArrangeMode')
    end
  end

  return M
end)()
