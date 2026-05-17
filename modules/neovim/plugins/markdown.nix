_:

{
  programs.nixvim = {
    plugins = {
      render-markdown = {
        enable = true;
        lazyLoad.settings.ft = [
          "Avante"
          "markdown"
        ];
        settings = {
          file_types = [
            "Avante"
            "markdown"
          ];
          heading = {
            sign = false;
            border = true;
          };
          code = {
            sign = false;
            width = "block";
            left_pad = 2;
            right_pad = 2;
          };
        };
      };

      markdown-preview = {
        enable = true;
        lazyLoad.settings.cmd = [
          "MarkdownPreviewToggle"
          "MarkdownPreview"
          "MarkdownPreviewStop"
        ];
      };
    };

    keymaps = [
      {
        mode = "n";
        key = "<leader>cp";
        action = "<cmd>MarkdownPreviewToggle<cr>";
        options = {
          desc = "Markdown Preview";
          silent = true;
          noremap = true;
        };
      }
    ];
  };
}
