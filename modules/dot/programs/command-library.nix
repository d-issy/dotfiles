{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.commandLibrary;
  jsonFormat = pkgs.formats.json { };

  variableModule = lib.types.submodule {
    options = {
      command = lib.mkOption {
        type = lib.types.nullOr lib.types.str;
        default = null;
        description = "Command whose output provides the candidates. May reference other <placeholders>.";
      };

      values = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ ];
        description = "Static candidates used instead of a command.";
      };

      json = lib.mkOption {
        type = lib.types.nullOr lib.types.str;
        default = null;
        description = "Read candidates from JSON output with a path such as `changes[].name` (`[]` expands arrays).";
      };

      separator = lib.mkOption {
        type = lib.types.nullOr lib.types.str;
        default = null;
        description = "Regex splitting the output into candidates. Defaults to newlines.";
      };

      match = lib.mkOption {
        type = lib.types.nullOr lib.types.str;
        default = null;
        description = "Regex keeping only matching candidates; the first capture group, if any, becomes the candidate.";
      };

      replace = lib.mkOption {
        type = lib.types.listOf (
          lib.types.submodule {
            options = {
              from = lib.mkOption {
                type = lib.types.str;
                description = "Regex to replace in each candidate.";
              };
              to = lib.mkOption {
                type = lib.types.str;
                description = "Replacement text.";
              };
            };
          }
        );
        default = [ ];
        description = "Replacements applied in order to each candidate.";
      };

      unique = lib.mkOption {
        type = lib.types.bool;
        default = false;
        description = "Drop duplicate candidates.";
      };

      sort = lib.mkOption {
        type = lib.types.bool;
        default = false;
        description = "Sort candidates.";
      };

      column = lib.mkOption {
        type = lib.types.nullOr lib.types.ints.positive;
        default = null;
        description = "1-based column inserted from the selected line. The whole line is used when null.";
      };

      headers = lib.mkOption {
        type = lib.types.ints.unsigned;
        default = 0;
        description = "Number of leading output lines shown as a header instead of candidates.";
      };

      delimiter = lib.mkOption {
        type = lib.types.nullOr lib.types.str;
        default = null;
        description = "Column delimiter regex. Defaults to a tab or two or more spaces.";
      };

      multi = lib.mkOption {
        type = lib.types.bool;
        default = false;
        description = "Allow selecting multiple lines, joined with spaces.";
      };

      selectOne = lib.mkOption {
        type = lib.types.bool;
        default = true;
        description = "Pick the only candidate without opening fzf.";
      };
    };
  };

  variableType = lib.types.coercedTo lib.types.str (command: { inherit command; }) variableModule;

  sectionModule = lib.types.submodule {
    options = {
      tags = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ ];
        description = "Section tags. Defaults to the group name when empty.";
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
                description = "Alias that the shell widget expands exactly.";
              };

              command = lib.mkOption {
                type = lib.types.lines;
                description = "Entry command. <name> placeholders are filled before printing.";
              };
            };
          }
        );
        default = [ ];
        description = "Group entries.";
      };

      when = {
        paths = lib.mkOption {
          type = lib.types.listOf lib.types.str;
          default = [ ];
          description = "Activate only under one of these directories (~ is expanded). No restriction when empty.";
        };

        files = lib.mkOption {
          type = lib.types.listOf lib.types.str;
          default = [ ];
          description = "Activate only when one of these files exists in the current directory. No restriction when empty.";
        };

        searchParents = lib.mkOption {
          type = lib.types.bool;
          default = false;
          description = "Also look for `files` in parent directories.";
        };

        commands = lib.mkOption {
          type = lib.types.listOf lib.types.str;
          default = [ ];
          description = "Activate only when all of these commands are on PATH.";
        };
      };

      variables = lib.mkOption {
        type = lib.types.attrsOf variableType;
        default = { };
        description = "Candidates for <placeholders> in this section. Placeholders without a variable prompt for free text.";
      };
    };
  };

  sections = lib.concatLists (
    lib.mapAttrsToList (
      name: group:
      map (
        section: section // { tags = if section.tags == [ ] then [ name ] else section.tags; }
      ) group.sections
    ) cfg.groups
  );

  shellAliasSections = lib.optional (cfg.enableShellAliases && config.home.shellAliases != { }) {
    tags = [ "aliases" ];
    variables = { };
    entries = lib.mapAttrsToList (alias: command: {
      description = "shell alias";
      inherit alias command;
    }) config.home.shellAliases;
  };

  configFile = jsonFormat.generate "command-library.json" {
    fzf = {
      command = lib.getExe cfg.fzfPackage;
      inherit (cfg.fzf) options variableOptions;
    };
    sections = sections ++ shellAliasSections;
  };

  app = import ../../../apps/command-library { inherit pkgs; };

  package = pkgs.writeShellScriptBin "command-library" ''
    exec ${lib.getExe app} --config ${configFile} "$@"
  '';

  bin = "${config.home.profileDirectory}/bin/command-library";
