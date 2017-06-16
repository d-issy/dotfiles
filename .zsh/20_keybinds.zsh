bindkey -e

function cdup() {
    echo
    cd ..
    zle reset-prompt
}
zle -N cdup

function peco-history-selection() {
    BUFFER=$(history -n 1 | tail -r  | awk '!a[$0]++' | fzf --height 40% --reverse)
    CURSOR=$#BUFFER
    zle reset-prompt
}
zle -N peco-history-selection

function peco-src() {
    local src=$(ghq list --full-path | peco --query "$LBUFFER")
    if [ -n "$src" ]; then
        cd $src
        zle reset-prompt
    fi
}
zle -N peco-src

function fore-ground() {
    fg > /dev/null 2>&1
    zle reset-prompt
}

zle -N fore-ground
bindkey '^Z' fore-ground
bindkey '^U' cdup
bindkey '^R' peco-history-selection
bindkey '^J' self-insert
bindkey '^[[1~' beginning-of-line
bindkey '^[[4~' end-of-liine
bindkey '^[[3~' delete-char
bindkey '^@' peco-src
