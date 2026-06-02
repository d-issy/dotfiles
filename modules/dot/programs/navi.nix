{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.navi;

  mkDescriptionText = description: lib.optionalString (description != "") " ${description}";

  mkAliasText = alias: lib.optionalString (alias != null) " :: ${alias}";

  mkEntry =
    entry: "#${mkDescriptionText entry.description}${mkAliasText entry.alias}\n${entry.command}";

  mkShellAliasEntry = alias: command: "# ${command} :: ${alias}\n${command}";

  mkVariable = name: command: "$ ${name}: ${command}";

  mkSection =
    cheatName: section:
    let
      tags = if section.tags == [ ] then [ cheatName ] else section.tags;
      entries = lib.concatStringsSep "\n\n" (map mkEntry section.entries);
      variables = lib.concatStringsSep "\n" (lib.mapAttrsToList mkVariable section.variables);
      body = lib.concatStringsSep "\n\n" (
        lib.filter (value: value != "") [
          entries
          variables
        ]
      );
    in
    "% ${lib.concatStringsSep ", " tags}\n\n${body}";

  mkCheatText =
    cheatName: cheat: "${lib.concatStringsSep "\n\n" (map (mkSection cheatName) cheat.sections)}\n";

  mkCheatFile =
    cheatName: cheat:
    lib.nameValuePair "cheats/${cheatName}.cheat" {
      text = mkCheatText cheatName cheat;
    };

  shellAliasesFile = lib.optionalAttrs (cfg.enableShellAliases && config.home.shellAliases != { }) {
    "cheats/aliases.cheat".text = ''
      % aliases

      ${lib.concatStringsSep "\n\n" (lib.mapAttrsToList mkShellAliasEntry config.home.shellAliases)}
    '';
  };
in
{
  options.dot.programs.navi = {
    enable = lib.mkEnableOption "navi";

    package = lib.mkOption {
      type = lib.types.nullOr lib.types.package;
      default = null;
      description = "navi package to install. When null, pkgs.navi is used only if navi is enabled.";
    };

    enableShellAliases = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Whether to generate navi entries from home.shellAliases.";
    };

    zshIntegration.enable = lib.mkEnableOption "zsh integration";

    nushellIntegration.enable = lib.mkEnableOption "nushell integration";

    settings = lib.mkOption {
      type = lib.types.attrs;
      default = { };
      description = "Settings written to navi/config.yaml.";
    };

    cheats = lib.mkOption {
      type = lib.types.attrsOf (
        lib.types.submodule {
          options.sections = lib.mkOption {
            type = lib.types.listOf (
              lib.types.submodule {
                options = {
                  tags = lib.mkOption {
                    type = lib.types.listOf lib.types.str;
                    default = [ ];
                    description = "Section tags. Defaults to the cheat name when empty.";
                  };

                  entries = lib.mkOption {
                    type = lib.types.listOf (
                      lib.types.submodule {
                        options = {
                          description = lib.mkOption {
                            type = lib.types.str;
                            description = "Entry description.";
                          };

                          alias = lib.mkOption {
                            type = lib.types.nullOr lib.types.str;
                            default = null;
                            description = "Entry alias shown after :: in the description.";
                          };

                          command = lib.mkOption {
                            type = lib.types.lines;
                            description = "Entry command.";
                          };
                        };
                      }
                    );
                    default = [ ];
                    description = "Cheat entries.";
                  };

                  variables = lib.mkOption {
                    type = lib.types.attrsOf lib.types.lines;
                    default = { };
                    description = "Navi variables for this section.";
                  };
                };
              }
            );
            default = [ ];
            description = "Cheat sections.";
          };
        }
      );
      default = { };
      description = "Navi cheats to generate under ~/cheats.";
      example.git.sections = [
        {
          tags = [ "git" ];
          entries = [
            {
              description = "Git Status";
              alias = "gs";
              command = "git status";
            }
          ];
        }
      ];
    };
  };

  config = lib.mkIf cfg.enable (
    let
      package = if cfg.package == null then pkgs.navi else cfg.package;
      yamlFormat = pkgs.formats.yaml { };
    in
    {
      home.packages = [ package ];

      programs.zsh.initContent = lib.mkIf cfg.zshIntegration.enable ''
        eval "$(${package}/bin/navi widget zsh)"
      '';

      programs.nushell.extraConfig = lib.mkIf cfg.nushellIntegration.enable ''
        export def nv [] {
          let cmd = navi --print | complete | get "stdout" | str trim
          match ($cmd | is-empty) {
            true => { return }
            false => {
              try {
                nu -c $cmd
              } catch { |err| $err.msg }
            }
          }
          input "\n(process exit)"
        }

        export def _navi_widget [] {
          let input = (commandline)

          match ($input | is-empty) {
            true => {navi --print | complete | get "stdout"}
            false => {
              let replacement = (navi --print --query $input --best-match | complete | get "stdout" | str trim)

              match ($replacement | str trim | is-empty) {
                false => $replacement
                true => $input
              }
            }
          }
          | str trim
          | commandline edit --replace $in

          commandline set-cursor --end
        }

        let nav_keybinding = {
          name: "navi",
          modifier: control,
          keycode: char_g,
          mode: [emacs, vi_normal, vi_insert],
          event: {
            send: executehostcommand,
            cmd: _navi_widget,
          }
        }

        $env.config.keybindings = ($env.config.keybindings | append $nav_keybinding)
      '';

      xdg.configFile."navi/config.yaml" = lib.mkIf (cfg.settings != { }) {
        source = yamlFormat.generate "navi-config" cfg.settings;
      };

      home.file = shellAliasesFile // builtins.listToAttrs (lib.mapAttrsToList mkCheatFile cfg.cheats);
    }
  );
}
