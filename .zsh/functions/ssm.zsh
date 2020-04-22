ssm () {
    local profile=$(cat ~/.aws/config | grep '\[profile' | sed -E 's/^\[profile ([-a-z]+).*/\1/' | fzf --tac --height 40% --reverse --prompt='profile> ')
    local instanceId=$(aws ec2 --profile $profile describe-instances | jq -c '.Reservations[].Instances[] | select(.State.Name == "running") | {Name: (.Tags[]|select(.Key == "Name")|.Value), InstanceId: .InstanceId}' | fzf --tac --height 40% --reverse | jq -r .InstanceId)
    aws --profile $profile ssm start-session --target $instanceId
}
