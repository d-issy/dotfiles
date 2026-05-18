_:

let
  inlayHints = {
    parameterNames.enabled = "literals";
    parameterTypes.enabled = true;
    variableTypes.enabled = false;
    propertyDeclarationTypes.enabled = true;
    functionLikeReturnTypes.enabled = true;
    enumMemberValues.enabled = true;
  };
in
{
  programs.nixvim.lsp.servers.vtsls = {
    enable = true;
    config = {
      filetypes = [
        "javascript"
        "javascriptreact"
        "javascript.jsx"
        "typescript"
        "typescriptreact"
        "typescript.tsx"
      ];
      settings = {
        complete_function_calls = true;

        vtsls = {
          enableMoveToFileCodeAction = true;
          autoUseWorkspaceTsdk = true;
          experimental.completion.enableServerSideFuzzyMatch = true;
        };

        typescript = {
          updateImportsOnFileMove.enabled = "always";
          suggest.completeFunctionCalls = true;
          preferences.importModuleSpecifier = "non-relative";
          inherit inlayHints;
        };

        javascript = {
          updateImportsOnFileMove.enabled = "always";
          suggest.completeFunctionCalls = true;
          inherit inlayHints;
        };
      };
    };
  };
}
