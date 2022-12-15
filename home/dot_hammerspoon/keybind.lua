local helper = require('helper')
local eventtap = hs.eventtap
local eventTypes = eventtap.event.types
local codes = hs.keycodes.map

-- define key bindings
CustomBindings = {
  ['home'] = { { 'ctrl' }, 'left' },
  ['end'] = { { 'ctrl' }, 'right' },
}

CustomCtrlKeyBindings = {
  tab = false,
  j = false,
  w = { { 'alt' }, 'delete' },
  p = { {}, 'up' },
  n = { {}, 'down' },
}

local fallback = true
KeyBindEvent = hs.eventtap.new({
  eventTypes.flagChanged,
  eventTypes.keyDown,
  eventTypes.keyUp,
}, function(event)
  local flags = event:getFlags()
  local keyCode = event:getKeyCode()
  local key = codes[keyCode]

  if event:getType() == eventTypes.keyDown then
    if not fallback then
      fallback = true
      return false
    end
    if not flags.ctrl then
      -- without ctrl
      if CustomBindings[key] ~= nil then
        local bind = CustomBindings[key]
        if not bind then return false end
        local mods = bind[1]
        for mod, _ in pairs(flags) do table.insert(mods, mod) end
        eventtap.keyStroke(mods, bind[2], 0)
        fallback = false
        return true
      end
    else
      -- ctrl
      if CustomCtrlKeyBindings[key] ~= nil then
        if event:getType() == eventTypes.keyDown then
          local bind = CustomCtrlKeyBindings[key]
          if not bind then return false end
          eventtap.keyStroke(bind[1], bind[2], 0)
        end
        return true
      else
        flags.cmd = true
        flags.ctrl = nil
        event:setFlags(flags)
        return false
      end
    end
  end
  return false
end)

AppWatcher = hs.window.filter.new(true)
AppWatcher:subscribe({ hs.window.filter.windowFocused }, function(_, app)
  if helper.isTerminalApp(app) then
    KeyBindEvent:stop()
  else
    KeyBindEvent:start()
  end
end)

--- reload
hs.hotkey.bind({ 'cmd', 'alt', 'ctrl' }, 'R', function()
  hs.reload()
end)
