return {
  'jose-elias-alvarez/null-ls.nvim',
  dependencies = {
    'williamboman/mason.nvim'
  },
  opts = function()
    local nls = require 'null-ls'
    return {
      sources = {
        nls.builtins.formatting.black,
        nls.builtins.formatting.isort,
      }
    }
  end
}
