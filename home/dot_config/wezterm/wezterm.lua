local wezterm = require "wezterm"

local config = {}

if wezterm.config_builder then
  config = wezterm.config_builder()
end

config.color_scheme = "Catppuccin Macchiato"
config.font = wezterm.font_with_fallback {
  "0xProto",
  "UDEV Gothic 35",
  "Cica",
  "Hack Nerd Font Mono",
  "YuGothic",
}
config.warn_about_missing_glyphs = false
config.harfbuzz_features = { "calt=1", "clig=1", "liga=1" } -- ligatures

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
