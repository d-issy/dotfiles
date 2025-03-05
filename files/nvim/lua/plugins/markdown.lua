return {
  {
    "MeanderingProgrammer/render-markdown.nvim",
    ft = { "Avante", "markdown" },
    opts = {
      file_types = { "Avante", "markdown" },
      heading = {
        sign = false,
        border = true,
      },
      code = {
        sign = false,
        width = "block",
        left_pad = 2,
        right_pad = 2,
      },
    },
  },
  {
    "iamcco/markdown-preview.nvim",
    cmd = { "MarkdownPreviewToggle", "MarkdownPreview", "MarkdownPreviewStop" },
    build = function()
      require("lazy").load { plugins = { "markdown-preview.nvim" } }
      vim.fn["mkdp#util#install"]()
    end,
    keys = {
      {
        "<leader>cp",
        ft = "markdown",
        "<cmd>MarkdownPreviewToggle<cr>",
        desc = "Markdown Preview",
      },
    },
    config = function()
      vim.cmd [[do FileType]]
    end,
  },
}
