{
  config,
  lib,
  pkgs,
  dot,
  ...
}:

let
  cfg = config.dot.languages.python;
in
{
  options.dot.languages.python = {
    enable = lib.mkEnableOption "Python development";

    python.package = lib.mkPackageOption pkgs "python3" {
      nullable = true;
    };

    pipx = dot.mkEnablablePackageOption "pipx" "pipx";
    pipenv = dot.mkEnablablePackageOption "Pipenv" "pipenv";
    poetry = dot.mkEnablablePackageOption "Poetry" "poetry";
    uv = dot.mkEnablablePackageOption "uv" "uv";
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
