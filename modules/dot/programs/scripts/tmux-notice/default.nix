{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.scripts.tmuxNotice;

  noticeType = lib.types.submodule {
    options = {
      icons = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ "•" ];
        description = "Notice icons. Multiple icons are animated in tmux status/window aggregations.";
      };

      title = lib.mkOption {
        type = lib.types.nullOr lib.types.str;
        default = null;
        description = "Optional notice title used by titleMode = notice, or as current-title fallback.";
      };

      titleMode = lib.mkOption {
        type = lib.types.enum [
          "current"
          "name"
          "notice"
          "none"
        ];
        default = "current";
        description = "How tmux-notice derives @pane_notice_title.";
      };

      stripPatterns = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ ];
        description = "Regular expressions stripped from derived notice titles.";
      };

      paneTitle = {
        enable = lib.mkEnableOption "setting the tmux pane title while the notice is active";

        template = lib.mkOption {
          type = lib.types.str;
          default = "{icon} {title}";
          description = "Pane title template. Supports {icon}, {title}, and {name}.";
        };

        restoreOnClear = lib.mkOption {
          type = lib.types.bool;
          default = true;
          description = "Whether to restore the original tmux pane title when clearing the notice.";
        };
      };
    };
  };

  configFile = pkgs.writeText "tmux-notice-config.json" (
    builtins.toJSON {
      inherit (cfg) fallback notices;
    }
  );

  tmuxNoticeScript = import ./script.nix {
    inherit configFile lib;
  };

  tmuxNotice = pkgs.writeShellApplication {
    name = "tmux-notice";
    runtimeInputs = [
      pkgs.jq
      cfg.tmuxPackage
    ];
    text = tmuxNoticeScript;
  };
in
{
  options.dot.programs.scripts.tmuxNotice = {
    enable = lib.mkEnableOption "tmux pane notice command";

    tmuxPackage = lib.mkPackageOption pkgs "tmux" { };

    fallback = lib.mkOption {
      type = noticeType;
      default = {
        icons = [ "•" ];
        titleMode = "name";
      };
      description = "Fallback notice used when a notice name is not configured.";
    };

    notices = lib.mkOption {
      type = lib.types.attrsOf noticeType;
      default = { };
      description = "Named tmux notices used by tmux-notice on <name>.";
    };

    clearOnSelect = {
      enable = lib.mkOption {
        type = lib.types.bool;
        default = true;
        description = "Whether tmux should clear the selected pane's notice when that pane/window is selected.";
      };

      hookIndex = lib.mkOption {
        type = lib.types.int;
        default = 80;
        description = "Indexed tmux hook slot used for notice clear-on-select hooks.";
      };
    };

    package = lib.mkOption {
      type = lib.types.package;
      readOnly = true;
      default = tmuxNotice;
      description = "Generated tmux-notice package.";
    };
  };

  config = lib.mkIf (config.dot.programs.scripts.enable && cfg.enable) {
    home.packages = [ cfg.package ];
  };
}
