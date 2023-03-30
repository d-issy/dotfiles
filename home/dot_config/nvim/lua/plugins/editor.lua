return {
  -- search/replace
  {
    "windwp/nvim-spectre",
    opts = { live_update = true },
    keys = { { "<leader>sr", function() require("spectre").open() end, desc = "Replace in files (Spectre)" } },
  },

  -- hop
  {
    "phaazon/hop.nvim",
    version = "v2.*",
    opts = {
      -- @cspell: disable-next
      keys = "etovxqpdygfblzhckisuran",
    },
    keys = {
      { "<leader>K", "<cmd>HopLineStartBC<cr>", mode = { "n", "v", "s", "o" }, desc = "jump LineStartBC" },
      { "<leader>J", "<cmd>HopLineStartAC<cr>", mode = { "n", "v", "s", "o" }, desc = "jump LineStartAC" },
      { "<leader>k", "<cmd>HopWordBC<cr>", mode = { "n", "v", "s", "o" }, desc = "jump WordBC" },
      { "<leader>j", "<cmd>HopWordAC<cr>", mode = { "n", "v", "s", "o" }, desc = "jump WordAC" },
      { "<leader>N", "<cmd>HopPatternBC<cr>", mode = { "n", "v", "s", "o" }, desc = "jump Pattern BC" },
      { "<leader>n", "<cmd>HopPatternAC<cr>", mode = { "n", "v", "s", "o" }, desc = "jump Pattern AC" },
    },
  },

  -- which-key
  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    opts = {
      plugins = { spelling = true },
    },
    config = function(_, opts)
      local wk = require "which-key"
      wk.setup(opts)
      wk.register {
        mode = { "n", "v" },
        ["g"] = { name = "+goto" },
        ["gz"] = { name = "+surround" },
        ["]"] = { name = "+next" },
        ["["] = { name = "+prev" },
        ["<leader>t"] = { name = "+tabs" },
        ["<leader>b"] = { name = "+buffer" },
        ["<leader>c"] = { name = "+code" },
        ["<leader>f"] = { name = "+file/find" },
        ["<leader>g"] = { name = "+git" },
        ["<leader>gh"] = { name = "+hunks" },
        ["<leader>q"] = { name = "+quit/session" },
        ["<leader>s"] = { name = "+search" },
        ["<leader>sn"] = { name = "+notify" },
        ["<leader>u"] = { name = "+ui" },
        ["<leader>w"] = { name = "+windows" },
        ["<leader>x"] = { name = "+diagnostics/quickfix" },
      }
    end,
  },

  -- git signs
  -- @cSpell: words gitsigns
  {
    "lewis6991/gitsigns.nvim",
    event = "BufReadPre",
    opts = {
      on_attach = function(buffer)
        local gs = package.loaded.gitsigns

        local function map(mode, l, r, desc) vim.keymap.set(mode, l, r, { buffer = buffer, desc = desc }) end

        map("n", "]h", gs.next_hunk, "Next Hunk")
        map("n", "[h", gs.prev_hunk, "Prev Hunk")
        map({ "n", "v" }, "<leader>ghs", ":Gitsigns stage_hunk<CR>", "Stage Hunk")
        map({ "n", "v" }, "<leader>ghr", ":Gitsigns reset_hunk<CR>", "Reset Hunk")
        map("n", "<leader>ghS", gs.stage_buffer, "Stage Buffer")
        map("n", "<leader>ghu", gs.undo_stage_hunk, "Undo Stage Hunk")
        map("n", "<leader>ghR", gs.reset_buffer, "Reset Buffer")
        map("n", "<leader>ghp", gs.preview_hunk, "Preview Hunk")
        map("n", "<leader>ghb", function() gs.blame_line { full = true } end, "Blame Line")
        map("n", "<leader>ghd", gs.diffthis, "Diff This")
        map("n", "<leader>ghD", function() gs.diffthis "~" end, "Diff This ~")
        map({ "o", "x" }, "ih", ":<C-U>Gitsigns select_hunk<CR>", "GitSigns Select Hunk")
      end,
    },
  },

  -- better diagnostics list and others
  {
    "folke/trouble.nvim",
    cmd = { "TroubleToggle", "Trouble" },
    opts = { use_diagnostic_signs = true },
    keys = {
      {
        "<leader>xx",
        "<cmd>TroubleToggle document_diagnostics<cr>",
        desc = "Document Diagnostics (Trouble)",
      },
      {
        "<leader>xX",
        "<cmd>TroubleToggle workspace_diagnostics<cr>",
        desc = "Workspace Diagnostics (Trouble)",
      },
    },
  },
}
