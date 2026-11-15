{
  config,
  lib,
  pkgs,
  dot,
  ...
}:

let
  cfg = config.dot.programs.aws;
in
{
  options.dot.programs.aws = {
    enable = lib.mkEnableOption "AWS CLI tools";

    package = lib.mkPackageOption pkgs "awscli2" {
      nullable = true;
      default = null;
      extraDescription = "When null, programs.awscli.package is not set.";
    };

    plugins = {
      awsVault = dot.mkEnableablePackageOption "aws-vault" "aws-vault";
      saml2aws = dot.mkEnableablePackageOption "saml2aws" "saml2aws";
      ssmSessionManager = dot.mkEnableablePackageOption "Session Manager Plugin" "ssm-session-manager-plugin";
    };
  };

  config = lib.mkIf cfg.enable {
    programs.awscli = {
      enable = true;
    }
    // lib.optionalAttrs (cfg.package != null) {
      inherit (cfg) package;
    };

    home.packages = lib.concatMap (plugin: lib.optional plugin.enable plugin.package) (
      lib.attrValues cfg.plugins
    );
  };
}
