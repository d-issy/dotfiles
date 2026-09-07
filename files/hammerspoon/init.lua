AutoReloader = hs.pathwatcher.new(os.getenv "HOME" .. "/.hammerspoon/", hs.reload):start()

require "helper"
require "winmanager"
require "keybind"

local screen = hs.screen.mainScreen():frame()
local width, height, margin = 150, 32, 16
LoadedNotification = hs.canvas.new {
  x = screen.x + screen.w - width - margin,
  y = screen.y + screen.h - height - margin,
  w = width,
  h = height,
}
LoadedNotification:level(hs.canvas.windowLevels.overlay)
LoadedNotification:appendElements({
  type = "rectangle",
  action = "fill",
  fillColor = { white = 0.1, alpha = 0.7 },
  roundedRectRadii = { xRadius = 6, yRadius = 6 },
}, {
  type = "text",
  text = "Hammerspoon loaded",
  textSize = 12,
  textColor = { white = 0.8, alpha = 1 },
  textAlignment = "center",
  frame = { x = 8, y = 8, w = width - 16, h = height - 16 },
})
LoadedNotification:show(0.1)
LoadedNotificationTimer = hs.timer.doAfter(0.8, function()
  LoadedNotification:delete(0.2)
  LoadedNotification = nil
  LoadedNotificationTimer = nil
end)
