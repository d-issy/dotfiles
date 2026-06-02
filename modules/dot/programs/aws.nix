{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.aws;

  mkPluginOption = name: packageName: {
    enable = lib.mkEnableOption name;

    package = lib.mkPackageOption pkgs packageName { };
  };

  mkPluginPackages = plugin: lib.optional plugin.enable plugin.package;
in
{
  options.dot.programs.aws = {
    enable = lib.mkEnableOption "AWS CLI tools";

    package = lib.mkOption {
      type = lib.types.nullOr lib.types.package;
      default = null;
      description = "AWS CLI package to install. When null, programs.awscli.package is not set.";
      example = lib.literalExpression "pkgs.awscli2";
    };

    plugins = {
      awsVault = mkPluginOption "aws-vault" "aws-vault";
      saml2aws = mkPluginOption "saml2aws" "saml2aws";
      ssmSessionManager = mkPluginOption "Session Manager Plugin" "ssm-session-manager-plugin";
    };
  };

  config = lib.mkIf cfg.enable {
    programs.awscli = {
      enable = true;
    }
    // lib.optionalAttrs (cfg.package != null) {
      inherit (cfg) package;
    };

    home.packages =
      mkPluginPackages cfg.plugins.awsVault
      ++ mkPluginPackages cfg.plugins.saml2aws
      ++ mkPluginPackages cfg.plugins.ssmSessionManager;
  };
}
