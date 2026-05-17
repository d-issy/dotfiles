{ lib, ... }:

let
  palette = {
    none = "none";
    base = "#24273a";
    surface0 = "#363a4f";
    surface1 = "#494d64";
    surface2 = "#5b6078";
    mantle = "#1e2030";
    crust = "#181926";
    text = "#cad3f5";
    overlay0 = "#6e738d";
    overlay1 = "#8087a2";
    overlay2 = "#939ab7";
    pink = "#f5bde6";
    mauve = "#ca9ee6";
    red = "#ed8796";
    maroon = "#ee99a0";
    peach = "#f5a97f";
    yellow = "#eed49f";
    green = "#a6da95";
    teal = "#81c8be";
    sky = "#99d1db";
    sapphire = "#7dc4e4";
    blue = "#8aadf4";
    lavender = "#b7bdf8";
  };
in
{
  programs.nixvim = {
    opts = {
      pumblend = 20;
      termguicolors = true;
    };

    extraConfigLuaPost = lib.mkBefore ''
      if vim.g.colors_name then
        vim.cmd "hi clear"
      end
      vim.g.colors_name = "mytheme"
    '';

    highlightOverride = {
      Normal = { fg = palette.text; bg = palette.base; };

      CursorLine = { bg = palette.surface0; };
      NCursorLine = { link = "CursorLine"; };
      StatusLine = { fg = palette.surface2; bg = palette.surface2; };
      StatusLineNC = { fg = palette.surface2; bg = palette.surface2; };

      PMenu = { bg = palette.mantle; };
      NormalFloat = { bg = palette.mantle; };
      FloatBorder = { fg = palette.surface0; bg = palette.mantle; };
      FloatTitle = { bg = palette.mantle; };
      WinBar = { bg = palette.surface0; };
      WinBarNC = { link = "WinBar"; };

      Visual = { bg = palette.surface0; };
      Comment = { fg = palette.overlay0; };
      Search = { fg = palette.yellow; };
      CurSearch = { fg = palette.yellow; underline = true; };

      Identifier = { fg = palette.text; };
      Function = { fg = palette.text; };
      Constant = { fg = palette.text; };
      String = { fg = palette.text; };
      Statement = { fg = palette.text; };
      Variable = { fg = palette.text; };
      PreProc = { fg = palette.text; };
      Type = { fg = palette.text; };
      Todo = { fg = palette.text; };

      Special = { fg = palette.overlay2; };
      Keyword = { fg = palette.overlay2; };
      Operator = { fg = palette.overlay2; };

      LspInlayHint = { fg = palette.overlay0; };

      "@punctuation" = { link = "Special"; };
      "@variable" = { link = "Variable"; };
      "@function.builtin" = { link = "Function"; };
      "@constant.builtin" = { link = "Constant"; };
      "@module" = { fg = palette.overlay0; };
      "@lsp.mod.global" = { fg = palette.overlay0; };
      "@lsp.mod.defaultLibrary" = { fg = palette.overlay0; };
      "@lsp.typemod.keyword.documentation" = { fg = palette.text; };
      "@lsp.type.type" = { fg = palette.overlay0; };

      "@variable.parameter.go" = { fg = palette.overlay0; };
      "@property.go" = { fg = palette.overlay0; };

      "@lsp.type.namespace.python" = { fg = palette.text; };

      "@type.builtin.sql" = { fg = palette.text; };

      "@markup.raw.block.markdown" = { bg = palette.mantle; };

      DiagnosticError = { fg = palette.red; };
      DiagnosticWarn = { fg = palette.yellow; };
      DiagnosticInfo = { fg = palette.sapphire; };
      DiagnosticHint = { fg = palette.sapphire; };

      DiagnosticUnderlineError = { fg = palette.red; underline = true; };
      DiagnosticUnderlineWarn = { fg = palette.yellow; };
      DiagnosticUnderlineInfo = { underline = true; };
      DiagnosticUnderlineHint = { underline = true; };

      DiagnosticUnnecessary = { underline = true; };
      DiagnosticDeprecated = { underline = true; };

      BlinkCmpDoc = { fg = palette.base; };
      BlinkCmpDocBorder = { fg = palette.overlay0; };
      BlinkCmpGhostText = { fg = palette.overlay0; };

      BlinkCmpLabel = { fg = palette.text; bg = palette.none; };
      BlinkCmpLabelDeprecated = { link = "DiagnosticDeprecated"; };

      BlinkCmpMenu = { bg = palette.none; };

      BlinkCmpKind = { bg = palette.none; };
      BlinkCmpKindCopilot = { fg = "#6cc644"; bg = palette.none; };

      CopilotSuggestion = { fg = palette.overlay0; };
      CopilotAnnotation = { fg = palette.base; };

      Directory = { fg = palette.sapphire; };

      GitSignsAdd = { fg = palette.green; };
      GitSignsChange = { fg = palette.peach; };
      GitSignsDelete = { fg = palette.red; };

      MiniIconsAzure = { fg = palette.sapphire; };
      MiniIconsBlue = { fg = palette.blue; };
      MiniIconsCyan = { fg = palette.sapphire; };
      MiniIconsGreen = { fg = palette.green; };
      MiniIconsGrey = { fg = palette.overlay0; };
      MiniIconsOrange = { fg = palette.peach; };
      MiniIconsPurple = { fg = palette.pink; };
      MiniIconsRed = { fg = palette.red; };
      MiniIconsYellow = { fg = palette.yellow; };

      TreeSitterContext = { bg = palette.surface1; };

      RenderMarkdownCode = { bg = palette.mantle; };
      RenderMarkdownCodeInline = { bg = palette.mantle; };
      RenderMarkdownH1Bg = { fg = palette.blue; bg = palette.surface0; };
      RenderMarkdownH2Bg = { fg = palette.yellow; bg = palette.surface0; };
      RenderMarkdownH3Bg = { fg = palette.green; bg = palette.surface0; };
      RenderMarkdownH4Bg = { fg = palette.teal; bg = palette.surface0; };
      RenderMarkdownH5Bg = { fg = palette.mauve; bg = palette.surface0; };
      RenderMarkdownH6Bg = { fg = palette.pink; bg = palette.surface0; };

      SnacksPickerBorder = { fg = palette.base; bg = palette.base; };
      SnacksDiffAdd = { fg = palette.green; };
      SnacksDiffDelete = { fg = palette.red; };
      SnacksDiffContext = { fg = palette.overlay0; };
      SnacksDiffAddLineNr = { fg = palette.green; };
      SnacksDiffDeleteLineNr = { fg = palette.red; };
      SnacksDiffContextLineNr = { fg = palette.overlay0; };

      DiffAdd = { fg = palette.base; bg = palette.green; };
      DiffChange = { fg = palette.base; bg = palette.yellow; };
      DiffDelete = { fg = palette.base; bg = palette.red; };
      DiffText = { fg = palette.base; bg = palette.peach; };
    };
  };
}
