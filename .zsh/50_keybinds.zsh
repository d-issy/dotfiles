bindkey -e
bindkey '^Z' fore-ground
bindkey '^U' cdup
bindkey '^R' history-selection
bindkey '^J' self-insert
bindkey '^@' ghq-src

# menu select
zmodload -i zsh/complist
bindkey -M menuselect '^h' vi-backward-char
bindkey -M menuselect '^j' vi-down-line-or-history
bindkey -M menuselect '^k' vi-up-line-or-history
bindkey -M menuselect '^l' vi-forward-char
