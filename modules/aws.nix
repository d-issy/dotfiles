{ config, pkgs, ... }:

{
  config = {
    home.packages = [
      pkgs.awscli2
      pkgs.aws-vault
      pkgs.saml2aws
      pkgs.ssm-session-manager-plugin
    ];

    # TODO: move to navi
    programs.zsh.initContent = ''
      function ssm() {
        local profile=$(aws configure list-profiles | fzf)
        if [ -z "$profile" ] ; then; return; fi
        local target=$(aws --profile $profile ec2 describe-instances --filters 'Name=instance-state-name,Values=running' --query 'Reservations[*].Instances[*].[Tags[?Key==`Name`]|[0].Value, InstanceId]' --output text | fzf | cut -f2)
        if [ -z "$target" ] ; then; return; fi
        aws --profile $profile ssm start-session --target $target
      }
    '';
  };

}
