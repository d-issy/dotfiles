# Load zsh files
ZSHHOME="${HOME}/.zsh"
if [ ! -d $ZSHHOME ]; then; return; fi

for f in ${ZSHHOME}/_*.zsh; do
    source $f
done

for f in ${ZSHHOME}/functions/**/*.zsh; do
    source "$f"
done

for f in ${ZSHHOME}/*; do
    if [[ $f =~ "[0-9]+.*\.(sh|zsh)" ]]; then
        source "$f"
    fi
done
