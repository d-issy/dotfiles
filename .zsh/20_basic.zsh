# -------------------------------------
#  Basic Options
# -------------------------------------
umask 022

setopt correct
setopt nobeep
setopt prompt_subst
setopt ignoreeof
setopt notify

# -------------------------------------
#  Directory Move
# -------------------------------------
setopt auto_cd
setopt auto_pushd
setopt pushd_ignore_dups

# -------------------------------------
#  History
# -------------------------------------
setopt hist_expire_dups_first
setopt hist_ignore_dups
setopt hist_ignore_all_dups
setopt hist_ignore_space
setopt hist_no_store
setopt hist_reduce_blanks
setopt hist_save_no_dups

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
zstyle ':completion:*' format '%B%d%b'
zstyle ':completion:*:warnings' format 'No matches for: %d'
zstyle ':completion:*' group-name ''
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'

zstyle ':completion:*' menu select interactive
setopt menucomplete
