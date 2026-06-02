{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.languages.python;

  mkToolOption = name: packageName: {
    enable = lib.mkEnableOption name;
    package = lib.mkPackageOption pkgs packageName { };
  };
in
{
  options.dot.languages.python = {
    enable = lib.mkEnableOption "Python development";

    python.package = lib.mkPackageOption pkgs "python3" {
      nullable = true;
    };

    pipx = mkToolOption "pipx" "pipx";
    pipenv = mkToolOption "Pipenv" "pipenv";
    poetry = mkToolOption "Poetry" "poetry";
    uv = mkToolOption "uv" "uv";
  };

  config = lib.mkIf cfg.enable {
    home.packages =
      lib.optional (cfg.python.package != null) cfg.python.package
      ++ lib.optional cfg.pipx.enable cfg.pipx.package
      ++ lib.optional cfg.pipenv.enable cfg.pipenv.package
      ++ lib.optional cfg.poetry.enable cfg.poetry.package
      ++ lib.optional cfg.uv.enable cfg.uv.package;
  };
}
