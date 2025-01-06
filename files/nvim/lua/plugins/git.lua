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
}
