# @see https://code.visualstudio.com/docs/remote/containers#_using-ssh-keys
if type -q ssh-agent
  if test -z $SSH_AUTH_SOCK
    set RUNNING_AGENT (ps -ax | grep 'ssh-agent -s' | grep -v grep | wc -l | tr -d '[:space:]')
    if test $RUNNING_AGENT -eq 0
      ssh-agent -c > $HOME/.ssh/ssh-agent
    end
    source $HOME/.ssh/ssh-agent >/dev/null
  end
end
