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
      workspace.library = raw ''
        vim.tbl_filter(function(path)
          local config = vim.uv.fs_realpath(vim.fn.stdpath("config")) or vim.fn.stdpath("config")
          local real = vim.uv.fs_realpath(path) or path
          return real ~= config
        end, vim.list_slice(vim.api.nvim_get_runtime_file("", true), 2))
      '';
    };
  };
}
