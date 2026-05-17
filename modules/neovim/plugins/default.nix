{ pkgs, ... }:

{
  imports = [
    ./ai.nix
    ./comment.nix
    ./dap.nix
    ./dial.nix
    ./git.nix
    ./markdown.nix
    ./markit.nix
    ./mini.nix
    ./screenkey.nix
    ./oil.nix
    ./replace.nix
    ./snacks.nix
    ./neotest.nix
    ./todo.nix
    ./treesitter.nix
    ./ui.nix
  ];

  programs.nixvim = {
    plugins.lz-n.enable = true;

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
