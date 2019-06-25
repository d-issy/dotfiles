# -------------------------------------
#  Prompt
# -------------------------------------
autoload -U promptinit; promptinit
autoload -Uz colors; colors
autoload -Uz vcs_info
autoload -Uz is-at-least

prompt mytheme

# -------------------------------------
#  Completion
# -------------------------------------
autoload -Uz compinit
compinit

zstyle ':completion:*' verbose yes
zstyle ':completion:*' group-name ''
zstyle ':completion:*:warnings' format ''
zstyle ':completion:*' format '%B%F{yellow}%d%f%b'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}' 'r:|?=**'

zstyle ':completion:*:default' menu true select=2
zstyle ':completion:*' menu select interactive
setopt menucomplete
