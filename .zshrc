# Load zsh files
ZSHHOME="${HOME}/.zsh"
if [ -d $ZSHHOME ]; then
    for f in ${ZSHHOME}/*; do
        if [[ $f =~ "[0-9]+.*\.(sh|zsh)" ]]; then
            source "$f"
        fi
    done

    for f in ${ZSHHOME}/plugins/*; do
        if [[ $f =~ ".*\.(sh|zsh)" ]]; then
            source "$f"
        fi
    done
fi

