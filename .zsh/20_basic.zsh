# -------------------------------------
#  Basic Options
# -------------------------------------

umask 022

## 補完機能の強化
autoload -U compinit
compinit

## 入力しているコマンド名が間違っている場合にもしかして：を出す。
setopt correct

# ビープを鳴らさない
setopt nobeep

## 色を使う
setopt prompt_subst

## ^Dでログアウトしない。
setopt ignoreeof

## バックグラウンドジョブが終了したらすぐに知らせる。
setopt notify

# 補完
## タブによるファイルの順番切り替えをしない
zstyle ':completion:*' menu select interactive
setopt menucomplete


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
#  Other
# -------------------------------------

# cdしたあとで、自動的に ls する
function chpwd() { ls }
