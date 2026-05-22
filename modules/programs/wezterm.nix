{ dotfiles, ... }:

{
  xdg.configFile."wezterm/wezterm.lua".source = (dotfiles.files + "/wezterm/wezterm.lua");
}
