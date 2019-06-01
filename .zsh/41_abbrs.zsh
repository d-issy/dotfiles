# system
abbr e   'export'
abbr m   'make'
abbr mc  'make -C'
abbr mn  'make -n'
abbr mnc 'make -n -C'

# git
abbr g   'git'

abbr ga  'git add'
abbr gf  'git fetch'
abbr gs  'git status'
abbr gb  'git branch'
abbr gc  'git checkout'
abbr gco 'git commit'
abbr gpl 'git pull'
abbr gps 'git push'
abbr gst 'git stash'
abbr gsp 'git stash pop'

abbr 'git checkout' 'git checkout --'
abbr 'git pull' 'git pull origin'
abbr 'git push' 'git push origin'

# docker
abbr d      'docker'
abbr dc     'docker-compose'
abbr dps    'docker ps'
abbr dstart 'docker start'
abbr dstop  'docker stop'

# tig
abbr ts 'tig status'

# npm
abbr nis 'npm install --save'
abbr nid 'npm install --save-dev'

# inc
## system
abbr c cd inc='find . -type d -mindepth 1 -maxdepth 6 | sed "s/\.\///"'

## system
abbr rm rm inc='find . -type f -maxdepth 8 | grep -v /.git/ | sed "s/\.\///"'
abbr rr 'rm -rf' inc='find . -type d -mindepth 1 -maxdepth 6 | sed "s/\.\///"'

## vim
abbr v vim inc='find . -type f -maxdepth 8 | grep -v /.git/ | sed "s/\.\///"'
