{ config, lib, pkgs, ... }:

with lib;

{
  config = {
    programs.mise = {
      enable = true;

      globalConfig = {
        tools = {
          deno = "latest";
          flutter = "latest";
          golang = "1.24";
          java = "adoptopenjdk-21";
          kotlin = "2";
          lua = "5";
          node = "22";
          python = "3";
          ruby = "3.4";
          rust = "1";
          terraform = "1";
        };
        settings = {
          jobs = 2;
          trusted_config_paths = [ "~/.config/mise" ];
          idiomatic_version_file = true;
          idiomatic_version_file_enable_tools = [ "ruby" ];
          not_found_auto_install = false;
          status = {
            missing_tools = "never";
          };
        };
      };
    };

    programs.nushell.extraConfig = mkAfter ''
      $env.config = ($env.config? | default {})
      $env.config.hooks = ($env.config.hooks? | default {})
      $env.config.hooks.pre_prompt = (
        $env.config.hooks.pre_prompt?
        | default []
        | prepend {
          let ops = (
            ${pkgs.mise}/bin/mise hook-env -s nu
            | from csv --noheaders
            | rename 'op' 'name' 'value'
          )
          if ($ops | is-empty) {
            return
          }
          for $it in $ops {
            if $it.op == "set" {
              let value = if $it.name == "PATH" { $it.value | split row (char esep) | uniq } else { $it.value }
              load-env {($it.name): $value}
            } else if $it.op == "hide" {
              hide-env $it.name
            }
          }
        }
      )
    '';
  };
}
