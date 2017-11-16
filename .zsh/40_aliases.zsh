# ls
if [[ -x `which exa` ]]; then
    alias ls="exa"
    alias la="exa -a"
    alias ll="exa -l"
    alias lla="exa -la"
    alias l1="exa -1"
else
    alias la="ls -A"
    alias ll="ls -l"
    alias lla="ls -lA"
    alias l1="ls -1"
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

# tree
alias tree="tree -NC"

# glut
alias ccgl='g++ -I/usr/local/Cellar/freeglut/2.8.1/include -L/usr/local/Cellar/freeglut/2.8.1/lib -w -framework OpenGL -lGLUT'
