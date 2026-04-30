return {
  {
    "nvim-treesitter/nvim-treesitter",
    branch = "main",
    event = { "BufReadPost" },
    build = ":TSUpdate",
    config = function()
      local treesitter = require "nvim-treesitter"
      local treesitter_config = require "nvim-treesitter.config"
      local available = treesitter_config.get_available()

      local wanted = { "diff", "lua", "luadoc", "markdown", "markdown_inline", "printf", "vim", "vimdoc" }
      local to_install = vim
        .iter(wanted)
        :filter(function(p)
          return not vim.tbl_contains(treesitter_config.get_installed(), p)
        end)
        :totable()
      if #to_install > 0 then
        treesitter.install(to_install)
      end

      vim.api.nvim_create_autocmd("FileType", {
        group = vim.api.nvim_create_augroup("treesitter-start", { clear = true }),
        callback = function(args)
          if require("util.file").is_big() then
            return
          end
          local lang = vim.treesitter.language.get_lang(vim.bo[args.buf].filetype)
          if not lang or vim.list_contains({ "help" }, lang) then
            return
          end
          if not vim.list_contains(available, lang) then
            return
          end
          if vim.list_contains(treesitter_config.get_installed(), lang) then
            pcall(vim.treesitter.start, args.buf)
          else
            treesitter.install({ lang }):await(function()
              if vim.api.nvim_buf_is_valid(args.buf) then
                pcall(vim.treesitter.start, args.buf)
              end
            end)
          end
        end,
      })
    end,
  },
  {
    "nvim-treesitter/nvim-treesitter-context",
    event = { "BufReadPost" },
    opts = {
      max_lines = 5,
    },
    config = function(_, opts)
      require("treesitter-context").setup(opts)
    end,
  },
}
