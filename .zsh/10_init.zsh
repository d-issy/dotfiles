# ZPLUG
export ZPLUG_HOME=/usr/local/opt/zplug
if [[ -e $ZPLUG_HOME/init.zsh ]]; then
    source $ZPLUG_HOME/init.zsh
    if type zplug >/dev/null 2>&1 ; then
        source $ZSHHOME/plugins.zsh

        if ! zplug check --verbose; then
            zplug install
            exec $SHELL -l
        fi
        zplug load
    fi
fi

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
