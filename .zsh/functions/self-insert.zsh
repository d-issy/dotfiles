self-insert() {
    zle .self-insert
    case $LBUFFER in
        ' e'  ) LBUFFER='export '         ;;
        ' gs' ) LBUFFER='git status'      ;;
        ' ts' ) LBUFFER='tig status'      ;;
        'c '  ) LBUFFER='cd '             ;;
        'd '  ) LBUFFER='docker '         ;;
        'dc ' ) LBUFFER='docker-compose ' ;;
        'g '  ) LBUFFER='git '            ;;
        'ga ' ) LBUFFER='git add '        ;;
        'gb ' ) LBUFFER='git branch '     ;;
        'gc ' ) LBUFFER='git checkout '   ;;
        'gcl ') LBUFFER='git clone '      ;;
        'gco ') LBUFFER='git commit '     ;;
        'gf ' ) LBUFFER='git fetch '      ;;
        'gpl ') LBUFFER='git pull '       ;;
        'gps ') LBUFFER='git push '       ;;
        'm '  ) LBUFFER='make '           ;;
        'mc ' ) LBUFFER='make -C '        ;;
        'mn ' ) LBUFFER='make -n '        ;;
        'mnc ') LBUFFER='make -n -C '     ;;
        'v '  ) LBUFFER='vim '            ;;

        'git pull  ') LBUFFER='git pull origin ';;
        'git push  ') LBUFFER='git push origin ';;
        'nis ') LBUFFER='npm install --save ';;
        'nid ') LBUFFER='npm install --save-dev ';;

        'cd ')
            local dir=$(__cd::list | fzf --reverse --height=40%)
            LBUFFER="cd $dir"
            zle reset-prompt
            ;;
        *)
            ;;
    esac
}
zle -N self-insert
