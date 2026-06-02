{
  config,
  lib,
  dot,
  ...
}:

let
  cfg = config.dot.programs.aws;
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
      awsVault = dot.mkEnablablePackageOption "aws-vault" "aws-vault";
      saml2aws = dot.mkEnablablePackageOption "saml2aws" "saml2aws";
      ssmSessionManager = dot.mkEnablablePackageOption "Session Manager Plugin" "ssm-session-manager-plugin";
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
