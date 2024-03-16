return {
  {
    "nvim-cmp",
    opts = function(_, opts)
      -- no selection first time
      local cmp = require "cmp"
      opts.mapping = vim.tbl_deep_extend("force", opts.mapping, {
        ["<CR>"] = cmp.mapping.confirm { select = false },
      })
      opts.preselect = cmp.PreselectMode.None
      opts.completion = {
        completeopt = "menu,menuone,noinsert,noselect",
      }
    end,
  },
  {
    "LuaSnip",
    keys = {
      {
        "<C-l>",
        function() require("luasnip").expand_or_jump() end,
        mode = { "i", "s" },
      },
      {
        "<C-k>",
        function()
          if require("luasnip").choice_active() then
            require("luasnip").change_choice(1)
          else
            require("luasnip").jump(-1)
          end
        end,
        mode = { "i", "s" },
      },
    },
    config = function()
      local luasnip = require "luasnip"
      local from_lua = require "luasnip.loaders.from_lua"

      luasnip.setup { update_events = "TextChanged,TextChangedI" }
      from_lua.lazy_load { paths = "~/.config/nvim/lua/snippets/" }

      vim.api.nvim_create_autocmd("InsertLeave", {
        pattern = "*",
        callback = function()
          if luasnip.session.current_nodes[vim.api.nvim_get_current_buf()] then
            luasnip.unlink_current()
          end
        end,
      })
    end,
  },
  { "windwp/nvim-autopairs", event = "InsertEnter", config = true },
}
