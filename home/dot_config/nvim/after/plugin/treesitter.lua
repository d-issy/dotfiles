local status_ok, configs = pcall(require, 'nvim-treesitter.configs')
if not status_ok then return end

configs.setup {
  sync_install = false,
  auto_install = true,
  ignore_install = {},
  indent = {
    enable = true,
    disabe = {},
  },
  highlight = {
    enable = true,
    disable = {
      'proto', -- Not working properly
    },
    additional_vim_regex_highlighting = true,
  },
  playground = {
    enable = true,
    disable = {},
    updatetime = 25,
    persist_queries = false,
    keybindings = {
      toggle_query_editor = 'o',
      toggle_hl_groups = 'i',
      toggle_injected_languages = 't',
      toggle_anonymous_nodes = 'a',
      toggle_language_display = 'I',
      focus_language = 'f',
      unfocus_language = 'F',
      update = 'R',
      goto_node = '<cr>',
      show_help = '?',
    },
  }
}
