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

    node = dot.mkEnableablePackageOption "Node.js" "nodejs_24";

    npm.enable = lib.mkEnableOption "npm";
    yarn = dot.mkEnableablePackageOption "Yarn" "yarn";
    pnpm = dot.mkEnableablePackageOption "pnpm" "pnpm";
    bun = dot.mkEnableablePackageOption "Bun" "bun";
    deno = dot.mkEnableablePackageOption "Deno" "deno";
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
          NPM_CONFIG_PREFIX = npmPrefix;
        }
        // lib.optionalAttrs cfg.pnpm.enable {
          PNPM_HOME = pnpmHome;
        };
      sessionPath =
        lib.optional cfg.npm.enable "${npmPrefix}/bin" ++ lib.optional cfg.pnpm.enable "${pnpmHome}/bin";
    };
  };
}
