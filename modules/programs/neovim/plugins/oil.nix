_:

let
  raw = __raw: { inherit __raw; };

  keymap = mode: key: action: desc: {
    inherit mode key action;
    options = {
      inherit desc;
      noremap = true;
      silent = true;
    };
  };
in
{
  programs.nixvim = {
    keymaps = [
      (keymap "n" "<leader>e" (raw ''function() require("oil").toggle_float() end'') "Files")
      (keymap "n" "<leader>E" (raw ''function() require("oil").open() end'') "Files")
    ];

    plugins.oil = {
      enable = true;

      settings = {
        use_default_keymaps = false;
        float = {
          border = "rounded";
          max_width = 0.9;
          max_height = 0.8;
        };
        keymaps = {
          "q" = "actions.close";
          "g?" = "actions.show_help";
          "<C-s>" = {
            __unkeyed = "actions.select";
            opts.vertical = true;
            desc = "Open the entry in a vertical split";
          };
          "<C-b>" = {
            __unkeyed = "actions.select";
            opts.horizontal = true;
            desc = "Open the entry in a horizontal split";
          };
          "<C-t>" = {
            __unkeyed = "actions.select";
            opts.tab = true;
            desc = "Open the entry in new tab";
          };
          "<C-p>" = "actions.preview";
          "<C-r>" = "actions.refresh";
          "H" = "actions.parent";
          "L" = "actions.select";
          "<BS>" = "actions.open_cwd";
          "`" = "actions.cd";
          "~" = {
            __unkeyed = "actions.cd";
            opts.scope = "tab";
            desc = ":tcd to the current oil directory";
            mode = "n";
          };
          "gs" = "actions.change_sort";
          "gx" = "actions.open_external";
          "g." = "actions.toggle_hidden";
          "g\\" = "actions.toggle_trash";
          ";" = {
            __unkeyed = "<cmd>w<cr>";
            desc = "Sync File";
          };
          "gd" = {
            __unkeyed = raw ''
              function()
                vim.g.oil_detail = not vim.g.oil_detail
                if vim.g.oil_detail then
                  require("oil").set_columns { "icon", "permissions", "size", "mtime" }
                else
                  require("oil").set_columns { "icon" }
                end
              end
            '';
            desc = "toggle file detail view";
          };
        };
      };
    };
  };
}
