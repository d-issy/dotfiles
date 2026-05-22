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
  options.dot.home.file = lib.mkOption {
    inherit (shared) type;
    default = { };
    description = "Files/directories under dot.files to symlink into home.file.";
  };

  config.home.file = lib.mapAttrs shared.resolveEntry config.dot.home.file;
}
