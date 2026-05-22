{ dot, ... }:

let
  raw = __raw: { inherit __raw; };
  keymap = key: action: desc: {
    mode = "n";
    inherit key action;
    options = {
      inherit desc;
      silent = true;
      noremap = true;
    };
  };
in
{
  programs.nixvim = {
    plugins.neotest = {
      enable = true;
      adapters = {
        golang.enable = true;
        python.enable = true;
      };
      luaConfig.post = dot.readFile "nvim/lua/nixvim/plugins/neotest.lua";
    };

    keymaps = [
      (keymap "<leader>tt" (raw ''function() require("neotest").run.run(vim.fn.expand("%")) end'')
        "Run File"
      )
      (keymap "<leader>tT" (raw ''function() require("neotest").run.run(vim.uv.cwd()) end'')
        "Run All Test Files"
      )
      (keymap "<leader>tr" (raw ''function() require("neotest").run.run() end'') "Run Nearest")
      (keymap "<leader>tl" (raw ''function() require("neotest").run.run_last() end'') "Run Last")
      (keymap "<leader>ts" (raw ''function() require("neotest").summary.toggle() end'') "Toggle Summary")
      (keymap "<leader>to"
        (raw ''function() require("neotest").output.open({ enter = true, auto_close = true }) end'')
        "Show Output"
      )
      (keymap "<leader>tO" (raw ''function() require("neotest").output_panel.toggle() end'')
        "Toggle Output Panel"
      )
      (keymap "<leader>tS" (raw ''function() require("neotest").run.stop() end'') "Stop")
      (keymap "<leader>tw" (raw ''function() require("neotest").watch.toggle(vim.fn.expand("%")) end'')
        "Toggle Watch"
      )
    ];
  };
}
