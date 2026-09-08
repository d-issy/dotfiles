WinManager = (function()
  local MARGIN = 10
  local SCALE = 0.125

  hs.window.animationDuration = 0
  hs.grid.setMargins { x = MARGIN, y = MARGIN }

  hs.window.highlight.ui.overlay = true
  hs.window.highlight.ui.flushDuration = 1
  hs.window.highlight.ui.frameWidth = 5
  hs.window.highlight.ui.frameColor = { 0, 1.0, 0, 0.5 }

  local M = { _ = {} }
  local currentWindow = function()
    return hs.window.frontmostWindow()
  end

  local moveGrid = function(win, rect)
    rect = rect or {}
    win = win or currentWindow()
    if not win then
      return
    end
    local screen = win:screen():frame()
    local width = screen.w / (rect.w or 1)
    local height = screen.h / (rect.h or 1)
    local frame = {
      x = screen.x + width * ((rect.x or 1) - 1) + MARGIN,
      y = screen.y + height * ((rect.y or 1) - 1) + MARGIN,
      w = width - MARGIN * 2,
      h = height - MARGIN * 2,
    }
    -- Enhanced accessibility can prevent apps from accepting frame changes.
    local appElement = hs.axuielement.applicationElement(win:application())
    local enhanced = appElement:attributeValue "AXEnhancedUserInterface"
    if enhanced == true then
      appElement:setAttributeValue("AXEnhancedUserInterface", false)
    end
    local ok, err = pcall(function()
      win:setFrameWithWorkarounds(frame, 0)
    end)
    if enhanced == true then
      appElement:setAttributeValue("AXEnhancedUserInterface", true)
    end
    if not ok then
      error(err)
    end
  end

  local findApplication = function(app)
    if hs.fnutils.contains({ "string", "number" }, type(app)) then
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
      if #wins >= 1 then
        win = wins[1]
      end
    end
    return win
  end

  local setWindowPositionDiff = function(win, diff)
    if not win then
      return
    end
    local screen = win:screen():frame()
    local f = win:frame()
    local block = { x = (diff.x or 0) * screen.w, y = (diff.y or 0) * screen.h }
    diff = {
      x = Helper.clamp(f.x + block.x, screen.x + MARGIN, screen.x + screen.w - f.w - MARGIN),
      y = Helper.clamp(f.y + block.y, MARGIN + screen.y, screen.h - f.h - MARGIN + screen.y),
    }
    win:setTopLeft(diff)
  end

  local setWindowSizeDiff = function(win, diff)
    if not win then
      return
    end
    local screen = win:screen():frame()
    local f = win:frame()
    local block = { w = (diff.w or 0) * screen.w, h = (diff.h or 0) * screen.h }
    local frame = {
      w = Helper.clamp(f.w + block.w, 200, screen.w - MARGIN * 2),
      h = Helper.clamp(f.h + block.h, 200, screen.h - MARGIN * 2),
    }
    frame.x = Helper.clamp(f.x, screen.x + MARGIN, screen.x + screen.w - (frame.w + MARGIN))
    frame.y = Helper.clamp(f.y, MARGIN + screen.y, screen.h - (frame.h + MARGIN) + screen.y)
    win:setFrameWithWorkarounds(frame)
  end

  -- Accessibility queries happen on window events, never while navigating the list.
  local windowCache, iconCache = {}, {}
  local filter = hs.window.filter
  M._.windowFilter = filter.new():setDefaultFilter {}
  local cacheWindow = function(win)
    local id = win:id()
    if not id then
      return
    end
    if not win:isStandard() then
      windowCache[id] = nil
      return
    end
    local app, screen = win:application(), win:screen()
    local bundle = app and app:bundleID()
    if bundle and iconCache[bundle] == nil then
      iconCache[bundle] = hs.image.imageFromAppBundle(bundle) or false
    end
    windowCache[id] = {
      id = id,
      window = win,
      appName = app and app:name() or "",
      title = (win:title() or ""):gsub("[\r\n]", " "),
      detail = (app and app:name() or "不明なアプリ")
        .. "  ·  "
        .. (screen and screen:name() or "")
        .. (win:isMinimized() and "  ·  最小化" or ""),
      icon = bundle and iconCache[bundle] or nil,
    }
  end
  M._.windowFilter:subscribe({
    filter.windowAllowed,
    filter.windowTitleChanged,
    filter.windowMinimized,
    filter.windowUnminimized,
    filter.windowMoved,
  }, cacheWindow)
  M._.windowFilter:subscribe(filter.windowRejected, function(win)
    local id = win:id()
    if id then
      windowCache[id] = nil
    end
  end)
  for _, win in ipairs(M._.windowFilter:getWindows()) do
    cacheWindow(win)
  end

  local displayKeys = {}
  local windowKeys = "asdfghlwer"
  local state, choices, page, selected = "arrange", {}, 1, 1
  local overlays = {}
  local choiceKeys = {}
  local targetWindow, panelScreen
  local render, selectChoice, openSection
  local ink = { white = 0.95 }
  local muted = { white = 0.65 }

  local clearOverlays = function()
    for _, canvas in ipairs(overlays) do
      canvas:delete()
    end
    overlays = {}
  end

  local stopArrangeMode = function()
    M._.arrangeMode:stop()
    clearOverlays()
    choices = {}
    targetWindow = nil
  end

  local text = function(canvas, value, x, y, w, h, size, color)
    canvas:appendElements {
      type = "text",
      text = value,
      textSize = size or 18,
      textColor = color or ink,
      textFont = ".AppleSystemUIFont",
      textLineBreak = "truncateTail",
      frame = { x = x, y = y, w = w, h = h },
    }
  end

  local panel = function(screen, width, height, title, subtitle)
    local f = screen:frame()
    width, height = math.min(width, f.w - 32), math.min(height, f.h - 32)
    local canvas = hs.canvas.new { x = f.x + (f.w - width) / 2, y = f.y + (f.h - height) / 2, w = width, h = height }
    canvas:level(hs.canvas.windowLevels.overlay)
    canvas:appendElements {
      type = "rectangle",
      action = "fill",
      fillColor = { white = 0.09, alpha = 0.98 },
      roundedRectRadii = { xRadius = 16, yRadius = 16 },
      frame = { x = 0, y = 0, w = width, h = height },
    }
    text(canvas, title, 24, 20, width - 48, 32, 24)
    text(canvas, subtitle, 24, 58, width - 48, 24, 13, muted)
    table.insert(overlays, canvas)
    return canvas, width, height
  end

  local button = function(canvas, id, y, width, label, detail, key, active, icon)
    canvas:appendElements {
      type = "rectangle",
      id = id,
      action = "fill",
      trackMouseUp = true,
      fillColor = active and { red = 0.18, green = 0.32, blue = 0.5 } or { white = 0.15 },
      roundedRectRadii = { xRadius = 8, yRadius = 8 },
      frame = { x = 16, y = y, w = width - 32, h = 62 },
    }
    text(canvas, key, 30, y + 17, 30, 30, 22)
    local x = 76
    if icon then
      canvas:appendElements { type = "image", image = icon, frame = { x = 72, y = y + 13, w = 36, h = 36 } }
      x = 120
    end
    text(canvas, label, x, y + 7, width - x - 32, 25, 17)
    text(canvas, detail, x, y + 33, width - x - 32, 22, 13, muted)
  end

  local pageSize = function()
    return math.max(1, math.min(#windowKeys, math.floor((panelScreen:frame().h - 180) / 68)))
  end

  render = function()
    clearOverlays()
    if state == "screens" then
      displayKeys = {}
      local labels = {}
      local available = "asdfghjklwertyuiopzxcvbnm1234567890"
      for i, screen in ipairs(choices) do
        if screen == hs.screen.primaryScreen() then
          labels[i], displayKeys.m = "m", i
          break
        end
      end
      for i, screen in ipairs(choices) do
        local initial = screen:name():sub(1, 1):lower()
        if not labels[i] and initial ~= "" and available:find(initial, 1, true) and not displayKeys[initial] then
          labels[i], displayKeys[initial] = initial, i
        end
      end
      for i in ipairs(choices) do
        if not labels[i] then
          for key in available:gmatch "." do
            if not displayKeys[key] then
              labels[i], displayKeys[key] = key, i
              break
            end
          end
        end
      end
      for i, screen in ipairs(choices) do
        local current = targetWindow and targetWindow:screen() == screen
        local canvas, width =
          panel(screen, 420, 210, "移動先の画面", "文字で選択 / クリック　 •　 q：閉じる")
        button(
          canvas,
          "screen",
          98,
          width,
          screen:name(),
          current and "現在の画面" or "この画面へウィンドウを移動",
          labels[i] or "クリック",
          false
        )
        canvas:mouseCallback(function(_, event, id)
          if event == "mouseUp" and id == "screen" then
            selectChoice(i)
          end
        end)
        canvas:show()
      end
      return
    end
    if state == "windows" then
      local count = pageSize()
      local pages = math.max(1, math.ceil(#choices / count))
      page = math.max(1, math.min(page, pages))
      local first = (page - 1) * count + 1
      local rows = math.min(count, #choices - first + 1)
      choiceKeys = {}
      local labels = {}
      local available = "asdfghlwertyuiopzxcvbnm"
      -- Reserve initials first so fallback keys cannot steal another app's initial.
      for i = first, first + rows - 1 do
        local initial = choices[i].appName:sub(1, 1):lower()
        if initial ~= "" and available:find(initial, 1, true) and not choiceKeys[initial] then
          labels[i], choiceKeys[initial] = initial, i
        end
      end
      for i = first, first + rows - 1 do
        if not labels[i] then
          for key in available:gmatch "." do
            if not choiceKeys[key] then
              labels[i], choiceKeys[key] = key, i
              break
            end
          end
        end
      end
      local canvas, width = panel(
        panelScreen,
        760,
        144 + math.max(1, rows) * 68,
        "ウィンドウ切替",
        "文字 / j・k・↑↓ + Enter / クリック　 •　 q：閉じる"
      )
      if #choices == 0 then
        text(canvas, "選択できるウィンドウがありません", 24, 108, width - 48, 30)
      end
      for i = first, first + rows - 1 do
        local entry = choices[i]
        local title = entry.title
        button(
          canvas,
          tostring(i),
          96 + (i - first) * 68,
          width,
          title ~= "" and title or "（タイトルなし）",
          entry.detail,
          labels[i],
          i == selected,
          entry.icon or nil
        )
      end
      text(
        canvas,
        string.format(
          "%d ウィンドウ    •    %d / %d ページ    •    ← →：ページ切替",
          #choices,
          page,
          pages
        ),
        24,
        106 + math.max(1, rows) * 68,
        width - 48,
        24,
        13,
        muted
      )
      canvas:mouseCallback(function(_, event, id)
        if event == "mouseUp" and tonumber(id) then
          selectChoice(tonumber(id))
        end
      end)
      canvas:show()
      return
    end
    local adjusting = state == "adjust"
    local canvas, width = panel(
      panelScreen,
      560,
      adjusting and 240 or 350,
      adjusting and "位置・サイズの調整" or "ウィンドウ操作",
      "q：閉じる　 •　 操作を選ぶと次の画面へ"
    )
    if adjusting then
      text(canvas, "h ←    j ↓    k ↑    l →", 28, 104, width - 56, 36, 24)
      text(canvas, "Shift を押しながら：サイズ変更", 28, 150, width - 56, 28, 18)
      text(canvas, "q で現在の配置を確定して終了", 28, 192, width - 56, 24, 14, muted)
    else
      button(
        canvas,
        "d",
        96,
        width,
        "画面へ移動",
        targetWindow and "各画面に表示される文字で選択"
          or "操作対象のウィンドウがありません",
        "d",
        false
      )
      button(
        canvas,
        "w",
        166,
        width,
        "ウィンドウ切替",
        "隠れているウィンドウも一覧から選択",
        "w",
        false
      )
      button(
        canvas,
        "m",
        236,
        width,
        "位置・サイズを調整",
        "hjkl で移動 / Shift でサイズ変更",
        "m",
        false
      )
      text(canvas, "a：最大化    c：中央配置", 24, 311, width - 48, 24, 13, muted)
      canvas:mouseCallback(function(_, event, id)
        if event == "mouseUp" and (id == "d" or id == "w" or id == "m") then
          openSection(id)
        end
      end)
    end
    canvas:show()
  end

  selectChoice = function(index)
    local choice = choices[index]
    if not choice then
      return
    end
    local win, selectingScreen = targetWindow, state == "screens"
    stopArrangeMode()
    if selectingScreen then
      if win and win:screen() then
        local old, f = win:screen():frame(), win:frame()
        local full = math.abs(f.x - old.x - MARGIN) < 3
          and math.abs(f.y - old.y - MARGIN) < 3
          and math.abs(f.w - old.w + MARGIN * 2) < 3
          and math.abs(f.h - old.h + MARGIN * 2) < 3
        win:moveToScreen(choice, false, true, 0)
        if full then
          M.moveFull(win)
        end
      end
    elseif windowCache[choice.id] and choice.window:application() then
      choice = choice.window
      if choice:isMinimized() then
        choice:unminimize()
      end
      choice:application():unhide()
      choice:focus()
    end
  end

  openSection = function(key)
    if key == "d" then
      if not targetWindow then
        return
      end
      state, choices = "screens", hs.screen.allScreens()
      table.sort(choices, function(a, b)
        return a:getUUID() < b:getUUID()
      end)
    elseif key == "w" then
      state, choices, page, selected = "windows", {}, 1, 1
      for _, entry in pairs(windowCache) do
        table.insert(choices, entry)
      end
      table.sort(choices, function(a, b)
        return a.id < b.id
      end)
    elseif key == "m" then
      state = "adjust"
    end
    render()
  end

  M._.arrangeMode = hs.eventtap.new({ hs.eventtap.event.types.keyDown }, function(event)
    local key = hs.keycodes.map[event:getKeyCode()]
    if not key then
      return true
    end
    if key == "q" or key == "escape" then
      stopArrangeMode()
      return true
    end
    if state == "windows" or state == "screens" then
      if state == "windows" then
        local count = pageSize()
        if key == "up" or key == "down" or key == "j" or key == "k" then
          local previous, previousPage = selected, page
          selected = math.max(1, math.min(#choices, selected + ((key == "down" or key == "j") and 1 or -1)))
          page = math.floor((selected - 1) / count) + 1
          if page ~= previousPage then
            render()
          elseif #choices > 0 and previous ~= selected then
            local canvas = overlays[1]
            canvas[tostring(previous)].fillColor = { white = 0.15 }
            canvas[tostring(selected)].fillColor = { red = 0.18, green = 0.32, blue = 0.5 }
          end
          return true
        elseif key == "left" or key == "right" then
          page = math.max(1, math.min(math.max(1, math.ceil(#choices / count)), page + (key == "right" and 1 or -1)))
          selected = (page - 1) * count + 1
          render()
          return true
        elseif key == "return" then
          selectChoice(selected)
          return true
        end
      end
      if state == "windows" then
        if choiceKeys[key] then
          selectChoice(choiceKeys[key])
        end
      else
        local index = displayKeys[key]
        if index then
          selectChoice(index)
        end
      end
      return true
    end
    if key == "d" or key == "w" or key == "m" then
      openSection(key)
      return true
    end
    if event:getFlags().shift then
      key = string.upper(key)
    end
    local positions = { h = { x = -SCALE }, j = { y = SCALE }, k = { y = -SCALE }, l = { x = SCALE } }
    local sizes = { H = { w = -SCALE }, J = { h = SCALE }, K = { h = -SCALE }, L = { w = SCALE } }
    if positions[key] or sizes[key] then
      if state ~= "adjust" then
        state = "adjust"
        render()
      end
      if positions[key] then
        setWindowPositionDiff(targetWindow, positions[key])
      else
        setWindowSizeDiff(targetWindow, sizes[key])
      end
    elseif key == "a" or key == "c" then
      local win = targetWindow
      stopArrangeMode()
      if win then
        if key == "a" then
          M.moveFull(win)
        else
          M.moveCenter(win)
        end
      end
    end
    return true
  end)

  M.arrangeMode = function()
    if M._.arrangeMode:isEnabled() then
      stopArrangeMode()
      return
    end
    targetWindow, panelScreen = currentWindow(), hs.screen.mainScreen()
    state = "arrange"
    render()
    M._.arrangeMode:start()
  end

  local openDirect = function(section)
    stopArrangeMode()
    targetWindow, panelScreen = currentWindow(), hs.screen.mainScreen()
    if section ~= "w" and not targetWindow then
      return
    end
    openSection(section)
    M._.arrangeMode:start()
  end

  M.switchWindow = function()
    openDirect "w"
  end
  M.selectDisplay = function()
    openDirect "d"
  end
  M.adjustWindow = function()
    openDirect "m"
  end

  M.moveLeft = function(win)
    moveGrid(win, { w = 2, x = 1 })
  end
  M.moveRight = function(win)
    moveGrid(win, { w = 2, x = 2 })
  end
  M.moveFull = function(win)
    moveGrid(win)
  end
  M.moveCenter = function(win)
    win = win or currentWindow()
    if win and win:screen() then
      local screen = win:screen():frame()
      local frame = win:frame()
      frame.x = screen.x + (screen.w - frame.w) / 2
      frame.y = screen.y + (screen.h - frame.h) / 2
      win:setFrameWithWorkarounds(frame, 0)
    end
  end
  M.toggleZoom = function()
    local win = currentWindow()
    if win then
      win:toggleZoom()
    end
  end
  M.toggleFullScreen = function()
    local win = currentWindow()
    if win then
      win:toggleFullScreen()
    end
  end

  M.focusApplication = function(app)
    local fn = function()
      app = findApplication(app)
      if app == nil then
        return
      end
      local win = mainWindow(app)
      if win == nil then
        return
      end
      if win:isMinimized() then
        win:unminimize()
      end
      win:focus()
    end
    return fn
  end
  return M
end)()
