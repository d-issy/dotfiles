# expand-alias
typeset -A _ABBRS_DICT

INC_CMD="fzf --reverse --preview 'cat {}'"

function abbr () {
    local abb=$1
    local cmd=$2
    local key="$abb"

    local prefix=''
    local inc=''

    # command
    case $# in
        0) echo $_ABBRS_DICT; return; ;;
        1) echo help; return ;;
    esac

    # parse option
    for opt in ${@:3}; do
        k=$(echo $opt | cut -d '=' -f 1)
        v=$(echo $opt | cut -d '=' -f 2-)
        case $k in
            prefix) prefix=$v ;;
            inc)    inc=$v ;;
            *) echo Unkown Option: $opt 1>&2; return 1 ;;
        esac
    done

    if [ -n "$prefix" ]; then
        key="p\$$abb\$$prefix"
    elif [ -n "$inc" ]; then
        key="i\$$abb"
        cmd="$cmd\$$inc"
    fi
    _ABBRS_DICT["$key"]=$cmd
}

function expand-abbr() {
    local buf=$(echo $LBUFFER | awk '{gsub(/^[ \t]+|[ \t]+$/,""); print}')

    # exact
    if [[ -n ${_ABBRS_DICT[(i)"$buf"]} ]]; then
        LBUFFER=$_ABBRS_DICT["$buf"]" "
        zle reset-prompt
        return
    fi

    # inc
    if [[ -n ${_ABBRS_DICT[(i)"i\$$buf"]} ]]; then
        local v=$_ABBRS_DICT["i\$$buf"]
        local exp=$v[(ws:$:)1]
        local inc=$v[(ws:$:)2]
        local arg=$(eval "$inc | $INC_CMD")
        if [ $arg ]; then
            LBUFFER="$exp $arg"
        fi
        zle reset-prompt
        return
    fi

    zle complete-word
}
zle -N expand-abbr
