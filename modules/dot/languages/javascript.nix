{
  config,
  lib,
  dot,
  ...
}:

let
  cfg = config.dot.languages.javascript;
  npmPrefix = "${config.home.homeDirectory}/.npm-global";
  pnpmHome = "${config.home.homeDirectory}/.local/share/pnpm";
in
{
  options.dot.languages.javascript = {
    enable = lib.mkEnableOption "JavaScript/TypeScript development";

    node = dot.mkEnablablePackageOption "Node.js" "nodejs_24";

    npm.enable = lib.mkEnableOption "npm";
    yarn = dot.mkEnablablePackageOption "Yarn" "yarn";
    pnpm = dot.mkEnablablePackageOption "pnpm" "pnpm";
    bun = dot.mkEnablablePackageOption "Bun" "bun";
    deno = dot.mkEnablablePackageOption "Deno" "deno";
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
