{ ... }:

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
      workspace.library = raw ''vim.list_slice(vim.api.nvim_get_runtime_file("", true), 2)'';
    };
  };
}
