# cdup
cdup() {
    echo
    cd ..
    zle reset-prompt
}
zle -N cdup
