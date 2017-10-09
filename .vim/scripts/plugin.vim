" UtiSnip
let g:UltiSnipsExpandTrigger = "<c-k>"
let g:UltiSnipsJumpForwardTrigger = "<c-j>"

" CtrlP
let g:ctrlp_map = ',,'
let g:ctrlp_show_hidden = 1
let g:ctrlp_custom_ignore = {
      \ 'dir':  '\v[\/](\.git|\.hg|\.idea|\.svn|plugged|node_modules|vendor)$',
      \ }

" NERDTree
let g:NERDTreeQuitOnOpen = 1
let g:NERDTreeShowHidden = 1
let g:NERDTreeIgnore = [
      \ '.git',
      \ '.hg',
      \ '.svn',
      \ '.idea',
      \ ]

" NERDCommenter
let g:NERDCreateDefaultMappings = 0
let g:NERDSpaceDelims = 1
let g:NERDCompactSexyComs = 1
let g:NERDDefaultAlign = 'left'

" syntastic
let g:syntastic_always_populate_loc_list = 1
let g:syntastic_auto_loc_list = 1
let g:syntastic_check_on_open = 1
let g:syntastic_check_on_wq = 0
let g:syntastic_mode_map = {
      \ "mode": "passive",
      \ "active_filetypes": [],
      \ "passive_filetypes": [] }

" GitGutter
set updatetime=250

" emmet
let g:user_emmet_leader_key='<c-e>'
let g:user_emmet_settings = {
      \  'variables': {
      \    'lang': 'ja',
      \  },
      \}

" javascript-libraries-syntax.vim
let g:used_javascript_libs = 'jquery,underscore,backbone,gularjs,angularui,angularuirouter,requirejs,sugar,jasmine,chai,ramda,react,flux,handlebars,d3,vue'

" jedi-vim
let g:jedi#popup_on_dot = 0
let g:jedi#goto_command = "<C-]>"
let g:jedi#goto_definitions_command = ""

" markdown
let g:vim_markdown_folding_disabled = 1
let g:vim_markdown_new_list_item_indent = 2
let g:vim_markdown_math = 1
let g:vim_markdown_frontmatter = 1
let g:vim_markdown_toml_frontmatter = 1
let g:vim_markdown_json_frontmatter = 1
let g:vim_markdown_fenced_languages = [
      \ 'c++=cpp',
      \ 'viml=vim',
      \ 'bash=sh',
      \ 'ini=dosini',
      \ 'go',
      \ 'html',
      \ 'javascript',
      \ 'json',
      \ 'python',
      \ ]
