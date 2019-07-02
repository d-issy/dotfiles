# zsh-syntax-highlighting
if [ -d /usr/local/share/zsh-syntax-highlighting ]; then
    typeset -A ZSH_HIGHLIGHT_STYLES
    ZSH_HIGHLIGHT_HIGHLIGHTERS=(main brackets pattern cursor line)
    ZSH_HIGHLIGHT_STYLES[path]='fg=blue,bold,underline'
    ZSH_HIGHLIGHT_STYLES[path_pathseparator]='fg=red,bold'
    ZSH_HIGHLIGHT_STYLES[path_prefix]='fg=blue'
    ZSH_HIGHLIGHT_STYLES[path_prefix_pathseparator]='fg=red'
    ZSH_HIGHLIGHT_STYLES[globbing]='fg=green'
    ZSH_HIGHLIGHT_STYLES[command]='fg=39,bold'
    ZSH_HIGHLIGHT_STYLES[suffix-alias]='fg=39,bold'
    ZSH_HIGHLIGHT_STYLES[builtin]='fg=39'
    ZSH_HIGHLIGHT_STYLES[alias]='fg=39'
    ZSH_HIGHLIGHT_STYLES[arg0]='fg=39'
    ZSH_HIGHLIGHT_STYLES[precommand]='fg=39'
    ZSH_HIGHLIGHT_STYLES[single-hyphen-option]='fg=172'
    ZSH_HIGHLIGHT_STYLES[double-hyphen-option]='fg=172'
    source /usr/local/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
fi
