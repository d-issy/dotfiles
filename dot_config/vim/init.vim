function! s:load(script)
  let l:path = expand($XDG_CONFIG_HOME . '/vim/' . a:script)
  if file_readable(l:path)
    execute 'source' l:path
  endif
endfunction

call s:load('plug.vim')
call s:load('fold.vim')
call s:load('basic.vim')
call s:load('keybind.vim')
