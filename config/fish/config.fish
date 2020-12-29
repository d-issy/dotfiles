# starship theme setting
starship init fish | source

# fish config
fish_vi_key_bindings
set fish_greeting

# set environment
set -x XDG_CONFIG_HOME $HOME/.config
set -x TIGRC_USER $XDG_CONFIG_HOME/tig/config # not compatible for under 2.5.1
set -x ZDOTDIR $XDG_CONFIG_HOME/zsh # not compatible
