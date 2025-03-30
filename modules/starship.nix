{ config, lib, pkgs, ... }:

let
  settings = {
    add_newline = false;
    scan_timeout = 10;
    command_timeout = 100;

    format = lib.strings.concatStringsSep "" [
      "$directory"
      "$localip"
      "$golang"
      "$nodejs"
      "$python"
      "$aws"
      "$gcloud"
      "$terraform"
      "$status"
      "$line_break"
      "$character"
    ];

    right_format = lib.strings.concatStringsSep "" [
      "$git_branch"
      "$git_metrics"
      "$memory_usage"
      "$battery"
      "$cmd_duration"
    ];

    # basic
    character.vimcmd_symbol = "[N](green)";
    fill = {
      symbol = "-";
      disabled = false;
    };
    directory = {
      truncation_length = 5;
      truncation_symbol = "*";
    };
    localip = {
      ssh_only = true;
      disabled = false;
    };
    status = {
      format = "[$status](red) ";
      disabled = false;
    };
    memory_usage = {
      format = "[mem=$ram_pct]($style) ";
      disabled = false;
    };
    time = {
      format = "[$time]($style) ";
      time_format = "%R";
      disabled = false;
    };
    cmd_duration = {
      format = "[$duration]($style) ";
      min_time = 1000;
      show_milliseconds = false;
    };
    # git
    git_branch = {
      format = "[$symbol$branch]($style) ";
      symbol = "";
    };
    git_status.disabled = true;
    git_metrics.disabled = false;

    #language
    package.disabled = true;
    golang = { format = "([go=$version](yellow) )"; version_format = "$\{major}.$\{minor}"; };
    nodejs = { format = "([node=$version](yellow) )"; version_format = "$\{major}"; };
    python = { format = "([py=$version](yellow) )"; version_format = "$\{major}.$\{minor}"; };
    terraform = { format = "([tf=$version](yellow) )"; version_format = "$\{raw}"; };

    # cloud
    aws = { format = "(aws:[$profile](yellow) )"; };
    gcloud = { format = "(gcp:[$active](yellow)(:[$project](yellow)) )"; detect_env_vars = [ "CLOUDSDK_ACTIVE_CONFIG_NAME" ]; };
  };
in
{
  programs.starship = {
    enable = true;
    settings = settings;
  };
}
