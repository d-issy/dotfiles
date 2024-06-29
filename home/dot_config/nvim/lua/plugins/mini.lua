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

      local ns_mini_files_git = vim.api.nvim_create_namespace "mini_files_git"
      local augroup = function(name)
        return vim.api.nvim_create_augroup("mini_files_" .. name, { clear = true })
      end

      vim.api.nvim_create_autocmd("User", {
        group = augroup "border",
        pattern = "MiniFilesWindowOpen",
        callback = function(args)
          local win = args.data.win_id
          local config = vim.api.nvim_win_get_config(win)
          config.border = require("util.border").generate()
          vim.api.nvim_win_set_config(win, config)
        end,
      })

      vim.api.nvim_create_autocmd("User", {
        group = augroup "status",
        pattern = "MiniFilesBufferUpdate",
        callback = function(args)
          local buf = args.data.buf_id

          ---@type table<string, {text: string, hl: string}>
          local status = {}

          -- git
          local git_root = vim.trim(vim.fn.system { "git", "rev-parse", "--show-toplevel" })
          local status_out = vim.fn.system { "git", "status", "--porcelain" }

          for git_file in vim.gsplit(status_out, "\n") do
            local staged = git_file:sub(1, 1)
            local unstaged = git_file:sub(2, 2)
            local path = git_root .. "/" .. git_file:sub(4)
            if staged == "R" then
              status[path] = { text = "~", hl = "DiffChanged" }
            end
            if unstaged == "M" then
              status[path] = { text = "~", hl = "DiffChanged" }
            end
            if unstaged == "?" then
              status[path] = { text = "+", hl = "DiffAdded" }
            end
          end

          -- buf file changes
          for _, change in ipairs(vim.fn.getbufinfo { bufmodified = 1 }) do
            status[change.name] = { text = "*", hl = "DiffModified" }
          end

          local lines = vim.api.nvim_buf_line_count(buf)
          for i = 1, lines do
            local entry = mini_files.get_fs_entry(buf, i)
            if not entry then
              return
            end

            local path = entry.path
            if status[path] then
              vim.api.nvim_buf_set_extmark(buf, ns_mini_files_git, i - 1, 0, {
                sign_text = status[path].text,
                sign_hl_group = status[path].hl,
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
