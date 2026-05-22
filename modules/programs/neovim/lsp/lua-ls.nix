{ dotfiles, ... }:

let
  raw = __raw: { inherit __raw; };
in
{
  programs.nixvim.lsp.servers.lua_ls = {
    enable = true;
    config.settings.Lua = {
      diagnostics.globals = [
        "vim"
        "hs"
      ];
      hint = {
        enable = true;
        arrayIndex = "Disable";
      };
      workspace.library = raw (
        builtins.readFile (dotfiles.files + "/nvim/lua/nixvim/lsp/lua-ls-workspace-library.lua")
      );
    };
  };
}
