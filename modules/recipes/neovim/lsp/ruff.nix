_:

{
  programs.nixvim.lsp.servers.ruff = {
    enable = true;
    config.initOptions.settings = {
      organizeImports = true;
      showSyntaxErrors = true;
    };
  };
}
