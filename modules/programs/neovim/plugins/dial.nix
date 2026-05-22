_:

let
  raw = __raw: { inherit __raw; };
  keymap = key: action: desc: {
    mode = [
      "n"
      "v"
    ];
    inherit key action;
    options = {
      inherit desc;
      expr = true;
      silent = true;
      noremap = true;
    };
  };
in
{
  programs.nixvim = {
    plugins.dial.enable = true;

    extraConfigLua = builtins.readFile ../../../../files/nvim/lua/nixvim/plugins/dial.lua;

    keymaps = [
      (keymap "<C-a>" (raw "function() return _G.dotfiles_dial(true) end") "Increment")
      (keymap "<C-x>" (raw "function() return _G.dotfiles_dial(false) end") "Decrement")
      (keymap "g<C-a>" (raw "function() return _G.dotfiles_dial(true, true) end") "Increment")
      (keymap "g<C-x>" (raw "function() return _G.dotfiles_dial(false, true) end") "Decrement")
    ];
  };
}
