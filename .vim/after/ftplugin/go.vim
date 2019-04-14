setlocal noexpandtab

let g:go_addtags_transform='camelcase'
let g:go_fmt_command = 'gofmt'

let g:go_doc_keywordprg_enabled = 0

let g:go_highlight_array_whitespace_error = 1
let g:go_highlight_build_constraints = 1
let g:go_highlight_chan_whitespace_error = 1
let g:go_highlight_extra_types = 1
let g:go_highlight_fields = 1
let g:go_highlight_format_strings = 1
let g:go_highlight_functions = 1
let g:go_highlight_generate_tags = 1
let g:go_highlight_methods = 1
let g:go_highlight_operators = 1
let g:go_highlight_space_tab_error = 1
let g:go_highlight_string_spellcheck = 1
let g:go_highlight_trailing_whitespace_error = 1
let g:go_highlight_types = 1
let g:go_highlight_variable_assignments = 1

let g:go_template_autocreate = 0

if g:plug.is_enabled('vim-go')
  nnoremap <buffer> <silent><Leader>r   :GoRename<CR>
  nnoremap <buffer> <silent><Leader>t   :GoDecls<CR>
  nnoremap <buffer> <silent><Leader>f   :GoImports<CR>
  nnoremap <buffer> <silent><Leader>ga  :GoAddTags 
  nnoremap <buffer> <silent><Leader>gc  :GoCoverageToggle<CR>
  nnoremap <buffer> <silent><Leader>gd  :GoDeclsDir<CR>
  nnoremap <buffer> <silent><Leader>ge  :GoIfErr<CR>
  nnoremap <buffer> <silent><Leader>gf  :GoTestFunc<CR>
  nnoremap <buffer> <silent><Leader>gg  :GoTest<CR>
  nnoremap <buffer> <silent><Leader>gj  :GoAddTags<CR>
  nnoremap <buffer> <silent><Leader>gr  :GoRemoveTags<CR>
  nnoremap <buffer> <silent><Leader>gs  :GoInfo<CR>
  nnoremap <buffer> <silent><Leader>gt  :GoAlternate!<CR>
  nnoremap <buffer> <Leader>i  :GoImport 
endif

if g:plug.is_enabled('vim-lsp')
  setlocal omnifunc=lsp#complete
endif
