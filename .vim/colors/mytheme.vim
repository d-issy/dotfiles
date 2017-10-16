" mytheme
let g:colors_name = expand('<sfile>:t:r')
set background=dark
highlight clear

if exists('sytax_on')
  syntax reset
endif

" Basic
highlight Normal ctermfg=255
highlight IncSearch ctermfg=186

" Comment
highlight Comment ctermfg=102

" Constant
highlight Constant ctermfg=141
highlight Boolean ctermfg=141
highlight String ctermfg=185
highlight Character ctermfg=185
highlight Number ctermfg=141
highlight Float ctermfg=141

" Special
highlight Special ctermfg=81
highlight Tag ctermfg=197
highlight SpecialChar ctermfg=197
highlight Delimiter ctermfg=245
highlight SpecialComment ctermfg=240
highlight Debug ctermfg=138

" Identifier
highlight Identifier ctermfg=208
highlight Function ctermfg=112

" Statement
highlight Statement ctermfg=197
highlight Conditional ctermfg=197
highlight Repeat ctermfg=197
highlight Label ctermfg=185
highlight Operator ctermfg=197
highlight Keyword ctermfg=197
highlight Exception ctermfg=112

" PreProc
highlight PreProc ctermfg=112
highlight Include ctermfg=197
highlight Define ctermfg=81
highlight Macro ctermfg=186
highlight PreCondit ctermfg=112

" Type
highlight Type ctermfg=81
highlight StorageClass ctermfg=208
highlight Structure ctermfg=81
highlight Typedef ctermfg=81

" Error
highlight Error ctermfg=89

" Todo
highlight Error ctermfg=15 ctermbg=235

" Python
highlight pythonInclude ctermfg=197
highlight pythonException ctermfg=196
highlight pythonBuiltin ctermfg=81
highlight pythonOperator ctermfg=197





