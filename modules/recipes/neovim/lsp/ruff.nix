_:

{
  programs.nixvim.lsp.servers.ruff = {
    enable = true;
    config.init_options.settings = {
      organizeImports = true;
      showSyntaxErrors = true;
    };
  };
}
