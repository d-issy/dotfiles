{
  description = "Home Manager configuration";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    nixpkgs-mise.url = "github:nixos/nixpkgs/bb9f54bb0eaa8ff80cfcc3627b079e6585082cf4"; # mise 2026.1.2
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, nixpkgs-mise, home-manager, ... }:
    let
      miseOverlay = final: prev: {
        mise = (import nixpkgs-mise { system = final.system; }).mise;
      };
    in
    {
      packages = {
        x86_64-linux = home-manager.packages.x86_64-linux;
        x86_64-darwin = home-manager.packages.x86_64-darwin;
        aarch64-darwin = home-manager.packages.aarch64-darwin;
      };

      homeConfigurations = {
        linux = home-manager.lib.homeManagerConfiguration {
          modules = [ ./home.linux.nix ];
          pkgs = import nixpkgs {
            system = "x86_64-linux";
            overlays = [ miseOverlay ];
          };
        };

        macos = home-manager.lib.homeManagerConfiguration {
          modules = [ ./home.macos.nix ];
          pkgs = import nixpkgs {
            system = "aarch64-darwin";
            overlays = [ miseOverlay ];
          };
        };

        macos_intel = home-manager.lib.homeManagerConfiguration {
          modules = [ ./home.macos.nix ];
          pkgs = import nixpkgs {
            system = "x86_64-darwin";
            overlays = [ miseOverlay ];
          };
        };
      };
    };
}
