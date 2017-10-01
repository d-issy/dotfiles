export ZPLUG_HOME=/usr/local/opt/zplug
source $ZPLUG_HOME/init.zsh

if type zplug >/dev/null 2>&1 ; then
    source $ZSHHOME/plugins.zsh

    if ! zplug check --verbose; then
        zplug install
        exec $SHELL -l
    fi
    zplug load
fi

# loading tmux
# if [[ ! -n $TMUX && $- == *l* ]]; then
#     ID="`tmux ls`"
#     if [[ -z "$ID" ]]; then
#         tmux new-session
#     else
#         create_new_session="New"
#         ID="$ID\n${create_new_session}: create new session"
#             ID="`echo $ID | peco | cut -d: -f1`"
#         if [[ "$ID" = "${create_new_session}" ]]; then
#                 tmux new
#         elif [[ -n "$ID" ]]; then
#             tmux a -t "$ID"
#         fi
#     fi
# fi


