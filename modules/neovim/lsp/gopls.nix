{ ... }:

{
  programs.nixvim.lsp.servers.gopls = {
    enable = true;
    config.settings.gopls = {
      completeUnimported = true;
      usePlaceholders = true;
      matcher = "fuzzy";
      deepCompletion = true;
      codelenses = {
        generate = true;
        gc_details = true;
        test = true;
        tidy = true;
        upgrade_dependency = true;
        vendor = true;
      };
      hints = {
        assignVariableTypes = false;
        compositeLiteralFields = true;
        compositeLiteralTypes = true;
        constantValues = false;
        functionTypeParameters = true;
        parameterNames = true;
        rangeVariableTypes = false;
      };
    };
  };
}
