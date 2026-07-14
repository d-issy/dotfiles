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
          overlays = [
            (final: prev: {
              pythonPackagesExtensions = prev.pythonPackagesExtensions ++ [
                (_: pythonPrev: {
                  seaborn = pythonPrev.seaborn.overridePythonAttrs (old: {
                    # Temporary workaround for an upstream seaborn test failure on
                    # Darwin. Remove once the test no longer depends on font metrics.
                    disabledTests =
                      (old.disabledTests or [ ])
                      ++ final.lib.optionals final.stdenv.hostPlatform.isDarwin [
                        "test_ticklabels_overlap"
                      ];
                  });
                })
              ];
            })
          ];
        };

      mkToolPackages = pkgs: rec {
        formatter = with pkgs; [
          nixfmt
          oxfmt
          shfmt
          stylua
          taplo
          treefmt
        ];

        linter = with pkgs; [
          actionlint
          deadnix
          oxlint
          statix
          zizmor
        ];

        lsp = [
          pkgs.vtsls
        ];

        devShell =
          formatter
          ++ linter
          ++ lsp
          ++ (with pkgs; [
            nodejs
            pnpm
          ]);
      };

      mkSwitchApp =
        system: pkgs:
        let
          homeConfigurationName = homeConfigurationNames.${system};
        in
        pkgs.writeShellApplication {
          name = "dot-switch";
          runtimeInputs = [ home-manager.packages.${system}.default ];
          text = ''
            if [ -f /etc/NIXOS ]; then
              host="''${DOT_NIXOS_HOST:-$(hostname)}"

              # Only rebuild hosts that have an explicit NixOS configuration.
              # An unmatched NixOS installation is managed by Home Manager.
              if nix eval ".#nixosConfigurations.$host.config.networking.hostName" >/dev/null 2>&1; then
                if [ ! -x /run/wrappers/bin/sudo ]; then
                  echo "error: the NixOS sudo wrapper is unavailable" >&2
                  echo "hint: repair/activate the NixOS system configuration first" >&2
                  exit 1
                fi

                exec /run/wrappers/bin/sudo /run/current-system/sw/bin/nixos-rebuild switch --flake ".#$host" "$@"
              fi
            fi

            exec home-manager switch --flake ".#${homeConfigurationName}" "$@"
          '';
        };

      mkGcApp =
        system: pkgs:
        pkgs.writeShellApplication {
          name = "dot-gc";
          runtimeInputs = [ home-manager.packages.${system}.default ];
          text = ''
            home-manager expire-generations '-7 days'
            nix store gc
          '';
        };

      mkGenerationsApp =
        system: pkgs:
        pkgs.writeShellApplication {
          name = "dot-generations";
          runtimeInputs = [ home-manager.packages.${system}.default ];
          text = ''
            exec home-manager generations "$@"
          '';
        };

      mkExtendedLib =
        pkgs:
        pkgs.lib.extend (
          _: _: {
            hm = home-manager.lib.hm;
          }
        );

      mkDotSpecialArgs =
        pkgs:
        let
          extendedLib = mkExtendedLib pkgs;
          files = ./files;
        in
        {
          dot = {
            root = ./.;
            inherit files;
          }
          // (import ./modules/dot/builtins {
            inherit pkgs files;
            lib = extendedLib;
          });
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
          oxlint --deny-warnings
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
          extendedLib = mkExtendedLib pkgs;
        in
        home-manager.lib.homeManagerConfiguration {
          inherit pkgs;
          lib = extendedLib;
          extraSpecialArgs = mkDotSpecialArgs pkgs;
          modules = [
            homeModule
            nixvim.homeModules.nixvim
            ./modules/dot
          ];
        };

      mkNixosConfiguration =
        system:
        let
          pkgs = mkPkgs system;
        in
        nixpkgs.lib.nixosSystem {
          inherit system;
          specialArgs = mkDotSpecialArgs pkgs;
          modules = [
            { nixpkgs.pkgs = pkgs; }
            {
              networking.hostName = "nixos";

              # Keep the generic NixOS configuration evaluable without
              # machine-specific hardware settings. Real hosts can override
              # these values in a hostname-specific configuration.
              boot.loader.grub.enable = false;
              fileSystems."/" = {
                device = "none";
                fsType = "tmpfs";
              };

              nix.settings.experimental-features = [
                "nix-command"
                "flakes"
              ];

              users.users.issy = {
                isNormalUser = true;
                extraGroups = [ "wheel" ];
                shell = pkgs.zsh;
              };

              programs.zsh.enable = true;

              system.stateVersion = "26.05";
            }
            home-manager.nixosModules.home-manager
            {
              home-manager = {
                useGlobalPkgs = true;
                useUserPackages = true;
                extraSpecialArgs = mkDotSpecialArgs pkgs;
                users.issy.imports = [
                  ./modules/home/nixos.nix
                  nixvim.homeModules.nixvim
                  ./modules/dot
                ];
              };
            }
          ];
        };
    in
    flake-utils.lib.eachSystem supportedSystems (
      system:
      let
        pkgs = mkPkgs system;
        toolPackages = mkToolPackages pkgs;
        switchApp = mkSwitchApp system pkgs;
        gcApp = mkGcApp system pkgs;
        generationsApp = mkGenerationsApp system pkgs;
      in
      {
        apps = {
          switch = {
            type = "app";
            program = "${switchApp}/bin/dot-switch";
            meta.description = "Switch to the Home Manager configuration for this host";
          };

          gc = {
            type = "app";
            program = "${gcApp}/bin/dot-gc";
            meta.description = "Expire old generations and garbage-collect the Nix store";
          };

          generations = {
            type = "app";
            program = "${generationsApp}/bin/dot-generations";
            meta.description = "List Home Manager generations";
          };
        };

        checks = mkLintChecks pkgs;

        devShells.default = pkgs.mkShell {
          packages = toolPackages.devShell ++ [
            switchApp
            gcApp
            generationsApp
          ];
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

      nixosConfigurations = {
        nixos = mkNixosConfiguration "x86_64-linux";
      };
    };
}
