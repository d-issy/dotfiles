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
        performance = {
          reset_packpath = false,
          rtp = {
            reset = false,
          },
        },
        spec = {
          { import = "plugins" },
        },
      })
    '';
  };
}
