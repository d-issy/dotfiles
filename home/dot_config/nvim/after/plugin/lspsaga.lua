local status_ok, saga = pcall(require, 'lspsaga')
if not status_ok then
  return
end

saga.setup {
  ui = {
    theme = 'round',
    -- border type can be single,double,rounded,solid,shadow.
    border = 'single',

    winblend = 0,
    expand = '',
    collapse = '',
    preview = ' ',
    code_action = '',
    diagnostic = '',
    incoming = ' ',
    outgoing = ' ',
  },
  border_style = 'plus',
  diagnostic_header = {},
  symbol_in_winbar = {
    enable = true,
    color_mode = false,
  },
}
