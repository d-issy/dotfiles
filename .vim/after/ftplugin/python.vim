setlocal cindent
setlocal smarttab
setlocal expandtab

setlocal tabstop=8
setlocal softtabstop=4
setlocal shiftwidth=4

setlocal textwidth=80
setlocal colorcolumn=80

" TODO: Automatically change sys.path according to your environment

python3 << EOF
import os
import sys

sys.path = [
    '',
    '/Users/shepabashi/.anyenv/envs/pyenv/versions/3.6.2/lib/python36.zip',
    '/Users/shepabashi/.anyenv/envs/pyenv/versions/3.6.2/lib/python3.6',
    '/Users/shepabashi/.anyenv/envs/pyenv/versions/3.6.2/lib/python3.6/lib-dynload',
    '/Users/shepabashi/.anyenv/envs/pyenv/versions/3.6.2/lib/python3.6/site-packages'
]
EOF

" jedi plugin
let g:jedi#popup_on_dot = 0
