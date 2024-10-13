{ config, lib, pkgs, ... }:

let
  home = config.home;
in
{
  config = {
    home.packages = [ pkgs.nu_scripts ];

    programs.nushell = {
      enable = true;

      shellAliases = home.shellAliases // {
        ll = "ls -l";
        la = "ls -la";
      };

      environmentVariables = lib.attrsets.mapAttrs (name: value: ''"${value}"'') (home.sessionVariables // {
        # disable indicator vi
        PROMPT_INDICATOR_VI_NORMAL = "";
        PROMPT_INDICATOR_VI_INSERT = "";
      });

      extraConfig =
        let
          toList = item: if builtins.isString item then [ item ] else item;
          source =
            let fn = path: ''source ${pkgs.nu_scripts}/share/nu_scripts/${path}'';
            in
            paths:
            builtins.foldl'
              (prev: next: "${prev}\n${next}") ""
              (map (path: fn path) (toList paths));
          use =
            let fn = path: ''use ${pkgs.nu_scripts}/share/nu_scripts/${path} *'';
            in
            paths:
            builtins.foldl'
              (prev: next: "${prev}\n${next}") ""
              (map (path: fn path) (toList paths));
          getModulePath = name: "modules/${name}.nu";
          getCompletionPath = name: "custom-completions/${name}/${name}-completions.nu";
          getCompletionAutoGeneratePath = name: "custom-completions/auto-generate/completions/${name}.nu";
          modules = [
            "docker/mod"
            "git/git"
            "nix/nix"
          ];
          completions = [
            "bat"
            "btm"
            "cargo"
            "curl"
            "docker"
            "flutter"
            "gh"
            "git"
            "less"
            "make"
            "man"
            "mysql"
            "nix"
            "npm"
            "op"
            "pass"
            "poetry"
            "pytest"
            "rg"
            "ssh"
            "tar"
          ];
          autoCompletions = [
            "aws"
            "fzf"
            "go"
            "python"
            "terraform"
            "wget"
          ];
        in
        ''
          $env.config.show_banner = false
          $env.config.edit_mode = "vi"

          $env.config.ls.use_ls_colors = false
          $env.config.cursor_shape.vi_insert = "line"
          $env.config.cursor_shape.vi_normal = "block"

          ${use (map getModulePath modules)}
          ${use (map getCompletionPath completions)}
          ${use (map getCompletionAutoGeneratePath autoCompletions)}
        '';
    };
  };
}



