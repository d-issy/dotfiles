{ ... }:

let
  raw = __raw: { inherit __raw; };
  keymap = key: action: desc: {
    mode = [ "n" "v" ];
    inherit key action;
    options = {
      inherit desc;
      expr = true;
      silent = true;
      noremap = true;
    };
  };
in
{
  programs.nixvim = {
    plugins.dial.enable = true;

    extraConfigLua = ''
      local function dial(increment, g)
        local mode = vim.fn.mode(true)
        local is_visual = mode == "v" or mode == "V" or mode == "\22"
        local func = (increment and "inc" or "dec") .. (g and "_g" or "_") .. (is_visual and "visual" or "normal")
        local group = vim.g.dials_by_ft[vim.bo.filetype] or "default"
        return require("dial.map")[func](group)
      end

      local augend = require("dial.augend")
      local logical_alias = augend.constant.new({ elements = { "&&", "||" }, word = false, cyclic = true })
      local capitalized_boolean = augend.constant.new({ elements = { "True", "False" }, word = true, cyclic = true })

      local groups = {
        default = {
          augend.integer.alias.decimal,
          augend.integer.alias.decimal_int,
          augend.integer.alias.hex,
          augend.date.alias["%Y/%m/%d"],
          augend.date.alias["%Y-%m-%d"],
          capitalized_boolean,
          augend.constant.alias.bool,
          logical_alias,
        },
        css = {
          augend.hexcolor.new({ case = "lower" }),
          augend.hexcolor.new({ case = "upper" }),
        },
        vue = {
          augend.constant.new({ elements = { "let", "const" } }),
          augend.hexcolor.new({ case = "lower" }),
          augend.hexcolor.new({ case = "upper" }),
        },
        typescript = {
          augend.constant.new({ elements = { "let", "const" } }),
        },
        markdown = {
          augend.misc.alias.markdown_header,
        },
        json = {
          augend.semver.alias.semver,
        },
        lua = {
          augend.constant.new({ elements = { "and", "or" }, word = true, cyclic = true }),
        },
        python = {
          augend.constant.new({ elements = { "and", "or" } }),
        },
      }

      for name, group in pairs(groups) do
        if name ~= "default" then
          vim.list_extend(group, groups.default)
        end
      end

      require("dial.config").augends:register_group(groups)
      vim.g.dials_by_ft = {
        css = "css",
        vue = "vue",
        javascript = "typescript",
        typescript = "typescript",
        typescriptreact = "typescript",
        javascriptreact = "typescript",
        json = "json",
        lua = "lua",
        markdown = "markdown",
        sass = "css",
        scss = "css",
        python = "python",
      }
      _G.dotfiles_dial = dial
    '';

    keymaps = [
      (keymap "<C-a>" (raw ''function() return _G.dotfiles_dial(true) end'') "Increment")
      (keymap "<C-x>" (raw ''function() return _G.dotfiles_dial(false) end'') "Decrement")
      (keymap "g<C-a>" (raw ''function() return _G.dotfiles_dial(true, true) end'') "Increment")
      (keymap "g<C-x>" (raw ''function() return _G.dotfiles_dial(false, true) end'') "Decrement")
    ];
  };
}
