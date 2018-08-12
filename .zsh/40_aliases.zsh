# ls and tree
if [[ -x `which exa` ]]; then
    alias ls="exa -F"
    alias la="exa -aF"
    alias ll="exa -lhgF --git"
    alias lla="exa -lahgF --git"
    alias l1="exa -1F"
    alias tree="exa -TF"
else
    alias la="ls -A"
    alias ll="ls -l"
    alias lla="ls -lA"
    alias l1="ls -1"
    alias tree="tree -NC"
fi

# grc
if [[ -x `which grc` ]]; then
    alias diff="grc diff"
    alias netstat="grc netstat"
    alias ping="grc ping"
    alias traceroute="grc traceroute"
fi

# git
if [[ -x `which git` ]]; then
    alias g="git"
    alias ga="git add"
    alias gaa="git add ."
    alias gcf="git checkout --"
    alias gco="git commit"
    alias gd="git diff --color"
    alias gdc="git diff --color --cached"
    alias gfe="git fetch --prune"
    alias gpush="git push origin HEAD"
    alias gpull="git pull origin HEAD"
    alias gr="git reset HEAD"
    alias gs="git status"
fi

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

# npm
if [[ -x `which npm` ]]; then
    alias nis='npm install --save'
    alias nid='npm install --save-dev'
fi

# exit
alias q='exit'
