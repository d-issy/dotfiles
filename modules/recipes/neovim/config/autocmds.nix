_:

let
  raw = __raw: { inherit __raw; };
in
{
  programs.nixvim = {
    autoGroups = {
      highlight_yank.clear = true;
      close_with_q.clear = true;
      terminal_open.clear = true;
    };

    autoCmd = [
      {
        event = "TextYankPost";
        group = "highlight_yank";
        callback = raw ''
          function()
            vim.hl.on_yank()
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
          "qf"
        ];
        callback = raw ''
          function(event)
            vim.bo[event.buf].buflisted = false
            vim.keymap.set("n", "q", "<cmd>close<cr>", { buf = event.buf, silent = true })
          end
        '';
      }
      {
        event = [
          "TermOpen"
          "WinEnter"
        ];
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
