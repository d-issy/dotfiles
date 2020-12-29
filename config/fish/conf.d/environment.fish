# fish settings
set fish_greeting

# environment
set -x XDG_CONFIG_HOME $HOME/.config
set -x TIGRC_USER $XDG_CONFIG_HOME/tig/config # not compatible for under 2.5.1
set -x ZDOTDIR $XDG_CONFIG_HOME/zsh # not compatible

# PATH
set -g PATH

## basic
set -gx PATH $PATH /usr/local/sbin /usr/local/bin /usr/sbin /usr/bin /sbin /bin


## in WSL vscode
set -l DIR /mnt/c/Users/$USER/AppData/Local/Programs/Microsoft\ VS\ Code/bin
if test -d $DIR
  set -gx PATH $PATH $DIR
end
