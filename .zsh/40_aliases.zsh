# ls and tree
if [[ -x `which exa` ]]; then
    alias ls="exa -F"
    alias la="exa -aF"
    alias ll="exa -lhgF"
    alias lla="exa -lahgF"
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
    alias ps="grc ps"
    alias tail="grc tail"
    alias traceroute="grc traceroute"
fi

# git
alias g="git"
alias ga="git add"
alias gc="git checkout"
alias gcf="git checkout --"
alias gco="git commit"
alias gd="git diff --color"
alias gdc="git diff --color --cached"
alias gf="git fetch --prune"
alias gl="git log --oneline --graph --decorate"
alias gp="git push origin HEAD"
alias gpl="git pull origin HEAD"
alias gr="git reset HEAD"
alias gs="git status"

# aliases
alias v='vim'
alias nis='npm install --save'
alias nid='npm install --save-dev'

# exit
alias q='exit'

# glut
alias ccgl='g++ -I/usr/local/Cellar/freeglut/2.8.1/include -L/usr/local/Cellar/freeglut/2.8.1/lib -w -framework OpenGL -lGLUT'
