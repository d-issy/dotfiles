# cdup 
cdup() {
    echo
    cd ..
    zle reset-prompt
}
zle -N cdup

 # history-selection - history incremental search by using fzf
history-selection() {
    BUFFER=$(history -n 1 | awk '!a[$0]++' | fzf --tac --height 40% --reverse --no-sort)
    CURSOR=$#BUFFER
    zle reset-prompt
}
zle -N history-selection

# peco-src - gopath src incremental search
ghq-src() {
    local src=$(ghq list | fzf --query "$1" --reverse)
    if [ -n "$src" ]; then
        cd $GOPATH/src/$src
        zle reset-prompt
    fi
}
zle -N ghq-src

# fore-ground - foreground function
fore-ground() {
    fg > /dev/null 2>&1
    zle reset-prompt
}
zle -N fore-ground

# proxy setting function
setproxy() {
    local proxy=http://wwwproxy.kanazawa-it.ac.jp:8080/
    export http_proxy=$proxy
    export https_proxy=$proxy
    export all_proxy=$proxy
}

noproxy() {
    unset http_proxy;
    unset https_proxy;
    unset all_proxy;
}
