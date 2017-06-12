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
