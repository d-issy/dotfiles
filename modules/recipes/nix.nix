{ config, pkgs, ... }:

let
  # Entries that run this repository's flake apps.
  dotfiles.paths = [ "${config.dot.programs.ghq.root}/github.com/d-issy/dotfiles" ];
in
{
  config.home = {
    packages = [ pkgs.dotApps.agent-sessions ];
    shellAliases = {
      # Follow the active profile even when direnv keeps an older devShell on PATH.
      agent-session = "${config.home.profileDirectory}/bin/agent-session";
      as = "agent-session";
    };
  };

  config.dot.programs.commandLibrary.groups.nix.sections = [
    {
      tags = [ "nix apply" ];
      when = dotfiles;
      entries = [
        {
          description = "apply home-manager configuration for this machine";
          command = "nix run .#apply -- --max-jobs auto --cores 1";
        }
      ];
    }
    {
      tags = [ "nix flake" ];
      entries = [
        {
          description = "update all flake inputs";
          command = "nix flake update";
        }
        {
          description = "check flake without building derivations";
          command = "nix flake check --no-build";
        }
        {
          description = "show flake outputs";
          command = "nix flake show";
        }
      ];
    }
    {
      tags = [ "nix generations" ];
      when = dotfiles;
      entries = [
        {
          description = "list home-manager generations";
          command = "nix run .#generations";
        }
      ];
    }
    {
      tags = [ "nix agent-sessions" ];
      when = dotfiles;
      entries = [
        {
          description = "watch Claude Code and Codex sessions live";
          alias = "agent-sessions";
          command = "nix run .#agent-sessions";
        }
      ];
    }
    {
      tags = [ "nix gc" ];
      when = dotfiles;
      entries = [
        {
          description = "expire old generations and garbage collect";
          command = "nix run .#gc";
        }
      ];
    }
  ];
}
