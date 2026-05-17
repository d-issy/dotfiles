{ lib, ... }:

{
  programs.nixvim = {
    globals = {
      mapleader = " ";
      maplocalleader = " ";
    };

    opts = {
      encoding = "utf-8";
      fileencoding = "utf-8";

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
      scrolloff = 4;
      showcmd = true;
      splitbelow = true;
      splitkeep = "cursor";
      splitright = true;
      termguicolors = true;
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
      foldexpr = "v:lua.require'util.fold'.expr()";
      foldmethod = "expr";
      foldtext = "";
    };

    extraConfigLua = ''
      vim.opt.path:append({ "**" })
      vim.opt.wildignore:append({ "*/node_modules/*" })
    '';
  };
}
