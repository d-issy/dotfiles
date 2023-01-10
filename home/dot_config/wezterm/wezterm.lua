local wezterm = require 'wezterm'

wezterm.on('toggle-opacity', function(window, pane)
  local overrides = window:get_config_overrides() or {}
  if not overrides.window_background_opacity then
    overrides.window_background_opacity = 0.9
  else
    overrides.window_background_opacity = nil
  end

  if not overrides.text_background_opacity then
    overrides.text_background_opacity = 0.9
  else
    overrides.text_background_opacity = nil
  end

  window:set_config_overrides(overrides)
end)


return {
  -- apperance
  color_scheme = 'Edge Dark (base16)',
  font = wezterm.font_with_fallback {
    'Hack Nerd Font Mono',
    'Hiragino Mincho Pro W3',
  },

  font_size = 14,

  hide_tab_bar_if_only_one_tab = true,
  adjust_window_size_when_changing_font_size = false,

  -- key bindings
  use_ime = true,
  keys = {
    -- for tmux key binding for use-ime
    { key = 'q', mods = 'CTRL', action = wezterm.action.SendKey { key = 'q', mods = 'CTRL' } },
    { key = 'u', mods = 'CMD', action = wezterm.action.EmitEvent 'toggle-opacity' }
  }
}
