{ pkgs, ... }:

{
  programs.nixvim.lsp.servers.copilot = {
    enable = true;
    package = null;
    config.cmd = [
      "${pkgs.copilot-language-server}/bin/copilot-language-server"
      "--stdio"
    ];
  };

  home.packages = [ pkgs.copilot-language-server ];
}
