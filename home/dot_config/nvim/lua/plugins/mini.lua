return {
  { "echasnovski/mini.nvim", version = "*" },
  {
    "echasnovski/mini.files",
    version = "*",
    opts = {
      mappings = {
        synchronize = ";",
      },
    },
    config = function(_, opts)
      local mini_files = require "mini.files"
      mini_files.setup(opts)

      local augroup = function(name)
        return vim.api.nvim_create_augroup("mini_files_" .. name, { clear = true })
      end

      local ns_mini_files_git = vim.api.nvim_create_namespace "mini_files_git"
      vim.api.nvim_create_autocmd("User", {
        group = augroup "border",
        pattern = "MiniFilesWindowOpen",
        callback = function(args)
          local win = args.data.win_id
          local config = vim.api.nvim_win_get_config(win)
          config.border = require("util.border").generate "MiniFilesBorder"
          vim.api.nvim_win_set_config(win, config)
        end,
      })

      vim.api.nvim_create_autocmd("User", {
        group = augroup "status",
        pattern = "MiniFilesBufferUpdate",
        callback = function(args)
          ---@type table<string, {text: string, hl: string}>
          local sign = {}

          -- git
          local git = require "util.git"
          local git_root = git.root()
          if git_root ~= nil then
            local status = git.get_status(git_root)
            for path, flags in pairs(status) do
              if flags.unstaged == git.FLAGS.RENAMED then
                sign[path] = { text = "~", hl = "MiniFilesChange" }
              elseif flags.unstaged == git.FLAGS.MODIFIED then
                sign[path] = { text = "~", hl = "MiniFilesChange" }
              elseif flags.unstaged == git.FLAGS.UNTRACKED then
                sign[path] = { text = "+", hl = "MiniFilesAdd" }
              end
            end
          end

          -- file changes (not saved)
          for _, change in ipairs(vim.fn.getbufinfo { bufmodified = 1 }) do
            sign[change.name] = { text = "*", hl = "MiniFilesChange" }
          end

          local buf = args.data.buf_id
          local lines = vim.api.nvim_buf_line_count(buf)
          for i = 1, lines do
            local entry = mini_files.get_fs_entry(buf, i)
            if not entry then
              return
            end

            local path = entry.path
            if sign[path] then
              vim.api.nvim_buf_set_extmark(buf, ns_mini_files_git, i - 1, 0, {
                sign_text = sign[path].text,
                sign_hl_group = sign[path].hl,
                priority = 2,
                invalidate = true,
              })
            end
          end
        end,
      })
    end,
    -- stylua: ignore
    keys = {
      { "<leader>e", function() require("mini.files").open() end, desc = "Files" },
    },
  },
  {
    "echasnovski/mini.surround",
    event = { "BufReadPre" },
    opts = {
      mappings = {
        add = "gsa",
        delete = "gsd",
        find = "gsf",
        find_left = "gsF",
        highlight = "gsh",
        replace = "gsr",
        update_n_lines = "gsn",
      },
    },
  },
  {
    "echasnovski/mini.indentscope",
    version = "*",
    event = { "BufReadPost" },
    opts = {
      symbol = "│",
      options = { try_as_border = true },
    },
    init = function()
      vim.api.nvim_create_autocmd("FileType", {
        pattern = {
          "fzf",
          "help",
          "lazy",
          "mason",
          "notify",
        },
        callback = function()
          vim.b.miniindentscope_disable = true
        end,
      })
    end,
  },
}
