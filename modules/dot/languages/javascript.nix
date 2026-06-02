{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.languages.javascript;
  npmPrefix = "${config.home.homeDirectory}/.npm-global";
  pnpmHome = "${config.home.homeDirectory}/.local/share/pnpm";

  mkPackageManagerOption = name: packageName: {
    enable = lib.mkEnableOption name;
    package = lib.mkPackageOption pkgs packageName { };
  };
in
{
  options.dot.languages.javascript = {
    enable = lib.mkEnableOption "JavaScript/TypeScript development";

    node = {
      enable = lib.mkEnableOption "Node.js";
      package = lib.mkPackageOption pkgs "nodejs_24" { };
    };

    npm.enable = lib.mkEnableOption "npm";
    yarn = mkPackageManagerOption "Yarn" "yarn";
    pnpm = mkPackageManagerOption "pnpm" "pnpm";
    bun = mkPackageManagerOption "Bun" "bun";
    deno = mkPackageManagerOption "Deno" "deno";
  };

  config = lib.mkIf cfg.enable {
    home = {
      packages =
        lib.optional (cfg.node.enable || cfg.npm.enable) cfg.node.package
        ++ lib.optional cfg.yarn.enable cfg.yarn.package
        ++ lib.optional cfg.pnpm.enable cfg.pnpm.package
        ++ lib.optional cfg.bun.enable cfg.bun.package
        ++ lib.optional cfg.deno.enable cfg.deno.package;
      sessionVariables =
        lib.optionalAttrs cfg.npm.enable {
          NPM_CONFIG_USERCONFIG = "${config.home.homeDirectory}/.npmrc";
        }
        // lib.optionalAttrs cfg.pnpm.enable {
          PNPM_HOME = pnpmHome;
        };
      sessionPath =
        lib.optional cfg.npm.enable "${npmPrefix}/bin" ++ lib.optional cfg.pnpm.enable "${pnpmHome}/bin";
      file.".npmrc" = lib.mkIf cfg.npm.enable {
        text = ''
          prefix=${npmPrefix}
        '';
      };
    };
  };
}
