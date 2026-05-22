{ dot, ... }:

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
  nmap =
    key: action: desc:
    keymap "n" key action desc;
in
{
  programs.nixvim = {
    plugins = {
      dap = {
        enable = true;
        luaConfig.post = builtins.readFile (dot.files + "/nvim/lua/nixvim/plugins/dap.lua");
      };
      dap-ui.enable = true;
      dap-go.enable = true;
    };

    keymaps = [
      (keymap [ "n" "v" ] "<leader>d" "" "+debug")
      (nmap "<leader>db" (raw ''function() require("dap").toggle_breakpoint() end'') "Toggle Breakpoint")
      (nmap "<leader>dB"
        (raw ''function() require("dap").set_breakpoint(vim.fn.input("Breakpoint condition: ")) end'')
        "Breakpoint Condition"
      )
      (nmap "<leader>dc" (raw ''function() require("dap").continue() end'') "Continue")
      (nmap "<leader>dC" (raw ''function() require("dap").run_to_cursor() end'') "Run to Cursor")
      (nmap "<leader>dg" (raw ''function() require("dap").goto_() end'') "Go to Line (No Execute)")
      (nmap "<leader>di" (raw ''function() require("dap").step_into() end'') "Step Into")
      (nmap "<leader>dj" (raw ''function() require("dap").down() end'') "Down")
      (nmap "<leader>dk" (raw ''function() require("dap").up() end'') "Up")
      (nmap "<leader>dl" (raw ''function() require("dap").run_last() end'') "Run Last")
      (nmap "<leader>do" (raw ''function() require("dap").step_over() end'') "Step Over")
      (nmap "<leader>dO" (raw ''function() require("dap").step_out() end'') "Step Out")
      (nmap "<leader>dp" (raw ''function() require("dap").pause() end'') "Pause")
      (nmap "<leader>dr" (raw ''function() require("dap").repl.toggle() end'') "Toggle REPL")
      (nmap "<leader>ds" (raw ''function() require("dap").session() end'') "Session")
      (nmap "<leader>dt" (raw ''function() require("dap").terminate() end'') "Terminate")
      (nmap "<leader>dw" (raw ''function() require("dap.ui.widgets").hover() end'') "Widgets")
      (nmap "<leader>du" (raw ''function() require("dapui").toggle({}) end'') "Dap UI")
      (keymap [ "n" "v" ] "<leader>de" (raw ''function() require("dapui").eval() end'') "Eval")
    ];
  };
}
