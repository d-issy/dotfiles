# fish settings
set fish_greeting

# XDG CONFIG
set -x XDG_CONFIG_HOME $HOME/.config
set -x TIGRC_USER $XDG_CONFIG_HOME/tig/config # not compatible for under 2.5.1
set -x ZDOTDIR $XDG_CONFIG_HOME/zsh # not compatible
set -x VIMINIT "if !has('nvim') | source $XDG_CONFIG_HOME/vim/vimrc" # not compatible

# own path
set fish_function_path $__fish_config_dir/functions/own $fish_function_path 

# PATH
set -g PATH

## basic
set -gx PATH
path /usr/local/sbin
path /usr/local/bin
path /usr/sbin
path /usr/bin
path /sbin
path /bin

## for common
path $HOME/.cargo/bin

## for macOS
path -f /usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin

## for WSL vscode
path -f /mnt/c/Users/$USER/AppData/Local/Programs/Microsoft\ VS\ Code/bin
