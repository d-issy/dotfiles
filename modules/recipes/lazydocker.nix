{ pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.lazydocker ];
    home.shellAliases = {
      lzd = "lazydocker";
    };
  };
}
