# fish settings
set fish_greeting

# {{{ XDG CONFIG
set -x XDG_CONFIG_HOME $HOME/.config
set -x TIGRC_USER $XDG_CONFIG_HOME/tig/config # not compatible for under 2.5.1
set -x ZDOTDIR $XDG_CONFIG_HOME/zsh # not compatible
set -x VIMINIT "source $XDG_CONFIG_HOME/vim/vimrc" # not compatible
# }}}

# own function path
set fish_function_path $__fish_config_dir/functions/own $fish_function_path

# DISPLAY
if test -f /proc/sys/fs/binfmt_misc/WSLInterop
  set -gx DISPLAY (cat /etc/resolv.conf | grep nameserver | awk '{print $2}'):0.0
end

# {{{ PATH
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
path $HOME/.cargo/bin          # cargo
path $HOME/.local/bin          # local/bin
path -f $HOME/.nix-profile/bin # nix package manager
path -f $HOME/.poetry/bin      # python package manager

## for macOS
path /usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin

## for WSL vscode
path /mnt/c/Users/$USER/AppData/Local/Programs/Microsoft\ VS\ Code/bin
path /mnt/c/Program\ Files/Docker/Docker/resources/bin

# }}}

# fzf
set -gx FZF_DEFAULT_OPTS '--reverse --height=40%'

# zoxide
if type -q zoxide
  zoxide init fish | source
end

# fuck
if type -q thefuck
  thefuck --alias | source
end
