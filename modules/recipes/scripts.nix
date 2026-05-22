{ config, ... }:
{
  dot.home.file.".local/bin".source = "scripts";

  home.sessionPath = [
    "${config.home.homeDirectory}/.local/bin"
  ];
}
