if exists('b:did_indent')
  finish
endif
let b:did_indent = 1

setlocal indentexpr=GetCSSIndent()
setlocal indentkeys=0{,0},o,O,!^F

let b:undo_indent = 'setlocal indentexpr< smartindent< autoindent< indentkeys<'

let s:cpo_save = &cpo
set cpo&vim

let s:skip = '!empty(filter(map(synstack(line("."), col(".")), ''synIDattr(v:val, "name")''), ' .
      \ '''v:val =~? "comment"''))'

function! GetCSSIndent()
  " v:lnum
  let line = getline(v:lnum)
  let pnum = searchpair('{','','}','nbW',s:skip)
  if pnum == 0 || v:lnum == pnum
    return -1
  endif
  if match(line, '}') != -1
    return indent(pnum)
  endif
  return indent(pnum) + shiftwidth()
endfunction

let &cpo = s:cpo_save
unlet s:cpo_save

