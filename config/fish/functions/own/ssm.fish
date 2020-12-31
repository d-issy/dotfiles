function ssm ()
  # check awscli command
  if not type -q aws; echo "require installation of awscli"; false; return; end

  # choose profile 
  set profile (aws configure list-profiles | fzf --reverse --height 40%)
  if test $status != 0; return; end

  # choose instances
  set instanceId (aws ec2 --profile $profile describe-instances | jq -c '.Reservations[].Instances[] | select(.State.Name == "running") | {Name: (.Tags[]|select(.Key == "Name")|.Value), InstanceId: .InstanceId}' | fzf --reverse --height 40% | jq -r .InstanceId)
  if test $status != 0; return; end

  # connect instance
  aws --profile $profile ssm start-session --target $instanceId

  # repaint
  commandline -f repaint
end
