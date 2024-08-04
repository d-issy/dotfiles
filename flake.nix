{
  description = "Home Manager configuration";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, home-manager, ... }: {
    homeConfigurations = {
      linux = home-manager.lib.homeManagerConfiguration {
        modules = [ (import ./home.nix) ];
        pkgs = import nixpkgs {
          system = "x86_64-linux";
        };
      };

      mac = home-manager.lib.homeManagerConfiguration {
        modules = [ (import ./home.nix) ];
        pkgs = import nixpkgs {
          system = "aarch64-darwin";
        };
      };

      mac_intel = home-manager.lib.homeManagerConfiguration {
        modules = [ (import ./home.nix) ];
        pkgs = import nixpkgs {
          system = "x86_64-darwin";
        };
      };
    };

  };
}

