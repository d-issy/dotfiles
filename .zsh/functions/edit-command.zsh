# edit command
function edit-command() {
    exec < /dev/tty

    local tempfile=$(mktemp)
    local cursor=$(( $#PREBUFFER + $#LBUFFER + 1 ))
    echo $BUFFER > $tempfile
    vim -c "setf zsh" -c "nnoremap <C-t> ZZ" -c "normal $cursor|" $tempfile
    LBUFFER=$(cat $tempfile)
    RBUFFER=''
    rm $tempfile
    zle reset-prompt
}
zle -N edit-command
