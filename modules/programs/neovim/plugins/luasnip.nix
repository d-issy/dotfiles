_:

let
  raw = __raw: { inherit __raw; };

  keymap = mode: key: action: desc: {
    inherit mode key action;
    options = {
      inherit desc;
      silent = true;
      noremap = true;
    };
  };
in
{
  programs.nixvim = {
    plugins.luasnip = {
      enable = true;

      lazyLoad.settings.event = [ "InsertEnter" ];

      settings = {
        history = true;
        update_events = [
          "TextChanged"
          "TextChangedI"
        ];
      };

      fromLua = [
        {
          paths = raw ''vim.fn.stdpath("config") .. "/lua/snippets"'';
        }
      ];

      luaConfig.post = builtins.readFile ../../../../files/nvim/lua/nixvim/plugins/luasnip.lua;
    };

    keymaps = [
      (keymap [ "i" "s" ] "<C-k>" (raw ''
        function()
          if require("luasnip").expand_or_jumpable() then
            require("util.copilot").off()
            require("luasnip").expand_or_jump()
          end
        end
      '') "Snippet Expand or Jump")
      (keymap [ "i" "s" ] "<C-l>" (raw ''
        function()
          if require("luasnip").choice_active() then
            require("luasnip").change_choice(1)
          else
            require("luasnip").jump(-1)
          end
        end
      '') "Snippet Change Choice")
    ];
  };
}
