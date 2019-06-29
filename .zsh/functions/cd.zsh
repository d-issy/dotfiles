# smart cd
CD_HISTORY_FILE=${CD_HISTORY_FILE:-$HOME/.cd_history}

# init
__cd::init() {
    __cd::history::init
    alias cd=__cd::run
    compdef _cd __cd::run
}

# history
__cd::history::init()
{
    if [ ! -f $CD_HISTORY_FILE ]; then
        touch $CD_HISTORY_FILE
    fi
}

__cd::history::update()
{
    echo $PWD >> $CD_HISTORY_FILE
    sort -u $CD_HISTORY_FILE -o $CD_HISTORY_FILE
}

# goto
__cd::goto::home()
{
    builtin cd $HOME
}

__cd::goto::back()
{
    dir=$(awk -v dir=$(PWD) '
BEGIN {
    c=gsub(/\//, "/", dir);
    for ( i = 0; i < c; i++ ) {
        gsub(/\/[^\/]*$/, "", dir);
        if (dir != "")
            print dir;
    }
}' | fzf -1 --reverse --height=20 -q "$2")
    builtin cd $dir
}

__cd::goto::default()
{
    if [ ! -d $@ ]; then
        echo Sorry: \"$@\" directory does not exist
        return 1
    fi
    builtin cd $@
}

# list
__cd::list()
{
    for d in $(command ls -FA | grep /; cat $CD_HISTORY_FILE | sed 's/$/\//g'); do
        if [ -d $d ]; then
            echo $d
        fi
    done
}

# run
__cd::run ()
{
    if [ $# -eq 0 ]; then
        __cd::goto::home
    elif [ $1 = ',' ]; then
        __cd::goto::back ${@}
    else
        __cd::goto::default ${@} || return
    fi
    __cd::history::update
}
__cd::init
