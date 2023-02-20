hs.alert.show("hammerspoon config loaded", {
  strokeWidth = 0,
  textSize = 27,
  radius = 0,
  atScreenEdge = 2,
  fadeInDuration = 0.15,
  fadeOutDuration = 0.15,
  padding = nil,
})

AutoReloader = hs.pathwatcher.new(os.getenv "HOME" .. "/.hammerspoon/", hs.reload):start()

require "helper"
require "winmanager"
require "keybind"
