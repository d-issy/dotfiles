{ pkgs, ... }:

{
  home.packages = [ pkgs.rust-analyzer ];

  programs.nixvim.lsp.servers.rust_analyzer.enable = true;
}
