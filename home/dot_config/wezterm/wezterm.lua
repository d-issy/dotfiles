local wezterm = require "wezterm"
local act = wezterm.action

local config = {}

if wezterm.config_builder then
  config = wezterm.config_builder()
end

-- UI
config.color_scheme = "Catppuccin Macchiato"
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
  -- { key = "q", mods = "CTRL", action = act.SendKey { key = "q", mods = "CTRL" } },
  { key = "u", mods = "LEADER", action = act.EmitEvent "toggle-opacity" },

  { key = "'", mods = "LEADER", action = act.SplitHorizontal { domain = "CurrentPaneDomain" } },
  { key = '"', mods = "LEADER|SHIFT", action = act.SplitVertical { domain = "CurrentPaneDomain" } },

  { key = "h", mods = "LEADER", action = act.ActivatePaneDirection "Left" },
  { key = "j", mods = "LEADER", action = act.ActivatePaneDirection "Down" },
  { key = "k", mods = "LEADER", action = act.ActivatePaneDirection "Up" },
  { key = "l", mods = "LEADER", action = act.ActivatePaneDirection "Right" },

  { key = "H", mods = "CTRL|SHIFT", action = act.AdjustPaneSize { "Left", 1 } },
  { key = "J", mods = "CTRL|SHIFT", action = act.AdjustPaneSize { "Down", 1 } },
  { key = "K", mods = "CTRL|SHIFT", action = act.AdjustPaneSize { "Up", 1 } },
  { key = "L", mods = "CTRL|SHIFT", action = act.AdjustPaneSize { "Right", 1 } },

  { key = "c", mods = "LEADER", action = act.SpawnTab "CurrentPaneDomain" },
  { key = "p", mods = "LEADER", action = act.ActivateTabRelative(-1) },
  { key = "n", mods = "LEADER", action = act.ActivateTabRelative(1) },
  { key = "z", mods = "LEADER", action = act.TogglePaneZoomState },

  { key = "[", mods = "LEADER", action = act.ActivateCopyMode },
}

local wsl_domains = wezterm.default_wsl_domains()
if #wsl_domains > 0 then
  config.default_domain = wsl_domains[1].name
  config.leader = { key = "b", mods = "CTRL", timeout_milliseconds = 1000 }
else
  config.leader = { key = "q", mods = "CTRL", timeout_milliseconds = 1000 }
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
