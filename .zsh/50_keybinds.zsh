# bindkey -e

bindkey -v
bindkey '^A' beginning-of-line
bindkey '^N' down-line-or-history
bindkey '^E' end-of-line
bindkey '^P' up-line-or-history

bindkey '\t' expand-abbr
bindkey '^@' repo
bindkey '^J' self-insert
bindkey '^R' history-selection
bindkey '^U' cdup
bindkey '^Z' fore-ground

# menu select
zmodload -i zsh/complist
bindkey -M menuselect '^h' vi-backward-char
bindkey -M menuselect '^j' vi-down-line-or-history
bindkey -M menuselect '^k' vi-up-line-or-history
bindkey -M menuselect '^l' vi-forward-char
