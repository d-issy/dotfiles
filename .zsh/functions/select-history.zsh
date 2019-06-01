# history-selection - history incremental search by using fzf
select-history() {
    BUFFER=$(history -n 1 | fzf --tac --height 40% --reverse --no-sort -q "$LBUFFER")
    CURSOR=$#BUFFER
    zle reset-prompt
}
zle -N select-history
