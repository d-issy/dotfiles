_:

let
  raw = __raw: { inherit __raw; };

  keymap = mode: key: action: desc: {
    inherit mode key action;
    options = {
      inherit desc;
      silent = true;
      noremap = true;
    };
  };

  jsTsFormatter = ''
    function(buf)
      local fname = vim.api.nvim_buf_get_name(buf)
      local dir = fname ~= "" and vim.fs.dirname(fname) or vim.uv.cwd()

      local oxfmt = vim.fs.find({ ".oxfmtrc.json", ".oxfmtrc.jsonc" }, { upward = true, path = dir })
      if #oxfmt > 0 then
        return { "oxfmt" }
      end

      local biome = vim.fs.find({ "biome.json", "biome.jsonc" }, { upward = true, path = dir })
      if #biome > 0 then
        return { "biome" }
      end

      return { "prettierd", "prettier", stop_after_first = true }
    end
  '';
in
{
  programs.nixvim = {
    plugins.conform-nvim = {
      enable = true;

      lazyLoad.settings = {
        event = [
          "BufReadPost"
          "BufNewFile"
        ];
        cmd = [ "ConformInfo" ];
      };

      settings = {
        default_format_opts = {
          timeout_ms = 3000;
          async = false;
          quiet = false;
          lsp_format = "fallback";
        };

        formatters.oxfmt = {
          command = "oxfmt";
          args = [
            "--stdin-filepath"
            "$FILENAME"
          ];
          stdin = true;
        };

        formatters_by_ft = {
          python.__raw = ''
            function(buf)
              if require("conform").get_formatter_info("ruff_format", buf).available then
                return { "ruff_format" }
              end
              return { "black", "isort" }
            end
          '';

          go = [
            "goimports"
            "gofumpt"
          ];
          json = [ "jq" ];
          lua = [ "stylua" ];
          rust = [ "rustfmt" ];
          sh = [ "shfmt" ];
          proto = [ "buf" ];

          javascript.__raw = jsTsFormatter;
          javascriptreact.__raw = jsTsFormatter;
          typescript.__raw = jsTsFormatter;
          typescriptreact.__raw = jsTsFormatter;

          markdown = {
            __unkeyed-1 = "prettierd";
            __unkeyed-2 = "prettier";
            stop_after_first = true;
          };
          "markdown.mdx" = {
            __unkeyed-1 = "prettierd";
            __unkeyed-2 = "prettier";
            stop_after_first = true;
          };

          terraform = [ "terraform_fmt" ];
          terraform-vars = [ "terraform_fmt" ];
          tf = [ "terraform_fmt" ];
        };
      };

      luaConfig.post = ''
        local format = require("util.format")
        local conform = require("conform")

        vim.opt.formatexpr = "v:lua.require'conform'.formatexpr()"

        vim.api.nvim_create_autocmd("BufWritePre", {
          pattern = "*",
          callback = function(args)
            if format.enabled() then
              conform.format({ bufnr = args.buf })
            end
          end,
        })
      '';
    };

    keymaps = [
      (keymap [
        "n"
        "v"
      ] "<leader>cf" (raw ''function() require("conform").format({ async = true }) end'') "Format Buffer")
      (keymap "n" "<leader>uf" (raw ''function() require("util.format").toggle(true) end'')
        "Toggle Buffer AutoFormat"
      )
      (keymap "n" "<leader>uF" (raw ''function() require("util.format").toggle() end'')
        "Toggle Global AutoFormat"
      )
    ];
  };
}
