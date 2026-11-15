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
        "aarch64-darwin"
      ];

      homeConfigurationNames = {
        x86_64-linux = "linux";
        aarch64-darwin = "macos";
      };

      mkPkgs =
        system:
        import nixpkgs {
          inherit system;
        };

      mkToolPackages = pkgs: rec {
        formatter = with pkgs; [
          nixfmt
          oxfmt
          rustfmt
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
            cargo
            cargo-audit
            clippy
            rustc
            nodejs_26
            pnpm
          ]);
      };

      mkApplyApp =
        system: pkgs:
        let
          homeConfigurationName = homeConfigurationNames.${system};
        in
        pkgs.writeShellApplication {
          name = "apply";
          runtimeInputs = [ home-manager.packages.${system}.default ];
          text = ''
            exec home-manager switch --flake "${self}#${homeConfigurationName}" "$@"
          '';
        };

      mkGcApp =
        system: pkgs:
        pkgs.writeShellApplication {
          name = "gc";
          runtimeInputs = [ home-manager.packages.${system}.default ];
          text = ''
            home-manager expire-generations '-7 days'
            nix store gc
          '';
        };

      mkGenerationsApp =
        system: pkgs:
        pkgs.writeShellApplication {
          name = "generations";
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

      mkNixosCheckConfiguration =
        system: pkgs:
        let
          dotSpecialArgs = mkDotSpecialArgs pkgs;
        in
        nixpkgs.lib.nixosSystem {
          inherit system;
          specialArgs = dotSpecialArgs;
          modules = [
            { nixpkgs.pkgs = pkgs; }
            {
              networking.hostName = "nixos";

              # CI fixture only: this has no machine-specific hardware settings
              # and must never be exposed through nixosConfigurations.
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
                extraSpecialArgs = dotSpecialArgs;
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
        applyApp = mkApplyApp system pkgs;
        gcApp = mkGcApp system pkgs;
        generationsApp = mkGenerationsApp system pkgs;
        agentSessionsApp = import ./apps/agent-sessions { inherit pkgs; };
        rustChecks = import ./apps/rust-checks.nix { inherit pkgs; };
      in
      {
        apps = {
          apply = {
            type = "app";
            program = "${applyApp}/bin/apply";
            meta.description = "Apply the configuration for this host";
          };

          gc = {
            type = "app";
            program = "${gcApp}/bin/gc";
            meta.description = "Expire old generations and garbage-collect the Nix store";
          };

          generations = {
            type = "app";
            program = "${generationsApp}/bin/generations";
            meta.description = "List Home Manager generations";
          };

          agent-sessions = {
            type = "app";
            program = "${agentSessionsApp}/bin/agent-session";
            meta.description = "Watch Claude Code and Codex sessions live";
          };
        };

        checks =
          mkLintChecks pkgs
          // rustChecks
          // {
            home-manager = self.homeConfigurations.${homeConfigurationNames.${system}}.activationPackage;
            worktree-regressions = import ./tests/shell { inherit pkgs; };
            herdr-subagents-regressions = import ./tests/shell/herdr-subagents.nix { inherit pkgs; };
            agent-sessions = agentSessionsApp;
            neovim-regressions =
              pkgs.runCommand "neovim-regressions" { nativeBuildInputs = [ pkgs.neovim ]; }
                ''
                  export HOME="$TMPDIR/home"
                  export XDG_STATE_HOME="$TMPDIR/state"
                  export XDG_CACHE_HOME="$TMPDIR/cache"
                  export DOTFILES_ROOT=${./.}
                  mkdir -p "$HOME"
                  nvim --headless -u NONE -i NONE -l ${./tests/neovim/regressions.lua}
                  touch "$out"
                '';
          }
          // pkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
            nixos-home-manager = (mkNixosCheckConfiguration system pkgs).config.system.build.toplevel;
          };

        devShells.default = pkgs.mkShell {
          # Run repository apps with nix run so direnv cannot keep stale copies on PATH.
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
        inherit (home-manager.packages) aarch64-darwin;
      };

      homeConfigurations = {
        linux = mkHomeManagerConfiguration "x86_64-linux" ./modules/home/linux.nix;
        macos = mkHomeManagerConfiguration "aarch64-darwin" ./modules/home/macos.nix;
      };

    };
}
