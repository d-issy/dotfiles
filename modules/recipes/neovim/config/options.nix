_:

{
  programs.nixvim = {
    globals = {
      mapleader = " ";
      maplocalleader = " ";
    };

    opts = {
      ignorecase = true;
      smartcase = true;

      autoindent = true;
      smartindent = true;
      breakindent = true;
      expandtab = true;
      shiftwidth = 2;
      tabstop = 2;
      shiftround = false;

      backup = false;
      writebackup = false;

      clipboard = "";
      cmdheight = 0;
      confirm = true;
      cursorline = true;
      hlsearch = true;
      laststatus = 0;
      pumheight = 10;
      completeopt = [
        "menuone"
        "noselect"
        "noinsert"
        "popup"
        "fuzzy"
      ];
      scrolloff = 4;
      showcmd = true;
      splitbelow = true;
      splitkeep = "cursor";
      splitright = true;
      title = true;
      wildmode = [
        "longest:full"
        "full"
      ];
      winminwidth = 5;
      wrap = false;

      backspace = [
        "start"
        "eol"
        "indent"
      ];

      list = true;
      listchars = {
        tab = "  ";
        trail = "-";
      };

      fillchars = {
        foldopen = "";
        foldclose = "";
        fold = "⸱";
        foldsep = " ";
        diff = "╱";
        eob = " ";
      };

      foldlevel = 99;
      smoothscroll = true;
      foldexpr = "v:lua.vim.treesitter.foldexpr()";
      foldmethod = "expr";
      foldtext = "";
    };

    extraConfigLua = ''
      vim.opt.path:append({ "**" })
      vim.opt.wildignore:append({ "*/node_modules/*" })
    '';
  };
}
