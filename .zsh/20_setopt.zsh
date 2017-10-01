# -------------------------------------
#  Basic Options
# -------------------------------------

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

# cd -[tab]で過去のディレクトリにひとっ飛びできるようにする
setopt auto_pushd

# ディレクトリ名を入力するだけでcdできるようにする
setopt auto_cd

# -------------------------------------
#  History
# -------------------------------------

# 直前と同じコマンドは履歴に追加しない
setopt hist_ignore_dups

# 余分なスペースを削除して履歴に保存する
setopt hist_reduce_blanks

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
