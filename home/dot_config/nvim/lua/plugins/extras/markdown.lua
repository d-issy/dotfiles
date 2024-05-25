return {
  {
    "iamcco/markdown-preview.nvim",
    ft = "markdown",
    cmd = { "MarkdownPreviewToggle", "MarkdownPreview", "MarkdownPreviewStop" },
    build = function() vim.fn["mkdp#util#install"]() end,
    keys = {
      {
        "<leader>cp",
        ft = "markdown",
        "<cmd>MarkdownPreviewToggle<cr>",
        desc = "Markdown Preview",
      },
    },
    config = function() vim.cmd [[do FileType]] end,
  },
  {
    "MeanderingProgrammer/markdown.nvim",
    ft = "markdown",
    dependences = "nvim-treesitter",
    keys = {
      {
        "<leader>uc",
        function()
          local conceallevel = vim.o.conceallevel > 0 and vim.o.conceallevel or 3
          require("lazyvim.util").toggle("conceallevel", false, { 0, conceallevel })
          if vim.bo.filetype == "markdown" then
            require("render-markdown").toggle()
          end
        end,
        desc = "Toggle Conceal",
      },
    },
    opts = {
      headings = { "# ", "## ", "### ", "#### ", "##### ", "###### " },
      conceal = {
        default = 0,
        rendered = 3,
      },
    },
  },
}
