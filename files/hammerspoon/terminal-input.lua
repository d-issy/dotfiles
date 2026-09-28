local hiraganaSourceID = "jp.sourceforge.inputmethod.aquaskk.Hiragana"

local kanaHotkey = hs.hotkey.new({ "ctrl" }, "j", function()
  if hs.keycodes.currentSourceID() ~= hiraganaSourceID then
    if not hs.keycodes.currentSourceID(hiraganaSourceID) then
      hs.alert.show "AquaSKK hiragana input source is unavailable"
    end
  end
end)

local function updateHotkey(app)
  if Helper.isTerminalApp(app) then
    kanaHotkey:enable()
  else
    kanaHotkey:disable()
  end
end

TerminalInputWatcher = hs.application.watcher
  .new(function(_, event, app)
    if event == hs.application.watcher.activated then
      updateHotkey(app)
    end
  end)
  :start()

updateHotkey(hs.application.frontmostApplication())
