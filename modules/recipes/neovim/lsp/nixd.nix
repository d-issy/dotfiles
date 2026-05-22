{ pkgs, ... }:

let
  homeConfiguration = if pkgs.stdenv.hostPlatform.isDarwin then "macos" else "linux";
in
{
  programs.nixvim.lsp.servers.nixd = {
    enable = true;
    config.settings.nixd = {
      nixpkgs.expr = ''
        import (builtins.getFlake (builtins.toString ./.)).inputs.nixpkgs {
          system = "${pkgs.stdenv.hostPlatform.system}";
        }
      '';

      options.home-manager.expr = ''
        (builtins.getFlake (builtins.toString ./.)).homeConfigurations.${homeConfiguration}.options
      '';

      formatting.command = [ "${pkgs.nixfmt}/bin/nixfmt" ];
    };
  };
}
