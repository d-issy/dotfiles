local obj = {}

local terms = {
  'com.apple.Terminal',
  'com.googlecode.iterm2',
  'com.jetbrains.intellij',
  'com.microsoft.VSCode',
  'com.parallels.desktop.console',
  'com.github.wez.wezterm',
  'org.alacritty',
}

obj.isTerm = function(app)
  if type(app) == 'string' then
    app = hs.application.find(app)
    if app == nil then
      return false
    end
  end
  for _, t in ipairs(terms) do
    if app:bundleID() == t then
      return true
    end
  end
  return false
end

return obj
