return {
  -- file explorer
  -- @cSpell: words Neotree
  {
    "nvim-neo-tree/neo-tree.nvim",
    cmd = "Neotree",
    branch = "v2.x",
    keys = {
      {
        "<leader>e",
        function() require("neo-tree.command").execute { toggle = true } end,
        desc = "Explorer NeoTree (root dir)",
      },
    },
    init = function()
      vim.g.neo_tree_remove_legacy_commands = 1
      if vim.fn.argc() == 1 then
        local stat = vim.loop.fs_stat(vim.fn.argv(0))
        if stat and stat.type == "directory" then
          require "neo-tree"
        end
      end
    end,
    opts = {
      filesystem = {
        bind_to_cwd = false,
        follow_current_file = true,
        filtered_items = {
          visible = true,
          never_show = { ".git" },
        },
      },
      window = {
        mappings = { ["<space>"] = "none" },
      },
    },
  },

  -- search/replace
  {
    "windwp/nvim-spectre",
    opts = { live_update = true },
    keys = { { "<leader>sr", function() require("spectre").open() end, desc = "Replace in files (Spectre)" } },
  },

  -- telescope
  {
    "nvim-telescope/telescope.nvim",
    cmd = "Telescope",
    branch = "0.1.x",
    opts = {
      defaults = {
        file_ignore_patterns = {
          ".git",
          ".venv",
          "node_modules",
        },
      },
      pickers = {
        buffers = { theme = "ivy", show_all_buffers = true },
        colorscheme = { enable_preview = true },
        find_files = { theme = "ivy", hidden = true },
        help_tags = { theme = "ivy" },
        live_grep = { theme = "ivy" },
      },
    },
    keys = {
      { "<leader>,", "<cmd>Telescope buffers<cr>", desc = "Buffers" },
      { "<leader>/", "<cmd>Telescope live_grep<cr>", desc = "Grep" },
      { "<leader>p", "<cmd>Telescope find_files<cr>", desc = "Find Files" },
      { "<leader>sh", "<cmd>Telescope help_tags<cr>", desc = "Help Page" },
      { "<leader>uc", "<cmd>Telescope colorscheme<cr>", desc = "Colorscheme with preview" },
    },
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
