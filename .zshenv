# GoLang
export GOPATH=$HOME/go

#  Path
typeset -gx -U path PATH

path=(
    $HOME/.anyenv/bin(N-/)
    /usr/local/bin(N-/)
    /usr/local/sbin(N-/)
    $HOME/bin(N-/)
    $GOPATH/bin(N-/)
    $path
)

typeset -gx -U fpath
fpath=(
    /usr/local/share/zsh-completions(N-/)
    $fpath
)
eval "$(anyenv init -)"

# LANGUAGE must be en_US for ssh connection
export LANGUAGE="en_US.UTF-8"
export LANG="${LANGUAGE}"
export LC_ALL="${LANGUAGE}"
export LC_CTYPE="${LANGUAGE}"

# EDITOR
export EDITOR=vim
export CVSEDITOR="${EDITOR}"
export SVN_EDITOR="${EDITOR}"
export GIT_EDITOR="${EDITOR}"

# PAGER
export PAGER=less
export LESSCHARSET='utf-8'

# HISTORY
export HISTFILE=~/.zsh_history
export HISTSIZE=10000
export SAVEHIST=1000000
export LISTMAX=50
