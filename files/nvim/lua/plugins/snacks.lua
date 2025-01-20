return {
  "folke/snacks.nvim",
  dependencies = { "todo-comments.nvim" },
  priority = 1000,
  lazy = false,
  opts = {
    bigfile = { enabled = true },
    gitbrowse = { enabled = true },
    indent = {
      enabled = true,
      indent = { only_current = true },
      chunk = {
        enabled = true,
        char = {
          corner_top = "╭",
          corner_bottom = "╰",
          horizontal = "─",
          vertical = "│",
          arrow = "─",
        },
      },
    },
    input = { enabled = true },
    notifier = {
      enabled = true,
      timeout = 3000,
    },
    picker = {
      sources = {
        buffers = { current = false },
        pickers = { layout = { preview = false } },
      },
    },
    quickfile = { enabled = true },
    scope = { enabled = true },
    scroll = {
      enabled = true,
      only_current = true,
      animate = {
        duration = { step = 10, total = 100 },
      },
    },
    toggle = { enabled = true },
    words = { enabled = true },
    styles = {
      input = {
        keys = {
          i_esc = { "<esc>", "stopinsert", mode = "i" },
          i_cr = { "<cr>", "confirm", mode = "i" },
          i_tab = { "<tab>", { "cmp_select_next", "cmp" }, mode = "i" },
          cr = { "<cr>", { "confirm" } },
          q = "cancel",
        },
      },
    },
  },
  keys = {
    { "<leader><space>", "<cmd>lua require('snacks').picker.smart()<cr>", desc = "Smart Search" },
    { "<leader>'", "<cmd>lua require('snacks').picker.marks()<cr>", desc = "Marks" },
    { '<leader>"', "<cmd>lua require('snacks').picker.registers()<cr>", desc = "Registers" },
    { "<leader>,", "<cmd>lua require('snacks').picker.buffers()<cr>", desc = "Buffers" },
    { "<leader>/", "<cmd>lua require('snacks').picker.grep()<cr>", desc = "Grep" },
    { "<leader>fa", "<cmd>lua require('snacks').picker.pickers()<cr>", desc = "Actions" },
    { "<leader>ff", "<cmd>lua require('snacks').picker.files()<cr>", desc = "Files" },
    { "<leader>fh", "<cmd>lua require('snacks').picker.help()<cr>", desc = "Actions" },
    { "<leader>fl", "<cmd>lua require('snacks').picker.lines()<cr>", desc = "Lines" },
    { "<leader>fu", "<cmd>lua require('snacks').picker.undo()<cr>", desc = "Undo" },
    { "<leader>fs", "<cmd>lua require('snacks').picker.spelling()<cr>", desc = "Spell" },
    { "<leader>z", "<cmd>lua require('snacks').zen.zoom()<cr>", desc = "Zoom" },
    { "<leader>gs", "<cmd>lua require('snacks').picker.git_status()<cr>", desc = "Git Status" },
    { "gd", "<cmd>lua require('snacks').picker.lsp_definitions()<cr>", desc = "LSP Definitions" },
    { "gG", "<cmd>lua require('snacks').picker.lsp_declarations()<cr>", desc = "LSP Declarations" },
    { "gr", "<cmd>lua require('snacks').picker.lsp_references()<cr>", desc = "LSP References" },
    { "gi", "<cmd>lua require('snacks').picker.lsp_implementations()<cr>", desc = "LSP Implementation" },
    { "gI", "<cmd>lua require('snacks').picker.lsp_type_definitions()<cr>", desc = "LSP Type Definition" },
    { "<leader>cs", "<cmd>lua require('snacks').picker.lsp_symbols()<cr>", desc = "LSP Symbols" },
    { "<leader>cd", "<cmd>lua require('snacks').picker.diagnostics_buffer()<cr>", desc = "Diagnostic" },
    { "<leader>cD", "<cmd>lua require('snacks').picker.diagnostics()<cr>", desc = "Diagnostic (Workspace)" },
    { "<leader>cS", "<cmd>lua require('snacks').picker.lsp_workspace_symbols()<cr>", desc = "LSP Symbols (Workspace)" },
    { "<leader>cR", "<cmd>lua require('snacks').rename.rename_file()<cr>", desc = "File Rename" },
    { "<leader>ca", vim.lsp.buf.code_action, desc = "LSP Code Action" },
    { "<leader>cr", vim.lsp.buf.rename, desc = "LSP Rename" },
    { "<leader>ft", "<cmd>lua require('snacks').picker.todo_comments()<cr>", desc = "Todo" },
    {
      "<leader>fT",
      "<cmd>lua require('snacks').picker.todo_comments({ keywords = { 'TODO', 'FIX', 'FIXME' } })<cr>",
      desc = "Todo/Fix/Fixme",
    },
    {
      "<leader>gB",
      "<cmd>lua require('snacks').gitbrowse.open({ what = 'commit' })<cr>",
      mode = { "n", "v" },
      desc = "Open commit",
    },
  },
  init = function()
    local snacks = require "snacks"

    snacks.toggle.option("relativenumber", { name = "Relative Number" }):map "<leader>ur"
    snacks.toggle.option("spell", { name = "Spell" }):map "<leader>us"
    snacks.toggle.option("wrap", { name = "Wrap" }):map "<leader>uw"
    snacks.toggle.diagnostics():map "<leader>ud"
    snacks.toggle.line_number():map "<leader>un"
    snacks.toggle.indent():map "<leader>ug"
  end,
}
