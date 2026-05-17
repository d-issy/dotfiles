{ ... }:

let
  raw = __raw: { inherit __raw; };
in
{
  programs.nixvim = {
    autoGroups = {
      highlight_yank.clear = true;
      close_with_q.clear = true;
      bigfile.clear = true;
      terminal_open.clear = true;
    };

    autoCmd = [
      {
        event = "TextYankPost";
        group = "highlight_yank";
        callback = raw ''
          function()
            vim.highlight.on_yank()
          end
        '';
      }
      {
        event = "FileType";
        group = "close_with_q";
        pattern = [
          "gitsigns.blame"
          "help"
          "neotest-output"
          "neotest-output-panel"
          "neotest-summary"
          "notify"
          "qf"
        ];
        callback = raw ''
          function(event)
            vim.bo[event.buf].buflisted = false
            vim.keymap.set("n", "q", "<cmd>close<cr>", { buffer = event.buf, silent = true })
          end
        '';
      }
      {
        event = "BufReadPre";
        group = "bigfile";
        pattern = "*";
        callback = raw ''
          function(event)
            local file_util = require "util.file"
            local buf = event.buf
            if file_util.is_big(buf) then
              file_util.disable_futures_for_bigfile(buf)
            end
          end
        '';
      }
      {
        event = [ "TermOpen" "WinEnter" ];
        group = "terminal_open";
        pattern = "term://*";
        callback = raw ''
          function()
            vim.cmd "startinsert"
            vim.cmd "setlocal nonumber"
            vim.cmd "setlocal norelativenumber"
          end
        '';
      }
    ];
  };
}
