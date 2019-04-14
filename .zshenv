# GoLang
export GOPATH=$HOME

# Java
export CLASSPATH=$HOME/java

# Path
typeset -gx -U path PATH
path=(
    $HOME/bin(N-/)
    $GOPATH/bin(N-/)
    $HOME/.cargo/bin(N-/)
    $HOME/.anyenv/bin(N-/)
    $HOME/.anyenv/envs/nodenv/shims(N-/)
    $HOME/.anyenv/envs/phpenv/shims(N-/)
    /usr/local/sbin(N-/)
    /usr/local/opt/openssl/bin(N-/)
    /usr/local/opt/go/libexec/bin(N-/)
    /usr/local/bin(N-/)
    /usr/bin(N-/)
    /bin(N-/)
    /usr/sbin(N-/)
    /sbin(N-/)
    $path
)

# fpath
typeset -gx -U fpath
fpath=(
    $HOME/.zsh/completions(N-/)
    $HOME/.zsh/themes(N-/)
    /usr/local/share/zsh/functions/(N-/)
    $fpath
)

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

# KEYTIMEOUT
export KEYTIMEOUT=0
