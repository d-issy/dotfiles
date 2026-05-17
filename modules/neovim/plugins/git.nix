{ ... }:

{
  programs.nixvim.plugins.gitsigns = {
    enable = true;

    lazyLoad.settings.event = [ "BufReadPost" ];

    settings = {
      signs = {
        add.text = "▎";
        change.text = "▎";
        delete.text = "";
        topdelete.text = "";
        changedelete.text = "▎";
        untracked.text = "▎";
      };

      on_attach = ''
        function(buffer)
          local gs = require("gitsigns")

          local nav_hunk = function(direction)
            return function()
              gs.nav_hunk(direction)
            end
          end

          local map = function(mode, key, action, desc)
            vim.keymap.set(mode, key, action, {
              buf = buffer,
              desc = desc,
              noremap = true,
              silent = true,
            })
          end

          map("n", "]h", nav_hunk("next"), "Next Hunk")
          map("n", "[h", nav_hunk("prev"), "Prev Hunk")
          map("n", "]H", nav_hunk("last"), "Last Hunk")
          map("n", "[H", nav_hunk("first"), "First Hunk")
          map("n", "<leader>gb", gs.blame, "Blame Buffer")
          map("n", "<leader>ghR", gs.reset_buffer, "Reset Buffer")
          map("n", "<leader>ghS", gs.stage_buffer, "Stage Buffer")
          map("n", "<leader>ghd", gs.diffthis, "Diff This")
          map("n", "<leader>ghp", gs.preview_hunk_inline, "Preview Hunk Inline")
          map({ "n", "v" }, "<leader>ghr", ":Gitsigns reset_hunk<CR>", "Reset Hunk")
          map({ "n", "v" }, "<leader>ghs", ":Gitsigns stage_hunk<CR>", "Stage Hunk")
          map("n", "<leader>ghu", gs.undo_stage_hunk, "Undo Stage Hunk")
          map({ "o", "x" }, "ih", ":<C-U>Gitsigns select_hunk<CR>", "GitSigns Select Hunk")
          map("n", "<leader>ghb", function()
            gs.blame_line({ full = true })
          end, "Blame Line")
          map("n", "<leader>ghD", function()
            gs.diffthis("~")
          end, "Diff This ~")
        end
      '';
    };
  };
}
