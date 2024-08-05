{
  description = "Home Manager configuration";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, home-manager, ... }: {
    # defaultPackage.x86_64-linux = home-manager.defaultPackage.x86_64-linux;
    defaultPackage.x86_64-darwin = home-manager.defaultPackage.x86_64-darwin;
    defaultPackage.aarch64-darwin = home-manager.defaultPackage.aarch64-darwin;

    homeConfigurations = {
      linux = home-manager.lib.homeManagerConfiguration {
        modules = [ ./home.linux.nix ];
        pkgs = import nixpkgs {
          system = "x86_64-linux";
        };
      };

      macos = home-manager.lib.homeManagerConfiguration {
        modules = [ ./home.macos.nix ];
        pkgs = import nixpkgs {
          system = "aarch64-darwin";
        };
      };

      macos_intel = home-manager.lib.homeManagerConfiguration {
        modules = [ ./home.macos.nix ];
        pkgs = import nixpkgs {
          system = "x86_64-darwin";
        };
      };
    };

  };
}

