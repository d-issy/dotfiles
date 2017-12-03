# Path
typeset -gx -U path PATH
path=(
    $HOME/bin(N-/)
    $HOME/.anyenv/bin(N-/)
    /usr/local/sbin(N-/)
    /usr/local/bin(N-/)
    /usr/local/opt/openssl/bin(N-/)
    /usr/local/opt/go/libexec/bin(N-/)
    $path
)

if [ -z $ZSH_ENV_LOADED ]; then
  eval "$(anyenv init - --no-rehash)"
  export ZSH_ENV_LOADED=1
fi

# fpath
typeset -gx -U fpath
fpath=(
    $HOME/.zsh/completions(N-/)
    $HOME/.zsh/themes(N-/)
    $fpath
)

# GoLang
if [[ -d "${HOME}/go" ]]; then
    export GOPATH=$HOME/go
    path=(${GOPATH}/bin(N-/) $path)
fi

# Java
if [[ -d "${HOME}/java" ]]; then
    export CLASSPATH=$HOME/java
fi

# for MPI
if [[ -d /usr/local/opt/open-mpi ]]; then
    export MPIPATH=/usr/local/opt/open-mpi
    export TMPDIR=/tmp

    typeset -gx -U C_INCLUDE_PATH
    C_INCLUDE_PATH=(
        $MPIPATH/include(N-/)
        $c_include_path
    )

    typeset -gx -U CPLUS_INCLUDE_PATH
    CPLUS_INCLUDE_PATH=(
        $MPIPATH/include(N-/)
        $cplus_include_path
    )

    typeset -gx -U LIBRARY_PATH
    LIBRARY_PATH=(
        $MPIPATH/lib(N-/)
        $library_path
    )
fi

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
