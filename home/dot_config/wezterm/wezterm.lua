local wezterm = require "wezterm"

local config = {}

config.color_scheme = "Catppuccin Macchiato"
config.font = wezterm.font_with_fallback { "Hack Nerd Font Mono", "Hiragino Mincho Pro W3" }
config.font_size = 14
config.hide_tab_bar_if_only_one_tab = true
config.adjust_window_size_when_changing_font_size = false
config.use_ime = true
config.macos_forward_to_ime_modifier_mask = "SHIFT|CTRL"
config.keys = {
  { key = "q", mods = "CTRL", action = wezterm.action.SendKey { key = "q", mods = "CTRL" } },
  { key = "u", mods = "CMD", action = wezterm.action.EmitEvent "toggle-opacity" },
}

local wsl_domains = wezterm.default_wsl_domains()
if #wsl_domains > 0 then
  config.default_domain = wsl_domains[1].name
end

wezterm.on("toggle-opacity", function(window, pane)
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

return config
