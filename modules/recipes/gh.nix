{ config, pkgs, ... }:

{
  config = {
    programs.gh = {
      enable = true;
      settings = {
        git_protocol = "ssh";
        aliases = {
          prs = "f prs";
          grep = "f greps";
        };
      };
      extensions = with pkgs; [
        gh-dash
        gh-f
        gh-notify
        gh-stack
      ];
    };

    dot.programs.commandLibrary.groups.gh.sections = [
      {
        tags = [
          "gh"
          "github"
        ];
        variables = {
          subcommand = "${pkgs.coreutils}/bin/printf '%s\\n' auth browse codespace gist issue org pr project release repo";
          base_branch = "${config.programs.git.package}/bin/git branch --format='%(refname:short)'";
          pull_number = {
            command = "${config.programs.gh.package}/bin/gh pr list";
            column = 1;
            delimiter = "\t";
          };
          pull_numbers = {
            command = "${config.programs.gh.package}/bin/gh pr list";
            column = 1;
            delimiter = "\t";
            multi = true;
          };
        };
        entries = [
          {
            description = "Github CLI";
            command = "gh <subcommand>";
          }
          {
            description = "open github issue/pull/commit_hash/file etc...";
            command = "gh browse <target>";
          }
          {
            description = "open repository settings";
            command = "gh browse --settings";
          }
          {
            description = "open pull request";
            command = "gh pr view --web";
          }
          {
            description = "create pull request";
            command = "gh pr create";
          }
          {
            description = "create draft pull request";
            command = "gh pr create --draft";
          }
          {
            description = "create pull request with base branch";
            command = "gh pr create --base <base_branch>";
          }
          {
            description = "checkout pull request";
            command = "gh pr checkout <pull_number>";
          }
          {
            description = "gh pr ready (draft to ready)";
            command = "gh pr ready";
          }
          {
            description = "merge pull request";
            command = "gh pr merge --delete-branch";
          }
          {
            description = "close pull request";
            command = "gh pr close";
          }
          {
            description = "list pull request";
            command = "gh pr list";
          }
          {
            description = "approve pull request";
            command = "echo '<pull_numbers>' | xargs -n1 -P4 gh pr review --approve";
          }
          {
            description = "list pull request by me";
            command = "gh pr list --author '@me'";
          }
          {
            description = "github login via cli";
            command = "gh auth login";
          }
        ];
      }
      {
        tags = [ "gh copilot" ];
        entries = [
          {
            description = "gh copilot suggest shell command";
            command = "gh copilot suggest --target shell";
          }
          {
            description = "gh install/update copilot extension";
            command = "gh extension install github/gh-copilot --force";
          }
        ];
      }
    ];
  };
}
