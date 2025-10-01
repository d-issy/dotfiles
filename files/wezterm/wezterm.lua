local wezterm = require "wezterm"
local act = wezterm.action

local config = {}

if wezterm.config_builder then
  config = wezterm.config_builder()
end

-- UI
local theme = "Catppuccin Macchiato"
local scheme = wezterm.get_builtin_color_schemes()[theme]
config.color_scheme = theme
config.color_schemes = { [theme] = scheme }

config.font_size = 14
config.adjust_window_size_when_changing_font_size = false
config.font = wezterm.font_with_fallback {
  "0xProto",
  "UDEV Gothic 35",
  "Cica",
  "Hack Nerd Font Mono",
  "YuGothic",
}
config.warn_about_missing_glyphs = false
config.harfbuzz_features = { "calt=1", "clig=1", "liga=1" } -- ligatures

-- config
config.hide_tab_bar_if_only_one_tab = true
config.use_ime = true
config.macos_forward_to_ime_modifier_mask = "SHIFT|CTRL"
config.audible_bell = "Disabled"

-- keybind
config.keys = {
  { key = "q", mods = "CTRL", action = wezterm.action.SendKey { key = "q", mods = "CTRL" } },
  { key = "u", mods = "CMD", action = wezterm.action.EmitEvent "toggle-opacity" },
  { key = "Enter", mods = "SHIFT", action = wezterm.action.SendString "\x1b\r" },
}

local wsl_domains = wezterm.default_wsl_domains()
if #wsl_domains > 0 then
  config.default_domain = wsl_domains[1].name
end

local opacity = 0.7
wezterm.on("toggle-opacity", function(window)
  local overrides = window:get_config_overrides() or {}
  if not overrides.window_background_opacity then
    overrides.window_background_opacity = opacity
  else
    overrides.window_background_opacity = nil
  end

  if not overrides.text_background_opacity then
    overrides.text_background_opacity = opacity
  else
    overrides.text_background_opacity = nil
  end

  window:set_config_overrides(overrides)
end)

return config
