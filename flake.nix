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
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      home-manager,
      nixvim,
      flake-utils,
      ...
    }:
    let
      supportedSystems = [
        "x86_64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      homeConfigurationNames = {
        x86_64-linux = "linux";
        x86_64-darwin = "macos_intel";
        aarch64-darwin = "macos";
      };

      mkPkgs =
        system:
        import nixpkgs {
          inherit system;
          config.allowUnfreePredicate =
            pkg:
            builtins.elem (nixpkgs.lib.getName pkg) [
              "copilot-language-server"
            ];
        };

      mkToolPackages = pkgs: rec {
        formatter = [
          pkgs.nixfmt
          pkgs.oxfmt
          pkgs.shfmt
          pkgs.stylua
          pkgs.taplo
          pkgs.treefmt
        ];

        linter = [
          pkgs.actionlint
          pkgs.deadnix
          pkgs.oxlint
          pkgs.statix
          pkgs.zizmor
        ];

        lsp = [
          pkgs.vtsls
        ];

        devShell =
          formatter
          ++ linter
          ++ lsp
          ++ [
            pkgs.nodejs_24
            pkgs.pnpm
          ];
      };

      mkSwitchApp =
        system: pkgs:
        let
          homeConfigurationName = homeConfigurationNames.${system};
        in
        pkgs.writeShellApplication {
          name = "dotfiles-switch";
          runtimeInputs = [ home-manager.packages.${system}.default ];
          text = ''
            exec home-manager switch --flake ".#${homeConfigurationName}" "$@"
          '';
        };

      mkLintChecks = pkgs: {
        treefmt =
          pkgs.runCommand "treefmt-check"
            { nativeBuildInputs = [ self.formatter.${pkgs.stdenv.hostPlatform.system} ]; }
            ''
              cd ${./.}
              treefmt --ci
              touch "$out"
            '';

        deadnix = pkgs.runCommand "deadnix-check" { nativeBuildInputs = [ pkgs.deadnix ]; } ''
          cd ${./.}
          deadnix --fail .
          touch "$out"
        '';

        statix = pkgs.runCommand "statix-check" { nativeBuildInputs = [ pkgs.statix ]; } ''
          cd ${./.}
          statix check .
          touch "$out"
        '';

        oxlint = pkgs.runCommand "oxlint-check" { nativeBuildInputs = [ pkgs.oxlint ]; } ''
          cd ${./.}
          oxlint
          touch "$out"
        '';

        actionlint = pkgs.runCommand "actionlint-check" { nativeBuildInputs = [ pkgs.actionlint ]; } ''
          cd ${./.}
          actionlint .github/workflows/*.yml
          touch "$out"
        '';

        zizmor = pkgs.runCommand "zizmor-check" { nativeBuildInputs = [ pkgs.zizmor ]; } ''
          cd ${./.}
          zizmor .
          touch "$out"
        '';
      };

      mkHomeManagerConfiguration =
        system: homeModule:
        let
          pkgs = mkPkgs system;
          extendedLib = pkgs.lib.extend (
            final: prev:
            let
              dotfilesLib = import ./lib {
                inherit pkgs;
                lib = final;
              };
            in
            {
              hm = home-manager.lib.hm;
              helpers = (prev.helpers or { }) // dotfilesLib.helpers;
            }
          );
        in
        home-manager.lib.homeManagerConfiguration {
          inherit pkgs;
          lib = extendedLib;
          extraSpecialArgs = {
            dotfiles = {
              root = ./.;
              files = ./files;
            };
          };
          modules = [
            homeModule
            nixvim.homeModules.nixvim
          ];
        };
    in
    flake-utils.lib.eachSystem supportedSystems (
      system:
      let
        pkgs = mkPkgs system;
        toolPackages = mkToolPackages pkgs;
        switchApp = mkSwitchApp system pkgs;
      in
      {
        apps.switch = {
          type = "app";
          program = "${switchApp}/bin/dotfiles-switch";
        };

        checks = mkLintChecks pkgs;

        devShells.default = pkgs.mkShell {
          packages = toolPackages.devShell;
        };

        formatter = pkgs.writeShellApplication {
          name = "treefmt";
          runtimeInputs = toolPackages.formatter;
          text = ''
            exec treefmt "$@"
          '';
        };
      }
    )
    // {
      packages = {
        inherit (home-manager.packages) x86_64-linux;
        inherit (home-manager.packages) x86_64-darwin;
        inherit (home-manager.packages) aarch64-darwin;
      };

      homeConfigurations = {
        linux = mkHomeManagerConfiguration "x86_64-linux" ./modules/home/linux.nix;
        macos = mkHomeManagerConfiguration "aarch64-darwin" ./modules/home/macos.nix;
        macos_intel = mkHomeManagerConfiguration "x86_64-darwin" ./modules/home/macos.nix;
      };
    };
}
