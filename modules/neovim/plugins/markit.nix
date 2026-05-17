{ pkgs, ... }:

let
  optionalPlugins = map (plugin: { inherit plugin; optional = true; });

  pickme-nvim = pkgs.vimUtils.buildVimPlugin {
    pname = "pickme.nvim";
    version = "2025-06-12";
    src = pkgs.fetchFromGitHub {
      owner = "2kabhishek";
      repo = "pickme.nvim";
      rev = "3bfd63fa0a1fa362afc9dfa86b83100e75903e6b";
      sha256 = "119qhpv2vvlkchqfdyv9g6zl58527gnvvkrq0zb0b1vbdhm5n5qp";
    };
  };

  markit-nvim = pkgs.vimUtils.buildVimPlugin {
    pname = "markit.nvim";
    version = "2025-06-12";
    src = pkgs.fetchFromGitHub {
      owner = "2kabhishek";
      repo = "markit.nvim";
      rev = "c716195d5b0b21ef03a20a1facc46d33ca9f7c49";
      sha256 = "19gc6c39hc1zf4vmq027lpndgvbgcczybi009ji8c367xla2k3j5";
    };
  };
in
{
  programs.nixvim = {
    extraPlugins = optionalPlugins [
      pickme-nvim
      markit-nvim
    ];

    plugins.lz-n.plugins = [
      {
        __unkeyed-1 = "markit.nvim";
        event = [
          "BufReadPre"
          "BufNewFile"
        ];
        before = ''
          function()
            require("lz.n").trigger_load("pickme.nvim")
          end
        '';
        after = ''
          function()
            require("markit").setup({
              default_mappings = true,
              signs = true,
            })
          end
        '';
      }
    ];
  };
}
