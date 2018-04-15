# Tmux
if [[ ! -n $TMUX && $- == *l* ]]; then

    # confirm
    function confirm {
        MSG="exit?"
        while :
        do
            echo -n "${MSG} [Y/n]: "
            read ans
            if [ -z "$ans" ]; then
                ans="y"
            fi
            case $ans in
                [yYqQ]) return 0 ;;
                [nN]) return 1 ;;
            esac
        done
    }

    ID="`tmux ls`"
    if [[ -z "$ID" ]]; then
        tmux new-session && confirm && exit
    else
        create_new_session="New"
        ID="${create_new_session}: create new session\n$ID"
        ID="`echo $ID | fzf --reverse | cut -d: -f1`"

        if [[ "$ID" = "${create_new_session}" ]]; then
            tmux new-session && confirm && exit
        elif [[ -n "$ID" ]]; then
            tmux a -t "$ID" && confirm && exit
        fi
    fi
fi
