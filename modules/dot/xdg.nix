{
  config,
  lib,
  dot,
  ...
}:

let
  shared = import ./shared {
    inherit lib;
    inherit (dot) files;
  };
in
{
  options.dot.xdg.configFile = lib.mkOption {
    inherit (shared) type;
    default = { };
    description = "Files/directories under dot.files to symlink into xdg.configFile.";
  };

  config.xdg.configFile = lib.mapAttrs shared.resolveEntry config.dot.xdg.configFile;
}
