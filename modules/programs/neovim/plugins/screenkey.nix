{ pkgs, dot, ... }:

let
  optionalPlugins = map (plugin: {
    inherit plugin;
    optional = true;
  });

  screenkey-nvim = pkgs.vimUtils.buildVimPlugin {
    pname = "screenkey.nvim";
    version = "2025-06-12";
    src = pkgs.fetchFromGitHub {
      owner = "NStefan002";
      repo = "screenkey.nvim";
      rev = "16390931d847b1d5d77098daccac4e55654ac9e2";
      sha256 = "0s7hv839jmxbqrsxr26lid7920j0xyaixphnj2mjnv0hcy8qhv0h";
    };
  };
in
{
  programs.nixvim = {
    extraPlugins = optionalPlugins [ screenkey-nvim ];

    plugins.lz-n.plugins = [
      {
        __unkeyed-1 = "screenkey.nvim";
        cmd = "Screenkey";
        keys = [
          {
            __unkeyed-1 = "<leader>uk";
            __unkeyed-2 = "<cmd>Screenkey<cr>";
            desc = "Toggle Screenkey";
          }
        ];
        after = ''
          function()
          ${builtins.readFile (dot.files + "/nvim/lua/nixvim/plugins/screenkey.lua")}
          end
        '';
      }
    ];
  };
}
