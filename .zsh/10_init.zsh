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
    ID="`tmux ls`"
    option=""

    # confirm
    function confirm {
        MSG=$1
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

    if [[ -z "$ID" ]]; then
        option="new-session"
    else
        create_new_session="New"
        ID="${create_new_session}: create new session\n$ID"
        ID="`echo $ID | fzf --reverse | cut -d: -f1`"

        if [[ "$ID" = "${create_new_session}" ]]; then
            option="new"
        elif [[ -n "$ID" ]]; then
            option="a -t $ID"
        fi
    fi
    tmux $option && confirm "exit?" && exit
fi
