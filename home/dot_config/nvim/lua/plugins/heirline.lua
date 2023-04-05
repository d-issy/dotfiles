local colors = {
  green = "#9ECE6A",
  orange = "#F2B732",
  yellow = "#f7dc6f",
  blue = "#7DCFFF",
  red = "#F7768E",
  gray = "#323232",
  lightgray = "#404040",
  black = "black",
  white = "white",
}
return {
  "rebelot/heirline.nvim",
  dependencies = {
    "gitsigns.nvim",
    "nvim-navic",
    "nvim-web-devicons",
  },
  opts = function()
    local conditions = require "heirline.conditions"
    local utils = require "heirline.utils"

    local Mode = {
      init = function(self) self.mode = string.upper(vim.fn.mode()) end,
      update = {
        "ModeChanged",
        pattern = "*:*",
        callback = vim.schedule_wrap(function() vim.cmd "redrawstatus" end),
      },
      provider = " ",
      hl = function(self)
        if self.mode == "N" then
          return { bg = colors.green }
        elseif self.mode == "I" then
          return { bg = colors.blue }
        elseif vim.tbl_contains({ "V", "\22" }, self.mode) then
          return { bg = colors.orange }
        elseif self.mode == "T" then
          return { bg = colors.blue }
        elseif self.mode == "R" then
          return { bg = colors.red }
        end
      end,
    }

    local GitBranch = {
      condition = conditions.is_git_repo,
      update = { "User", pattern = "GitSignsUpdate" },
      init = function(self)
        self.status_dict = vim.b.gitsigns_status_dict
        self.has_changes = self.status_dict.added ~= 0 or self.status_dict.removed ~= 0 or self.status_dict.changed ~= 0
      end,
      {
        hl = { fg = colors.orange },
        provider = function(self) return "  " .. self.status_dict.head .. " " end,
      },
    }

    local FileInfo = {
      condition = function()
        return not vim.tbl_contains({
          "neo-tree",
          "TelescopePrompt",
        }, vim.bo.filetype)
      end,
      init = function(self)
        self.filename = vim.api.nvim_buf_get_name(0)
        self.extension = vim.fn.fnamemodify(self.filename, ":e")
        self.filetype = vim.bo.filetype
        self.icon, self.icon_color =
          require("nvim-web-devicons").get_icon_color(self.filename, self.extension, { default = true })
      end,
      { provider = " " },
      {
        hl = function(self) return { fg = self.icon_color } end,
        provider = function(self) return self.icon and (self.icon .. " ") end,
      },
      {
        provider = function(self) return self.filetype or self.extension end,
      },
    }

    local GitDiff = {
      condition = conditions.is_git_repo,
      update = { "User", pattern = "GitSignsUpdate" },
      init = function(self)
        self.status_dict = vim.b.gitsigns_status_dict
        self.has_changes = self.status_dict.added ~= 0 or self.status_dict.removed ~= 0 or self.status_dict.changed ~= 0
      end,
      { condition = function(self) return self.has_changes end, provider = "  " },
      {
        provider = function(self)
          local count = self.status_dict.added or 0
          return count > 0 and ("  " .. count)
        end,
        hl = { fg = colors.green },
      },
      {
        provider = function(self)
          local count = self.status_dict.removed or 0
          return count > 0 and ("  " .. count)
        end,
        hl = { fg = colors.red },
      },
      {
        provider = function(self)
          local count = self.status_dict.changed or 0
          return count > 0 and ("  " .. count)
        end,
        hl = { fg = colors.orange },
      },
      { condition = function(self) return self.has_changes end, provider = " " },
    }

    local Diagnostics = {
      condition = conditions.has_diagnostics,
      init = function(self)
        self.errors = #vim.diagnostic.get(0, { severity = vim.diagnostic.severity.ERROR })
        self.warnings = #vim.diagnostic.get(0, { severity = vim.diagnostic.severity.WARN })
        self.info = #vim.diagnostic.get(0, { severity = vim.diagnostic.severity.INFO })
        self.hints = #vim.diagnostic.get(0, { severity = vim.diagnostic.severity.HINT })
      end,
      update = { "DiagnosticChanged", "BufEnter" },
      hl = { fg = colors.white },
      { provider = " " },
      {
        provider = function(self) return self.errors > 0 and (" " .. self.errors .. " ") end,
        hl = { fg = colors.red },
      },
      {
        provider = function(self) return self.warnings > 0 and (" " .. self.warnings .. " ") end,
        hl = { fg = colors.orange },
      },
      {
        provider = function(self) return self.info > 0 and (" " .. self.info .. " ") end,
        hl = { fg = colors.blue },
      },
      {
        provider = function(self) return self.hints > 0 and (" " .. self.hints) end,
        hl = { fg = colors.yellow },
      },
      { provider = " " },
    }

    local Fill = { provider = "%=" }

    local LspActive = {
      condition = conditions.lsp_attached,
      update = { "LspAttach", "LspDetach" },
      provider = function()
        local names = {}
        for _, server in pairs(vim.lsp.get_active_clients { bufnr = 0 }) do
          if server.name ~= "null-ls" then
            table.insert(names, server.name)
          end
        end
        return "  " .. table.concat(names, ", ") .. " "
      end,
      hl = { fg = colors.white },
    }

    local Statusline = {
      hl = { fg = colors.white, bg = colors.gray },
      Mode,
      GitBranch,
      FileInfo,
      GitDiff,
      Diagnostics,
      Fill,
      LspActive,
      Mode,
    }

    local File = {
      provider = function() return vim.fn.fnamemodify(vim.api.nvim_buf_get_name(0), ":.") end,
    }

    local Navic = {
      condition = function() return require("nvim-navic").is_available() end,
      update = "CursorMoved",
      init = function(self) self.nav = require("nvim-navic").get_location { highlight = true } end,
      { condition = function(self) return #self.nav > 0 end, provider = " > " },
      { provider = function(self) return self.nav end },
    }

    local WinBar = {
      hl = { bg = colors.lightgray },
      File,
      Navic,
    }
    vim.opt.laststatus = 3
    return { statusline = Statusline, winbar = WinBar }
  end,
}
