# expand-alias
typeset -gA abbrs

function expand-abbr() {
    local key=$LBUFFER
    if [ -z "${abbrs[(i)$key]}" ]; then
        zle complete-word
        return
    fi

    cmd=$(echo $abbrs[$key] | awk -F, '{print $1}')
    arg=$(echo $abbrs[$key] | awk -F, '{print $2}')
    case $arg in
        n) LBUFFER="$cmd" ;;
        f)
            if $(git rev-parse 2> /dev/null); then
                f=$(cat <(git ls-files --others --exclude-standard) <(git ls-files) | fzf --reverse --preview 'cat {}' --select-1)
            else
                f=$(find . -type d \( -name '.git' -o -name 'node_modules' \) -prune -o -type f -mindepth 1 -maxdepth 6 -print | sed 's/^\.\///' | fzf --reverse --preview 'cat {}' --select-1)
            fi
            if [ $f ]; then LBUFFER="$cmd $f" else LBUFFER="" fi
            ;;
        *) LBUFFER="$cmd " ;;
    esac
    zle reset-prompt
}
zle -N expand-abbr
