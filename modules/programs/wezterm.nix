{ dot, ... }:

{
  xdg.configFile."wezterm/wezterm.lua".source = dot.files + "/wezterm/wezterm.lua";
}
