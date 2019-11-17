self-insert() {
    zle .self-insert
    case $LBUFFER in
        ' e'   ) LBUFFER='export '         ;;
        ' gc'  ) LBUFFER='git clean -f'    ;;
        ' gs'  ) LBUFFER='git status'      ;;
        ' ts'  ) LBUFFER='tig status'      ;;
        'c '   ) LBUFFER='cd '             ;;
        'd '   ) LBUFFER='docker '         ;;
        'dc '  ) LBUFFER='docker-compose ' ;;
        'g '   ) LBUFFER='git '            ;;
        'ga '  ) LBUFFER='git add '        ;;
        'gb '  ) LBUFFER='git branch '     ;;
        'gbd ' ) LBUFFER='git branch -d '  ;;
        'gbdd ') LBUFFER='git branch -D '  ;;
        'gc '  ) LBUFFER='git checkout '   ;;
        'gcb ' ) LBUFFER='git checkout -b ';;
        'gcl ' ) LBUFFER='git clone '      ;;
        'gco ' ) LBUFFER='git commit '     ;;
        'gf '  ) LBUFFER='git fetch '      ;;
        'gpl ' ) LBUFFER='git pull '       ;;
        'gps ' ) LBUFFER='git push '       ;;
        'm '   ) LBUFFER='make '           ;;
        'mc '  ) LBUFFER='make -C '        ;;
        'mn '  ) LBUFFER='make -n '        ;;
        'mnc ' ) LBUFFER='make -n -C '     ;;
        'r '   ) LBUFFER='rm '             ;;
        'rr '  ) LBUFFER='rm -rf '         ;;
        'v '   ) LBUFFER='vim '            ;;

        'git pull  ') LBUFFER="git pull origin $(git symbolic-ref --short HEAD 2> /dev/null)";;
        'git push  ') LBUFFER="git push origin $(git symbolic-ref --short HEAD 2> /dev/null)";;
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
