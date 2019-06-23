# smart cd
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
    builtin cd $@
}

__cd::run ()
{
    if [ $# -eq 0 ]; then
        __cd::goto::home
    elif [ $1 = ',' ]; then
        __cd::goto::back ${@}
    else
        __cd::goto::default ${@}
    fi
}
alias cd=__cd::run
