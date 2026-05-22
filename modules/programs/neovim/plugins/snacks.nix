_:

let
  raw = __raw: { inherit __raw; };

  defaultOptions = desc: {
    silent = true;
    noremap = true;
    inherit desc;
  };

  keymap = mode: key: action: desc: {
    inherit mode key action;
    options = defaultOptions desc;
  };

  snacks = expr: raw ''function() require("snacks").${expr} end'';
in
{
  programs.nixvim = {
    plugins.snacks = {
      enable = true;

      settings = {
        bigfile.enabled = true;
        gh.enabled = true;
        gitbrowse.enabled = true;
        indent = {
          enabled = true;
          indent.only_current = true;
          chunk = {
            enabled = true;
            char = {
              corner_top = "╭";
              corner_bottom = "╰";
              horizontal = "─";
              vertical = "│";
              arrow = "─";
            };
          };
        };
        input.enabled = true;
        notifier = {
          enabled = true;
          timeout = 3000;
        };
        picker = {
          layouts.bottom_pane = {
            preset = "ivy";
            preview = "main";
            layout.height = 15;
          };
          sources = {
            buffers = {
              current = false;
              layout.preset = "bottom_pane";
              focus = "list";
            };
            files.layout.preset = "bottom_pane";
            smart.layout.preset = "bottom_pane";
            marks = {
              layout.preset = "bottom_pane";
              focus = "list";
            };
            registers = {
              layout.preset = "bottom_pane";
              focus = "list";
            };
            pickers = {
              layout = {
                preset = "bottom_pane";
                preview = false;
              };
            };
            diagnostics = {
              layout.preset = "bottom_pane";
              focus = "list";
            };
            diagnostics_buffer = {
              layout.preset = "bottom_pane";
              focus = "list";
            };
            lsp_declarations = {
              layout.preset = "bottom_pane";
              focus = "list";
            };
            lsp_implementations = {
              layout.preset = "bottom_pane";
              focus = "list";
            };
            lsp_references = {
              auto_confirm = false;
              layout.preset = "bottom_pane";
              focus = "list";
            };
            lsp_type_definitions = {
              layout.preset = "bottom_pane";
              focus = "list";
            };
            lsp_symbols.layout.preset = "bottom_pane";
            lsp_workspace_symbols.layout.preset = "bottom_pane";
            git_status = {
              layout.preset = "bottom_pane";
              sort.fields = [ "sort" ];
            };
            gh_actions.layout.preset = "bottom_pane";
          };
        };
        quickfile.enabled = true;
        scope.enabled = true;
        scroll = {
          enabled = true;
          only_current = true;
          animate.duration = {
            step = 10;
            total = 100;
          };
        };
        toggle.enabled = true;
        words.enabled = true;
        styles.input.keys = {
          i_esc = [
            "<esc>"
            "stopinsert"
            { mode = "i"; }
          ];
          i_cr = [
            "<cr>"
            "confirm"
            { mode = "i"; }
          ];
          i_tab = [
            "<tab>"
            [
              "cmp_select_next"
              "cmp"
            ]
            { mode = "i"; }
          ];
          cr = [
            "<cr>"
            [ "confirm" ]
          ];
          q = "cancel";
        };
      };

      luaConfig.post = builtins.readFile ../../../../files/nvim/lua/nixvim/plugins/snacks.lua;
    };

    keymaps = [
      (keymap "n" "<leader><space>" (snacks "picker.smart()") "Smart Search")
      (keymap "n" "<leader>'" (snacks "picker.marks()") "Marks")
      (keymap "n" ''<leader>"'' (snacks "picker.registers()") "Registers")
      (keymap "n" "<leader>," (snacks "picker.buffers()") "Buffers")
      (keymap "n" "<leader>/" (snacks "picker.grep()") "Grep")
      (keymap "n" "<leader>fa" (snacks "picker.pickers()") "Actions")
      (keymap "n" "<leader>ff" (snacks "picker.files()") "Files")
      (keymap "n" "<leader>fh" (snacks "picker.help()") "Actions")
      (keymap "n" "<leader>fl" (snacks "picker.lines()") "Lines")
      (keymap "n" "<leader>fu" (snacks "picker.undo()") "Undo")
      (keymap "n" "<leader>fs" (snacks "picker.spelling()") "Spell")
      (keymap "n" "<leader>z" (snacks "zen.zoom()") "Zoom")
      (keymap "n" "<leader>ga" (snacks "picker.gh_actions()") "GitHub Actions")
      (keymap "n" "<leader>gs" (snacks "picker.git_status()") "Git Status")
      (keymap "n" "gd" (snacks "picker.lsp_definitions()") "LSP Definitions")
      (keymap "n" "gG" (snacks "picker.lsp_declarations()") "LSP Declarations")
      (keymap "n" "gr" (snacks "picker.lsp_references()") "LSP References")
      (keymap "n" "gi" (snacks "picker.lsp_implementations()") "LSP Implementation")
      (keymap "n" "gI" (snacks "picker.lsp_type_definitions()") "LSP Type Definition")
      (keymap "n" "<leader>cs" (snacks "picker.lsp_symbols()") "LSP Symbols")
      (keymap "n" "<leader>cd" (snacks "picker.diagnostics_buffer()") "Diagnostic")
      (keymap "n" "<leader>cD" (snacks "picker.diagnostics()") "Diagnostic (Workspace)")
      (keymap "n" "<leader>cS" (snacks "picker.lsp_workspace_symbols()") "LSP Symbols (Workspace)")
      (keymap "n" "<leader>cR" (snacks "rename.rename_file()") "File Rename")
      (keymap "n" "<leader>ca" (raw "function() vim.lsp.buf.code_action() end") "LSP Code Action")
      (keymap "n" "<leader>cr" (raw "function() vim.lsp.buf.rename() end") "LSP Rename")
      (keymap "n" "<leader>ft" (snacks "picker.todo_comments()") "Todo")
      (keymap "n" "<leader>fT"
        (snacks ''picker.todo_comments({ keywords = { "TODO", "FIX", "FIXME" } })'')
        "Todo/Fix/Fixme"
      )
      (keymap [ "n" "v" ] "<leader>gB" (snacks ''gitbrowse.open({ what = "commit" })'') "Open commit")
    ];
  };
}
