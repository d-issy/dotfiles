# edit command
function edit-command() {
    exec < /dev/tty
    tempfile=$(mktemp)
    echo $BUFFER > $tempfile
    vim $tempfile
    LBUFFER=$(cat $tempfile)
    RBUFFER=''
    rm $tempfile
}
zle -N edit-command
