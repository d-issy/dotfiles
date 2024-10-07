return {
  "stevearc/oil.nvim",
  cmd = "Oil",
  keys = {
    {
      "<leader>e",
      function()
        require("oil").toggle_float()
      end,
      desc = "Files",
    },
    {
      "<leader>E",
      function()
        require("oil").open()
      end,
      desc = "Files",
    },
  },
  opts = {
    use_default_keymaps = false,
    keymaps = {
      ["q"] = "actions.close",
      ["g?"] = "actions.show_help",
      ["<C-s>"] = { "actions.select", opts = { vertical = true }, desc = "Open the entry in a vertical split" },
      ["<C-b>"] = { "actions.select", opts = { horizontal = true }, desc = "Open the entry in a horizontal split" },
      ["<C-t>"] = { "actions.select", opts = { tab = true }, desc = "Open the entry in new tab" },
      ["<C-p>"] = "actions.preview",
      ["<C-r>"] = "actions.refresh",
      ["<C-h>"] = "actions.parent",
      ["<C-l>"] = "actions.select",
      ["<BS>"] = "actions.open_cwd",
      [";"] = "<cmd>w<cr>",
      ["`"] = "actions.cd",
      ["~"] = { "actions.cd", opts = { scope = "tab" }, desc = ":tcd to the current oil directory", mode = "n" },
      ["gs"] = "actions.change_sort",
      ["gx"] = "actions.open_external",
      ["g."] = "actions.toggle_hidden",
      ["g\\"] = "actions.toggle_trash",
    },
    columns = {
      "icon",
      "size",
      "permissions",
      "mtime",
    },
  },
}
