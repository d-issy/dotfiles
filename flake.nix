{
  description = "Home Manager configuration";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    nixvim = {
      url = "github:nix-community/nixvim";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { nixpkgs
    , home-manager
    , nixvim
    , ...
    }:
    let
      mkPkgs = system: import nixpkgs {
        inherit system;
        config.allowUnfreePredicate = pkg: builtins.elem (nixpkgs.lib.getName pkg) [
          "copilot-language-server"
        ];
      };
    in
    {
      packages = {
        inherit (home-manager.packages) x86_64-linux;
        inherit (home-manager.packages) x86_64-darwin;
        inherit (home-manager.packages) aarch64-darwin;
      };

      homeConfigurations = {
        linux = home-manager.lib.homeManagerConfiguration {
          pkgs = mkPkgs "x86_64-linux";
          modules = [
            ./home.linux.nix
            nixvim.homeModules.nixvim
          ];
        };

        macos = home-manager.lib.homeManagerConfiguration {
          pkgs = mkPkgs "aarch64-darwin";
          modules = [
            ./home.macos.nix
            nixvim.homeModules.nixvim
          ];
        };

        macos_intel = home-manager.lib.homeManagerConfiguration {
          pkgs = mkPkgs "x86_64-darwin";
          modules = [
            ./home.macos.nix
            nixvim.homeModules.nixvim
          ];
        };
      };
    };
}
