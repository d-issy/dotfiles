# cdup 
cdup() {
    echo
    cd ..
    zle reset-prompt
}
zle -N cdup

# history-selection - history incremental search by using fzf
history-selection() {
    BUFFER=$(history -n 1 | fzf --tac --height 40% --reverse --no-sort -q "$LBUFFER")
    CURSOR=$#BUFFER
    zle reset-prompt
}
zle -N history-selection

# rep - gopath src incremental search
repo() {
    local src=$(ghq list | fzf --query "$1" --reverse -q "$LBUFFER" -1)
    if [ -n "$src" ]; then
        cd $GOPATH/src/$src
        zle reset-prompt
    fi
}
zle -N repo

# inesrt file
insert-filename() {
    local filepath=$(fd --hidden -E .git -c never --max-depth=5 | fzf --reverse -1 --height 30)
    [ -z "$filepath" ] && zle reset-prompt && return
    if [ -n "$LBUFFER" ]; then
        BUFFER="$LBUFFER$filepath"
    elif [ -d "$filepath" ]; then
        BUFFER="cd $filepath"
    elif [ -f "$filepath" ]; then
        BUFFER="$EDITOR $filepath"
    fi
    CURSOR=$#BUFFER
    zle reset-prompt
}
zle -N insert-filename

# git brach
gc () {
    local branch=$(git branch -vv | fzf --prompt='branch>' --reverse --height 30 | awk '{print $1}' | sed "s/.* //")
    [ -z "$branch" ] && return
    git checkout "$branch"
}

# fore-ground - foreground function
fore-ground() {
    fg > /dev/null 2>&1
    zle reset-prompt
}
zle -N fore-ground

# condition when adding history
zshaddhistory() {
    local line=${1%%$'\n'}
    local cmd=${line%% *}

    [[ ${#line} -ge 5
        && ${cmd} != (l|l[sal]|lsa)
        && ${cmd} != (mkdir|cd|mv|rm)
        && ${cmd} != (less|grep)
        && ${cmd} != (v|vi|vim)
        && ${cmd} != (man)
    ]]
}

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

# anyenv initalizer
envinit() {
    eval "$(anyenv init -)"
}
