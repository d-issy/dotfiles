return {
  "nvim-telescope/telescope.nvim",
  dependencies = { "noice.nvim" },
  cmd = { "Telescope" },
  opts = function()
    local actions = require "telescope.actions"
    return {
      defaults = {
        layout_config = {
          horizontal = {
            prompt_position = "top",
          },
        },
        sorting_strategy = "ascending",
      },
      pickers = {
        buffers = {
          mappings = {
            i = {
              ["<c-d>"] = actions.delete_buffer + actions.move_to_top,
            },
          },
        },
      },
    }
  end,
  keys = {
    { "<leader>,", "<leader>fb", remap = true },
    { "<leader>/", "<leader>fg", remap = true },
    { "<leader><space>", "<leader>ff", remap = true },
    { "<leader>fa", "<cmd>Telescope<cr>", desc = "Find Actions" },
    { "<leader>fb", "<cmd>Telescope buffers<cr>", desc = "Find Buffers" },
    { "<leader>ff", "<cmd>Telescope find_files<cr>", desc = "Find Files" },
    { "<leader>fg", "<cmd>Telescope live_grep<cr>", desc = "Git Grep" },
    { "<leader>fh", "<cmd>Telescope help_tags<cr>", desc = "Find Help" },
    { "<leader>fk", "<cmd>Telescope keymaps<cr>", desc = "FInd Keymaps" },
    { "<leader>fn", "<cmd>Telescope noice<cr>", desc = "Noice Mesasges" },
    { "<leader>fs", "<cmd>Telescope spell_suggest<cr>", desc = "Spell Suggest" },
    { "<leader>gs", "<cmd>Telescope git_status<cr>", desc = "Git Status" },
  },
}
