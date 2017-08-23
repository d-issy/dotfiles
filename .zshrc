ZSHHOME="${HOME}/.zsh"
export ZPLUG_HOME=/usr/local/opt/zplug
source $ZPLUG_HOME/init.zsh

zplug "zsh-users/zsh-syntax-highlighting", defer:2
zplug "mollifier/anyframe"

[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh
zplug load

# Load zsh files
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

