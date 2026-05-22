{ config, dotfiles, ... }:
{
  home.file.".local/bin" = {
    source = (dotfiles.files + "/scripts");
    recursive = true;
  };

  home.sessionPath = [
    "${config.home.homeDirectory}/.local/bin"
  ];
}
