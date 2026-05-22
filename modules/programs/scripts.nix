{ config, dot, ... }:
{
  home.file.".local/bin" = {
    source = dot.files + "/scripts";
    recursive = true;
  };

  home.sessionPath = [
    "${config.home.homeDirectory}/.local/bin"
  ];
}
