# {{{ XDG CONFIG
set -x XDG_CONFIG_HOME $HOME/.config
set -x TIGRC_USER $XDG_CONFIG_HOME/tig/config # not compatible for under 2.5.1
set -x ZDOTDIR $XDG_CONFIG_HOME/zsh # not compatible
set -x VIMINIT "source $XDG_CONFIG_HOME/vim/vimrc" # not compatible
# }}}

# {{{ fish config
set fish_greeting
set fish_function_path $__fish_config_dir/functions/own $fish_function_path
set fish_complete_path $__fish_config_dir/completions/own $fish_complete_path
#}}}

# {{{ PATH
## basic
set -x PATH
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
path -f $HOME/.anyenv/bin      # anyenv

## for macOS
path /usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin

## for WSL vscode
path /mnt/c/Users/$USER/AppData/Local/Programs/Microsoft\ VS\ Code/bin
path /mnt/c/Program\ Files/Docker/Docker/resources/bin

## for nix-env ld_path
if type -q nix
  set -l ld_path (nix eval --raw nixpkgs.stdenv.cc.cc.lib 2> /dev/null)
  if test -d $ld_path/lib64
    set -x LD_LIBRARY_PATH $ld_path/lib64
  end
end

# }}}

#{{{ common config
set -x LESSHISTFILE ~
#}}}

# {{{ 3rd party config
if type -q fzf
  set -x FZF_DEFAULT_OPTS '--reverse --height=40%'
end

if type -q pipenv
  set -x PIPENV_VENV_IN_PROJECT 1
end

if type -q anyenv
  status --is-interactive; and source (anyenv init -|psub)
end
# }}}

# {{{ wsl config
if test -f /proc/sys/fs/binfmt_misc/WSLInterop
  set -x DISPLAY (cat /etc/resolv.conf | grep nameserver | awk '{print $2}'):0.0
end
#}}}
