{ pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.ghq ];

    programs = {
      git.settings.ghq.root = "~/code";

      zsh.initContent = ''
        function zr() {
          cd $(${pkgs.ghq}/bin/ghq list -p  | fzf)
        }
      '';

      nushell.extraConfig = ''
        export def --env zr [] {
          cd (${pkgs.ghq}/bin/ghq list -p  | fzf)
        }
      '';
    };

    dot.programs.navi.cheats.ghq.sections = [
      {
        entries = [
          {
            description = "GHQ Clone repository";
            command = "ghq get <git_repo>";
          }
        ];
        variables.git_repo = "echo git@github.com:<username>/<repo>.git";
      }
    ];
  };
}
