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
