{ pkgs, ... }:

{
  programs.nixvim = {
    extraPlugins = [
      pkgs.vimPlugins.lazy-nvim
    ];

    extraConfigLua = ''
      require("lazy").setup({
        defaults = { lazy = true },
        ui = { border = "rounded" },
        lockfile = vim.env.DOTFILES_DIR .. "/files/nvim/lazy-lock.json",
        spec = {
          { import = "plugins" },
        },
      })
    '';
  };
}
