{ ... }:

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
in
{
  programs.nixvim.keymaps = [
    # basic
    (keymap "n" "<leader>w" "<cmd>w<cr>" "File Write")
    (keymap [ "n" "t" ] "<leader>qq" (raw ''function() require("util.quit").all() end'') "Quit and Save All")
    (keymap "n" "<leader>md" "<cmd>delmarks! | delmarks A-Z0-9<cr>" "Delete All Marks")
    (keymap "n" "<leader>bd" (raw ''function() require("util.buffer").delete() end'') "Buffer Delete")
    (keymap [ "i" "n" ] "<esc>" "<cmd>noh<cr><esc>" "esc")
    (keymap "n" "n" "nzz" "Next")
    (keymap "n" "N" "Nzz" "Previous")

    # copy and paste
    (keymap [ "n" "x" ] "gy" ''"+y'' "Copy to system clipboard")
    (keymap "n" "gp" ''"+p'' "Paste from system clipboard")
    (keymap "x" "gp" ''"+P'' "Paste from system clipboard")

    # resize
    (keymap [ "n" "t" ] "<c-up>" "<cmd>resize +2<cr>" "Resize Up")
    (keymap [ "n" "t" ] "<c-down>" "<cmd>resize -2<cr>" "Resize Down")
    (keymap [ "n" "t" ] "<c-left>" "<cmd>vertical resize -2<cr>" "Resize Left")
    (keymap [ "n" "t" ] "<c-right>" "<cmd>vertical resize +2<cr>" "Resize Right")

    # terminal
    (keymap "n" "<leader><tab><tab>" "10<c-w>s<cmd>terminal<cr>" "Terminal")
    (keymap "n" "<leader><tab>v" "<c-w>v<cmd>terminal<cr>" "Terminal")
    (keymap "t" "<leader><tab>v" "<c-\\><c-n><c-w>v<cmd>terminal<cr>" "Terminal")
    (keymap "t" "<leader><esc>" "<c-\\><c-n>" "ESC")
    (keymap "t" "<c-w>c" "<c-\\><c-n><c-w>c" "Close")
    (keymap "t" "<c-w>h" "<c-\\><c-n><c-w>h" "Left")
    (keymap "t" "<c-w>j" "<c-\\><c-n><c-w>j" "Down")
    (keymap "t" "<c-w>k" "<c-\\><c-n><c-w>k" "Up")
    (keymap "t" "<c-w>l" "<c-\\><c-n><c-w>l" "Right")

    # lazynvim
    (keymap "n" "<leader>l" "<cmd>Lazy<cr>" "Lazy")

    # lazygit
    (keymap "n" "<leader>gg" (raw ''function() require("util.lazygit").open() end'') "Lazygit")
    (keymap "n" "<leader>gl" (raw ''function() require("util.lazygit").commit_log() end'') "Commit Log")
  ];
}
