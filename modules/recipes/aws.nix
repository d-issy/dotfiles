{ lib, pkgs, ... }:

let
  aws = "${pkgs.awscli2}/bin/aws";
  runningInstancesFilter = "'Name=instance-state-name,Values=running'";
  instanceNameAndIdQuery = "'Reservations[*].Instances[*].[Tags[?Key==`Name`]|[0].Value, InstanceId]'";
in
{
  config = {
    home.packages = with pkgs; [
      awscli2
      aws-vault
      saml2aws
      ssm-session-manager-plugin
    ];

    dot.programs.navi.cheats.aws.sections = [
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
