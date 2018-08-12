" Scripts Loader Functions {{ 1
let g:false = 0
let g:true = 1

function! s:glob(base, pattern)
  return split(globpath(a:base, a:pattern), '[\r\n]')
endfunction

function! s:source(base, ...)
  let l:found = g:false
	for l:pattern in a:000
		for l:script in s:glob(a:base, l:pattern)
      if l:script =~? 'init'
        continue
      endif
      execute 'source' l:script
      let l:found = g:true
		endfor
	endfor
  return l:found
endfunction

function! s:load(...)
  let l:base = expand($HOME.'/.vim/scripts')
  let l:found = g:true

  if len(a:000)
    if index(a:000, g:false) != -1
      return g:false
    endif
    for l:file in a:000
      if !s:source(l:base, l:file)
        let l:found = s:source(base, '*[0-9]*_'.file)
      endif
    endfor
  else
    let l:found = s:source(base, '*')
  endif

  return l:found
endfunction
"end }}

" Scripts Load {{ 1
call s:load('env.vim')
call s:load('patch.vim')

if s:load('plug.vim')
  call s:load('plugin_settings.vim')
endif

call s:load('basic.vim')
call s:load('keybind.vim')
call s:load('statusline.vim')
call s:load('fold.vim')

if g:env.gui
  call s:load('gui.vim')
endif
"end }}