in
{
  options.dot.programs.commandLibrary = {
    enable = lib.mkEnableOption "the fzf-based command library";

    fzfPackage = lib.mkPackageOption pkgs "fzf" { };

    fzf = {
      options = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ ];
        description = "fzf arguments used when picking an entry.";
      };

      variableOptions = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ ];
        description = "fzf arguments used when picking a variable value.";
      };
    };

    enableShellAliases = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Whether to add home.shellAliases as command library entries.";
    };

    zshIntegration.enable = lib.mkEnableOption "the zsh Ctrl-G widget";

    nushellIntegration.enable = lib.mkEnableOption "the nushell Ctrl-G widget and nv command";

    groups = lib.mkOption {
      type = lib.types.attrsOf (
        lib.types.submodule {
          options.sections = lib.mkOption {
            type = lib.types.listOf sectionModule;
            default = [ ];
            description = "Group sections.";
          };
        }
      );
      default = { };
      description = "Command library entries grouped by name.";
      example.docker.sections = [
        {
          variables.container_id = {
            command = "docker ps";
            headers = 1;
            column = 1;
            selectOne = false;
          };
          entries = [
            {
              description = "docker logs";
              alias = "dlogs";
              command = "docker logs -f <container_id>";
            }
          ];
        }
      ];
    };
  };

  config = lib.mkIf cfg.enable {
    home.packages = [ package ];

    programs.zsh.initContent = lib.mkIf cfg.zshIntegration.enable ''
      _dot_command_library_widget() {
        local -a args
        local result
        if [[ -n "''${BUFFER//[[:space:]]/}" ]]; then
          args=(--query "$BUFFER" --expand)
        fi
        result="$(${bin} "''${args[@]}" </dev/tty)"
        if [[ -n "$result" ]]; then
          BUFFER="$result"
          CURSOR=''${#BUFFER}
        fi
        zle reset-prompt
      }
      zle -N _dot_command_library_widget
      bindkey -M emacs '^G' _dot_command_library_widget
      bindkey -M viins '^G' _dot_command_library_widget
      bindkey -M vicmd '^G' _dot_command_library_widget
    '';

    programs.nushell.extraConfig = lib.mkIf cfg.nushellIntegration.enable ''
      export def nv [] {
        let cmd = ^${bin} | complete | get "stdout" | str trim
        if ($cmd | is-empty) { return }
        try {
          nu -c $cmd
        } catch { |err| $err.msg }
        input "\n(process exit)"
      }

      export def _dot_command_library_widget [] {
        let input = (commandline)
        let result = if ($input | str trim | is-empty) {
          ^${bin} | complete
        } else {
          ^${bin} --query $input --expand | complete
        }
        let replacement = ($result | get "stdout" | str trim)
        if not ($replacement | is-empty) {
          commandline edit --replace $replacement
          commandline set-cursor --end
        }
      }

      $env.config.keybindings = ($env.config.keybindings | append {
        name: "dot_command_library",
        modifier: control,
        keycode: char_g,
        mode: [emacs, vi_normal, vi_insert],
        event: {
          send: executehostcommand,
          cmd: _dot_command_library_widget,
        }
      })
    '';
  };
}
