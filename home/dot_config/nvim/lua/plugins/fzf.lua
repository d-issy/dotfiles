return {
  "ibhagwan/fzf-lua",
  cmd = "FzfLua",
  opts = function()
    local actions = require "fzf-lua.actions"
    return {
      keymap = {
        fzf = {
          ["ctrl-q"] = "select-all+accept",
        },
      },
      files = {
        cwd_prompt = false,
      },
      git = {
        status = {
          previewer = "git_diff",
          actions = {
            ["ctrl-g"] = { actions.git_stage_unstage, actions.resume },
            ["ctrl-d"] = { fn = actions.git_reset, reload = true },
            -- ignore default
            ["right"] = false,
            ["left"] = false,
            ["ctrl-x"] = false,
          },
        },
      },
    }
  end,
  keys = {
    { "<leader>'", "<cmd>FzfLua marks<cr>", desc = "Marks" },
    { '<leader>"', "<cmd>FzfLua registers<cr>", desc = "Registers" },
    { "<leader>,", "<cmd>FzfLua buffers<cr>", desc = "Buffers" },
    { "<leader>/", "<cmd>FzfLua live_grep<cr>", desc = "Grep" },
    { "<leader><space>", "<cmd>FzfLua files<cr>", desc = "Files" },
    { "<leader>fa", "<cmd>FzfLua builtin<cr>", desc = "Actions" },
    { "<leader>fd", "<cmd>FzfLua lsp_document_diagnostics<cr>", desc = "Diagnostics" },
    { "<leader>ff", "<cmd>FzfLua files<cr>", desc = "Files" },
    { "<leader>fh", "<cmd>FzfLua help_tags<cr>", desc = "Help" },
    { "<leader>fk", "<cmd>FzfLua keymaps<cr>", desc = "Keymaps" },
    { "<leader>fl", "<cmd>FzfLua blines<cr>", desc = "Lines" },
    { "<leader>fs", "<cmd>FzfLua spell_suggest<cr>", desc = "Spell Suggest" },
    { "<leader>gs", "<cmd>FzfLua git_status<cr>", desc = "Git Status" },
  },
}
