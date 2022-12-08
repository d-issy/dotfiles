local helper = require('helper')
hs.hotkey.bind({ 'alt' }, 'T', function()
  hs.alert.closeAll()
  hs.alert.show(os.date('%Y-%m-%d %H:%M'))

  local app = hs.application.frontmostApplication()
  hs.alert.show(app:bundleID())
end)
