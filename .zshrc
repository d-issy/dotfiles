# Load zsh files
ZSHHOME="${HOME}/.zsh"
if [ -d $ZSHHOME ]; then
    for f in ${ZSHHOME}/*; do
        if [[ $f =~ "[0-9]+.*\.(sh|zsh)" ]]; then
            source "$f"
        fi
    done
fi
