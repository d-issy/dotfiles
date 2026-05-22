{ dotfiles, ... }:

{
  xdg.configFile."ghostty/config".source = (dotfiles.files + "/ghostty/config");
}
