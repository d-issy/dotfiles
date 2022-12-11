local helper = require('helper')
local eventtap = hs.eventtap
local eventTypes = eventtap.event.types
local codes = hs.keycodes.map

-- define key bindings
CustomCtrlKeyBindings = {
  w = { { 'alt' }, 'delete' },
  p = { {}, 'up' },
  n = { {}, 'down' },
}

KeyBindEvent = hs.eventtap.new({
  eventTypes.flagChanged,
  eventTypes.keyDown,
  eventTypes.keyUp,
}, function(event)

  local flags = event:getFlags()
  local keyCode = event:getKeyCode()
  local key = codes[keyCode]

  -- ignore if pressing any key other than ctrl
  if flags.shift or flags.cmd or flags.alt then return false end
  if not flags.ctrl then return false end

  -- for skk on 'Ctrl+J'
  if codes[keyCode] == 'j' then return false end

  -- custom keybinds fallback
  if CustomCtrlKeyBindings[key] ~= nil then
    if event:getType() == eventTypes.keyDown then
      local bind = CustomCtrlKeyBindings[key]
      eventtap.keyStroke(bind[1], bind[2], 0)
    end
    return true
  end

  -- replace ctrl with cmd
  flags.cmd = true
  flags.ctrl = nil
  event:setFlags(flags)

  return false
end)

AppWatcher = hs.window.filter.new(true)
AppWatcher:subscribe({ hs.window.filter.windowFocused }, function(_, app)
  if helper.isTerm(app) then
    KeyBindEvent:stop()
  else
    KeyBindEvent:start()
  end
end)

--- reload
hs.hotkey.bind({ 'cmd', 'alt', 'ctrl' }, 'R', function()
  hs.alert.show('reload hammerspoon config')
  hs.timer.usleep(1000000)
  hs.reload()
end)
