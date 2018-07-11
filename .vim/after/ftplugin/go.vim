setlocal noexpandtab

let g:go_addtags_transform='camelcase'
let g:go_fmt_command = "goimports"

let g:go_gocode_unimported_packages = 1
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

let g:go_template_autocreate = 0

if g:plug.is_enabled('vim-go')
  nnoremap <buffer> <silent><Leader>r   :GoRename<CR>
  nnoremap <buffer> <silent><Leader>i   :GoInfo<CR>
  nnoremap <buffer> <silent><Leader>ga  :GoAddTags<CR>
  nnoremap <buffer> <silent><Leader>gcd :GoCoverage<CR>
  nnoremap <buffer> <silent><Leader>gcc :GoCoverageClear<CR>
  nnoremap <buffer> <silent><Leader>gdd :GoDeclsDir<CR>
  nnoremap <buffer> <silent><Leader>gdg :GoDecls<CR>
  nnoremap <buffer> <silent><Leader>ge  :GoIfErr<CR>
  nnoremap <buffer> <silent><Leader>gf  :GoTestFunc<CR>
  nnoremap <buffer> <silent><Leader>gg  :GoTest<CR>
  nnoremap <buffer> <silent><Leader>gr  :GoRemoveTags<CR>
  nnoremap <buffer> <silent><Leader>gt  :GoAlternate<CR>
endif
