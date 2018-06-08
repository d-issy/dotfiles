if exists('b:did_indent')
  finish
endif
let b:did_indent = 1

setlocal indentexpr=GetJavascriptIndent()
setlocal autoindent nolisp nosmartindent
setlocal indentkeys=0{,0},0),0],0.,:,0#,!^F,o,O,e,>

let b:undo_indent = 'setlocal indentexpr< smartindent< autoindent< indentkeys<'

let s:cpo_save = &cpo
set cpo&vim

let s:skip = '!empty(filter(map(synstack(line("."), col(".")), ''synIDattr(v:val, "name")''), ' .
      \ '''v:val =~? "string\\|character\\|singlequote\\|escape\\|comment"''))'

function! IsComment(lnum)
  let l:syn_st = synstack(a:lnum,strlen(getline(a:lnum)))
  return len(l:syn_st) != 0 && synIDattr(l:syn_st[-1],'name') =~? 'comment\|doc'
endfunction

function! GoBackSkipingComment(lnum)
  let l:n = a:lnum
  while IsComment(l:n) && l:n > 1
    let l:n = l:n - 1
  endwhile
  return l:n
endfunction

function! GetTrimLine(lnum)
  return trim(getline(a:lnum))
endfunction

function! SearchPair(ch)
  if a:ch == 'B'
    return searchpair('{','','}','nbW',s:skip)
  endif
  if a:ch == 'b'
    return searchpair('(','',')','nbW',s:skip)
  endif
  if a:ch == '['
    return searchpair('[','',']','nbW',s:skip)
  endif
endfunction

function! GetJavascriptIndent()
  let lnum  = v:lnum
  " ignore comment
  if IsComment(lnum)
    return -1
  endif
  " variable definition
  let level = 0
  let line  = GetTrimLine(lnum)
  let len   = strlen(line)
  let pnum  = GoBackSkipingComment(prevnonblank(lnum-1))
  let pline = GetTrimLine(pnum)
  let plen  = strlen(pline)
  " brace
  if len > 0
    if line[0] == '}'
      return indent(SearchPair('B'))
    elseif line[0] =~ '[)\]]'
      let level -= 1
    endif
  endif
  if  pline =~ '[{(\[][^})\]]*$'
    let level += 1
  endif
  " switch
  if pline =~ '^case\s.\+:'
    let level += 1
  endif
  if pline =~ '^default:'
    let level += 1
  endif
  if pline =~ 'break'
    let level -= 1
  endif
  " dot
  if plen > 0 && pline[0] != '.' && pline[-1:] == ')'
        \  && len > 0 && line[0] == '.'
    let level += 1
  endif
  " jsx
  if pline =~ '<\a[-0-9A-Za-z]*$'
    let level += 1
  elseif pline =~ '\([{(\[]\)\@<!<\a[-0-9A-Za-z]*[^>/]*>$'
    let level += 1
  elseif pline =~ '^}*>'
    let level += 1
  elseif pline =~ '^[^<>]\+/>'
    let level -= 1
  endif
  if line =~ '^</\a[-0-9A-Za-z]*[^>]*>'
    let level -= 1
  elseif line =~ '^}*/\?>'
    let level -= 1
  endif
  return max([0,indent(pnum)+level*&l:sw])
endfunction

let &cpo = s:cpo_save
unlet s:cpo_save
