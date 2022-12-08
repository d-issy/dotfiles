local helper = require('helper')

-- str keymap
keyCodes = hs.hotkey.modal.new(nil)

function keyCodes:newMap(mods, key, fn)
  self:bind(mods, key, fn, nil, fn)
end

keyCodes:newMap({ 'ctrl' }, 'W', function()
  hs.eventtap.keyStroke({ 'alt' }, 'Delete', 0)
end)

keyCodes:newMap({ 'ctrl' }, 'N', function()
  hs.eventtap.keyStroke({}, 'Down', 0)
end)

keyCodes:newMap({ 'ctrl' }, 'P', function()
  hs.eventtap.keyStroke({}, 'Up', 0)
end)

keyCodes:newMap({ 'ctrl' }, 'H', function()
  hs.eventtap.keyStroke({}, 'Left', 0)
end)

keyCodes:newMap({ 'ctrl' }, 'L', function()
  hs.eventtap.keyStroke({}, 'Right', 0)
end)

-- hotkey toggle by application
appWatcher = hs.window.filter.new(true)

appWatcher:subscribe({ hs.window.filter.windowFocused }, function(win, app)
  if helper.isTerm(app) then
    keyCodes:exit()
  else
    keyCodes:enter()
  end
end)

--- reload
hs.hotkey.bind({ 'cmd', 'alt', 'ctrl' }, 'R', function()
  hs.reload()
end)
