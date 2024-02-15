zsh-history() {
  if which mise &>/dev/null; then
    BUFFER=`history -n 1 | fzf --reverse --query "$BUFFER"`
    CURSOR=$#BUFFER
    zle reset-prompt
  else
    zle history-incremental-search-backward
  fi
}
zle -N zsh-history
