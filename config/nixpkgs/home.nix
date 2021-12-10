{ config, pkgs, ... }:

let
  pkgs = import <nixpkgs> {
    config.allowUnfree = true;
  };

in {
  programs.home-manager.enable = true;

  home.username = "issy";
  home.homeDirectory = "/home/issy";

  home.stateVersion = "21.11";
  home.packages = [
    # zsh
    pkgs.zsh-autosuggestions
    pkgs.zsh-syntax-highlighting

    # git
    pkgs.tig
    pkgs.gh

    # cli tools
    pkgs.awscli2
    pkgs.gh
    pkgs.gnumake
    pkgs.google-cloud-sdk
    pkgs.helm
    pkgs.jq
    pkgs.ripgrep
    pkgs.ssm-session-manager-plugin
  ];

  programs.zsh = {
    enable = true;
    enableAutosuggestions = true;
    enableSyntaxHighlighting = true;
    defaultKeymap = "viins";
    shellAliases = {
      ts = "tig status";
    };
  };

  programs.starship = {
    enable = true;
    settings = {
      add_newline = false;
      format = ''
[┌─](bold)$time $memory_usage$cmd_duration$git_branch$git_commit$git_state$git_status
[│](bold) $status$directory
[└─](bold)$character
      '';
      character = {
        success_symbol = "[>](bold)";
        error_symbol = ">(bold)";
        vicmd_symbol = "|(bold)";
      };
      status = {
        disabled = false;
        format   = "[ $symbol$status ]($style) ";
        symbol   = " ";
        style    = "RED BOLD";
      };
      time = {
        disabled    = false;
        time_format = "%Y-%m-%dT%H:%M:%S";
        format      = "[$time]($style)";
      };
      cmd_duration = {
        disabled = false;
        format   = "[ $duration]($style) ";
        min_time = 1000;
      };
      directory = {
        truncation_length = 10;
      };
      git_branch = {
        always_show_remote = true;
        format = "on [$symbol $branch]($style) ";
        style  = "fg:214";
        symbol = "";
      };
      git_status = {
        format = "[$all_status$ahead$behind]($style)";
        style  = "";

        deleted   = "[ $count ](red bold)";
        renamed   = "[ $count ](green bold)";
        modified  = "[ $count ](yellow bold)";
        staged    = "[ $count ](green bold)";
        untracked = "[ $count ](fg:8 bold)";
        ahead     = "↑ $count ";
        behind    = "↓ $count ";
      };
    };
  };

  programs.git = {
    enable = true;
    userName = "d-issy";
    userEmail = "12374694+d-issy@users.noreply.github.com";
    extraConfig = {
      init = {
        defaultBranch = "main";
      };
      color = {
        ui = "auto";
        diff = "true";
      };
      core = {
        editor = "vim";
      };
    };
  };

  programs.neovim = {
    enable = true;
    viAlias = true;
    vimAlias = true;

    plugins = with pkgs.vimPlugins; [
      {
        plugin = emmet-vim;
      }
      {
        plugin = nvim-lspconfig;
        config = ''
          lua << EOF
            local nvim_lsp = require('lspconfig')

            local on_attach = function(client, bufnr)
              local function buf_set_option(...) vim.api.nvim_buf_set_option(bufnr, ...) end
              buf_set_option('omnifunc', 'v:lua.vim.lsp.omnifunc')
            end

            local servers = {'tsserver'}
            for _, lsp in ipairs(servers) do
              nvim_lsp[lsp].setup { on_attach = on_attach }
            end
          EOF
        '';
      }
    ];
  };

  programs.tmux = {
    enable = true;
    prefix = "C-q";
    keyMode = "vi";
    baseIndex = 1;
    clock24 = true;
    customPaneNavigationAndResize = true;
    extraConfig = ''
    bind \" split-window -v
    '';
  };

  programs.exa = {
    enable = true;
    enableAliases = true;
  };

  programs.fzf = {
    enable = true;
  };

  programs.zoxide = {
    enable = true;
  };
}
