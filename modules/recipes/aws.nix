{
  config,
  lib,
  ...
}:

let
  aws = lib.getExe config.programs.awscli.package;
  runningInstancesFilter = "'Name=instance-state-name,Values=running'";
  instanceNameAndIdQuery = "'Reservations[*].Instances[*].[Tags[?Key==`Name`]|[0].Value, InstanceId]'";
in
{
  config = {
    dot.programs.aws = {
      enable = false;
      plugins = {
        awsVault.enable = true;
        saml2aws.enable = true;
        ssmSessionManager.enable = true;
      };
    };

    dot.programs.navi.cheats.aws.sections =
      lib.mkIf
        (config.dot.programs.aws.enable && config.dot.programs.aws.plugins.ssmSessionManager.enable)
        [
          {
            variables = {
              profile = "${aws} configure list-profiles";
              target = lib.concatStringsSep " " [
                "${aws} --profile <profile> ec2 describe-instances"
                "--filters ${runningInstancesFilter}"
                "--query ${instanceNameAndIdQuery}"
                "--output text"
                "--- --column 2 --fzf-overrides '--no-select-1'"
              ];
            };
            entries = [
              {
                description = "start SSM session";
                command = "aws --profile <profile> ssm start-session --target <target>";
              }
            ];
          }
        ];
  };
}
