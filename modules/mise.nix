{ config, pkgs, ... }:

{
  config = {
    programs.mise = {
      enable = true;

      globalConfig = {
        tools = {
          deno = "latest";
          flutter = "latest";
          golang = "1.22";
          java = "adoptopenjdk-21";
          kotlin = "2";
          lua = "5";
          node = [ "20" "22" ];
          python = [ "3.12" "3.11" ];
          ruby = "3.3";
          rust = "1";
          scala = "3.4";
          terraform = [ "latest" "1.5" ];
        };
      };

      settings = {
        legacy_version_file = true;
        trusted_config_paths = [ "~/.config/mise" ];
        jobs = 2;
        experimental = true;
        not_found_auto_install = false;
        status = {
          missing_tools = "never";
        };
      };
    };

    home.file.".default-python-packages".source = ../files/.default-python-packages;
  };
}
