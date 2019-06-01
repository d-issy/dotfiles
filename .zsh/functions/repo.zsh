# rep - gopath src incremental search
repo() {
    local src=$(ghq list | fzf --query "$1" --reverse -q "$LBUFFER" -1)
    if [ -n "$src" ]; then
        cd $GOPATH/src/$src
        zle reset-prompt
    fi
}
zle -N repo
