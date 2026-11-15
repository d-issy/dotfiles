{ dot, ... }:

let
  raw = __raw: { inherit __raw; };
in
{
  programs.nixvim.lsp.servers.lua_ls = {
    enable = true;
    config.settings.Lua = {
      runtime.version = "LuaJIT";
      diagnostics.globals = [
        "vim"
        "hs"
      ];
      hint = {
        enable = true;
        arrayIndex = "Disable";
      };
      workspace.checkThirdParty = false;
      workspace.library = raw (dot.readFile "nvim/lua/nixvim/lsp/lua-ls-workspace-library.lua");
    };
  };
}
