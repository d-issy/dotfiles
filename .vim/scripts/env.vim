function! s:load_vimrc_env()
  let l:env = {}

  let l:is_windows = has('win16') || has('win32') || has('win64')
  let l:is_cygwin = has('win32unix')
  let l:is_mac = !l:is_windows && !l:is_cygwin
        \ && (has('mac') || has('macunix') || has('gui_macvim') ||
        \    (!executable('xdg-open') &&
        \    system('uname') =~? '^darwin'))
  let l:is_linux = !l:is_mac && has('unix')

  let l:is_gui      = has('gui_running')

  if l:is_windows
    let l:env.os = 'windows'
  elseif l:is_mac
    let l:env.os = 'mac'
  elseif l:is_linux
    let l:env.os = 'linux'
  else
    let l:env.os = 'unkown'
  endif

  if l:is_windows
    let l:env.vimpath = expand($HOME.'/vimfiles')
  else
    let l:env.vimpath = expand($HOME.'/.vim')
  endif

  if l:is_gui
    let l:env.gui = g:true
  else
    let l:env.gui = g:false
  endif

  return l:env
endfunction

let g:env =  s:load_vimrc_env()
