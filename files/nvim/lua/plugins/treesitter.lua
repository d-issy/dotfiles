return {
  {
    "nvim-treesitter/nvim-treesitter",
    event = { "BufReadPost" },
    build = ":TSUpdate",
    config = function()
      local wanted = { "diff", "lua", "luadoc", "markdown", "markdown_inline", "printf", "vim", "vimdoc" }
      local installed = require("nvim-treesitter.config").get_installed()
      local to_install = vim.iter(wanted)
        :filter(function(p) return not vim.tbl_contains(installed, p) end)
        :totable()
      if #to_install > 0 then
        require("nvim-treesitter").install(to_install)
      end

      vim.api.nvim_create_autocmd("FileType", {
        group = vim.api.nvim_create_augroup("treesitter-start", { clear = true }),
        callback = function(args)
          if require("util.file").is_big() then
            return
          end
          local lang = vim.treesitter.language.get_lang(vim.bo[args.buf].filetype)
          if lang and not vim.list_contains({ "help" }, lang) then
            pcall(vim.treesitter.start, args.buf)
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
