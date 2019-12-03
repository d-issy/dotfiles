# ls and tree
if [[ -x `which exa` ]]; then
    alias l="exa -F"
    alias ls="exa -F"
    alias la="exa -aF"
    alias ll="exa -lhgF"
    alias lla="exa -lahgF"
    alias l1="exa -1F"
    alias tree="exa -TF"
else
    alias l="ls"
    alias la="ls -A"
    alias ll="ls -l"
    alias lla="ls -lA"
    alias l1="ls -1"
    alias tree="tree -NC"
fi

# mv
alias mv='mv -i'

# cp
alias cp='cp -i'

# git
alias gs='git status'

# hub
if [[ -x `which hub` ]]; then
    alias git="hub"
fi

# tig
if [[ -x `which tig` ]]; then
    alias ts="tig status"
fi

# vim
if [[ -x `which vim` ]]; then
    alias v='vim'
fi

# exit
alias q='exit'
