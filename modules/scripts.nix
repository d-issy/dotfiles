{ config, ... }:
{
  home.file.".local/bin" = {
    source = ../files/scripts;
    recursive = true;
  };

  home.sessionPath = [
    "${config.home.homeDirectory}/.local/bin"
  ];
}
