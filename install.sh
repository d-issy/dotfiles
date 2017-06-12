#!/bin/bash

TARGET_FILES=".??* bin"

for f in $TARGET_FILES
do
    [[ $f == ".git" ]] && continue
    [[ $f == ".gitignore" ]] && continue
    [[ $f == ".gitmodules" ]] && continue
    [[ $f == ".ex.gitconfig.user" ]] && continue
    [[ $f == ".DS_Store" ]] && continue

    ln -snvf "$(pwd)/$f" "$HOME/$f"
done

exec $SHELL -l
