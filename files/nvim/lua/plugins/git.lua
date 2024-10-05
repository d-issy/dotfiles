local map = require "util.map"

return {
  {
    "lewis6991/gitsigns.nvim",
    event = { "BufReadPost" },
    opts = {
      signs = {
        add = { text = "▎" },
        change = { text = "▎" },
        delete = { text = "" },
        topdelete = { text = "" },
        changedelete = { text = "▎" },
        untracked = { text = "▎" },
      },
      on_attach = function(buffer)
        local gs = require "gitsigns"

        local nav_hunk = function(direction)
          return function()
            gs.nav_hunk(direction)
          end
        end

        map.setup({
          { "]h", nav_hunk "next", desc = "Next Hunk" },
          { "[h", nav_hunk "prev", desc = "Prev Hunk" },
          { "]H", nav_hunk "last", desc = "Last Hunk" },
          { "[H", nav_hunk "first", desc = "First Hunk" },
          { "<leader>gb", gs.blame, desc = "Blame Buffer" },
          { "<leader>ghR", gs.reset_buffer, desc = "Reset Buffer" },
          { "<leader>ghS", gs.stage_buffer, desc = "Stage Buffer" },
          { "<leader>ghd", gs.diffthis, desc = "Diff This" },
          { "<leader>ghp", gs.preview_hunk_inline, desc = "Preview Hunk Inline" },
          { "<leader>ghr", ":Gitsigns reset_hunk<CR>", mode = { "n", "v" }, desc = "Reset Hunk" },
          { "<leader>ghs", ":Gitsigns stage_hunk<CR>", mode = { "n", "v" }, desc = "Stage Hunk" },
          { "<leader>ghu", gs.undo_stage_hunk, desc = "Undo Stage Hunk" },
          { "ih", ":<C-U>Gitsigns select_hunk<CR>", mode = { "o", "x" }, desc = "GitSigns Select Hunk" },
          -- stylua: ignore start
          { "<leader>ghb", function() gs.blame_line{ full = true } end, desc="Blame Line" },
          { "<leader>ghD", function() gs.diffthis("~") end, desc="Diff This ~" },
          --stylua: ignore end
        }, { buffer = buffer })
      end,
    },
  },
  {
    "sindrets/diffview.nvim",
    cmd = {
      "DiffviewOpen",
      "DiffviewClose",
      "DiffviewToggleFiles",
      "DiffviewFocusFiles",
      "DiffviewFileHistory",
      "DifviewRefresh",
    },
    keys = {
      { "<leader>gd", "<cmd>DiffviewOpen<cr>", desc = "Open DiffView" },
      { "<leader>gf", "<cmd>DiffviewFileHistory %<cr>", desc = "File History" },
    },
    opts = function()
      local actions = require "diffview.actions"
      local select_entry = function()
        actions.select_entry()
        actions.focus_entry()
      end
      return {
        qrsnhyg_netf = {
          DiffviewOpen = { "--imply-local" },
        },
        keymaps = {
          disable_defaults = false, -- Disable the default keymaps
          view = {
            { "n", "q", actions.close, { desc = "Close" } },
            { "n", "<c-e>", actions.goto_file_edit, { desc = "File Edit" } },
            { "n", "<c-t>", actions.goto_file, { desc = "File Eidt (Tab)" } },
            { "n", "<leader>x", actions.cycle_layout, { desc = "Cycle Layout" } },
            { "n", "]f", actions.select_next_entry, { desc = "Next File" } },
            { "n", "[f", actions.select_prev_entry, { desc = "Prev File" } },
            { "n", "<tab>", false },
            { "n", "<s-tab>", false },
          },
          file_panel = {
            { "n", "q", actions.close, { desc = "Close" } },
            { "n", "<leader>e", actions.focus_entry, { desc = "Focus Entry" } },
            { "n", "<cr>", select_entry, { desc = "Select Entry" } },
            { "n", "o", select_entry, { desc = "Select Entry" } },
            { "n", "l", select_entry, { desc = "Select Entry" } },
            { "n", "<2-LeftMouse>", select_entry, { desc = "Select Entry" } },
          },
          diff1 = {
            { "n", "q", actions.close, { desc = "Close" } },
          },
          diff2 = {
            { "n", "q", actions.close, { desc = "Close" } },
          },
          diff3 = {
            { "n", "q", actions.close, { desc = "Close" } },
          },
          diff4 = {
            { "n", "q", actions.close, { desc = "Close" } },
          },
          file_history_panel = {
            { "n", "q", actions.close, { desc = "Close" } },
            { "n", "<leader>e", actions.focus_entry, { desc = "Focus Entry" } },
          },
          option_panel = {
            { "n", "q", actions.close, { desc = "Close" } },
          },
          help_panel = {
            { "n", "q", actions.close, { desc = "Close" } },
          },
        },
      }
    end,
  },
}
