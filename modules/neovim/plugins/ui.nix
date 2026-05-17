{ ... }:

let
  raw = __raw: { inherit __raw; };
  keymap = mode: key: action: desc: {
    inherit mode key action;
    options = { inherit desc; silent = true; noremap = true; };
  };
in
{
  programs.nixvim = {
    plugins = {
      bufferline = {
        enable = true;
        lazyLoad.settings.event = [ "BufReadPost" ];
        settings.options = {
          diagnostics = "nvim_lsp";
          diagnostics_indicator = ''
            function(count, level, diagnostics_dict, context)
              local icon = level:match("error") and " " or " "
              return " " .. icon .. count
            end
          '';
          show_buffer_close_icons = false;
          show_close_icon = false;
          custom_filter = ''
            function(buf, bufnums)
              return require("util.buffer").is_managed(buf)
            end
          '';
        };
      };

      dropbar = {
        enable = true;
        lazyLoad.settings.event = [ "BufReadPost" ];
      };

      noice = {
        enable = true;
        lazyLoad.settings.event = [ "BufReadPost" ];
        settings = {
          cmdline.view = "cmdline";
          lsp = {
            hover.enabled = false;
            message.enabled = false;
            progress.enabled = false;
            signature.enabled = false;
          };
        };
      };

      flash = {
        enable = true;
        lazyLoad.settings.keys = [
          {
            __unkeyed-1 = "<leader>j";
            __unkeyed-3.__raw = ''function() require("flash").jump() end'';
            mode = [ "n" "o" "x" ];
            desc = "Flash";
          }
          {
            __unkeyed-1 = "<leader>J";
            __unkeyed-3.__raw = ''function() require("flash").treesitter() end'';
            mode = [ "n" "o" "x" ];
            desc = "Flash Treesitter";
          }
        ];
        settings = { };
      };

      which-key = {
        enable = true;
        lazyLoad.settings.keys = [ "<leader>?" ];
        settings = {
          preset = "helix";
          triggers = [
            {
              __unkeyed-1 = "<auto>";
              mode = "nv";
            }
          ];
          spec = [
            {
              mode = [ "n" "v" ];
              __unkeyed-1 = [
                { __unkeyed-1 = "g"; group = "goto"; }
                { __unkeyed-1 = "gs"; group = "surround"; }
                { __unkeyed-1 = "z"; group = "fold"; }
                { __unkeyed-1 = "]"; group = "next"; }
                { __unkeyed-1 = "["; group = "prev"; }
                { __unkeyed-1 = "<leader><tab>"; group = "terminal"; }
                { __unkeyed-1 = "<leader>a"; group = "ai"; }
                { __unkeyed-1 = "<leader>b"; group = "buffer"; }
                { __unkeyed-1 = "<leader>c"; group = "code"; }
                { __unkeyed-1 = "<leader>f"; group = "find"; }
                { __unkeyed-1 = "<leader>g"; group = "git"; }
                { __unkeyed-1 = "<leader>gh"; group = "hunks"; }
                { __unkeyed-1 = "<leader>q"; group = "quit/session"; }
                { __unkeyed-1 = "<leader>t"; group = "test"; }
                { __unkeyed-1 = "<leader>u"; group = "ui"; }
              ];
            }
          ];
          icons.rules = [
            { pattern = "ai"; icon = "󰭆"; color = "grey"; }
            { pattern = "blame"; cat = "filetype"; name = "git"; }
            { pattern = "commit"; cat = "filetype"; name = "git"; }
            { pattern = "delete"; icon = "󰆴"; color = "red"; }
            { pattern = "hunk"; cat = "filetype"; name = "git"; }
            { plugin = "CopilotChat.nvim"; icon = ""; color = "grey"; }
            { plugin = "gitsigns.nvim"; cat = "filetype"; name = "git"; }
            { plugin = "grug-far.nvim"; icon = "󰛔 "; color = "blue"; }
            { plugin = "mini.files"; cat = "filetype"; name = "netrw"; }
          ];
          win.border = "rounded";
        };
      };

      nui.enable = true;
    };

    extraPlugins = [ ];

    keymaps = [
      (keymap "n" "<leader>bp" "<cmd>BufferLineTogglePin<cr>" "Toggle Pin")
      (keymap "n" "<leader>bP" "<cmd>BufferLineGroupClose ungrouped<cr>" "Delete Non-Pinned Buffers")
      (keymap "n" "<leader>bo" "<cmd>BufferLineCloseOthers<cr>" "Delete Other Buffers")
      (keymap "n" "<leader>bl" "<cmd>BufferLineCloseRight<cr>" "Delete Buffers to the Right")
      (keymap "n" "<leader>bh" "<cmd>BufferLineCloseLeft<cr>" "Delete Buffers to the Left")
      (keymap "n" "<S-h>" "<cmd>BufferLineCyclePrev<cr>" "Prev Buffer")
      (keymap "n" "<S-l>" "<cmd>BufferLineCycleNext<cr>" "Next Buffer")
      (keymap "n" "[b" "<cmd>BufferLineCyclePrev<cr>" "Prev Buffer")
      (keymap "n" "]b" "<cmd>BufferLineCycleNext<cr>" "Next Buffer")
      (keymap "n" "[B" "<cmd>BufferLineMovePrev<cr>" "Move buffer prev")
      (keymap "n" "]B" "<cmd>BufferLineMoveNext<cr>" "Move buffer next")
      (keymap "n" "<leader>?" (raw ''function() require("which-key").show({ global = false }) end'') "Buffer Keymaps (which-key)")
    ];
  };
}
