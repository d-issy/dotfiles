bm () {
    local bm_dir=${BM_DIR:-$HOME/bm}
    if [ ! -d $bm_dir ]; then
        mkdir $bm_dir
    fi
    local bm_file=$bm_dir/data
    if [ ! -f $bm_file ]; then
        touch $bm_file
    fi

    if [ $# -eq 0 ]; then
        # bm selection
        local b=$(cat $bm_file | fzf --reverse)
        if [ -n "$b" ]; then
            open $b
        else
            echo stop in order to no selection
            false
        fi
    else
        case $1 in
        add)
            # bm add
            if [ -z "$2" ]; then
                echo url is required
                false
            else
                >> $bm_file echo $2
                cat $bm_file | sort -u -o $bm_file
            fi
            ;;
        *)
            echo not exisits command like $1
            false
            ;;
        esac
    fi
}
