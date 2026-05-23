_:

{
  programs.nixvim.lsp.servers.basedpyright = {
    enable = true;
    config.settings.basedpyright.analysis = {
      autoSearchPaths = true;
      diagnosticMode = "workspace";
      typeCheckingMode = "standard";
      useLibraryCodeForTypes = true;
    };
  };
}
