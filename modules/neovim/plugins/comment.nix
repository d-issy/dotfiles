_:

{
  programs.nixvim.plugins.ts-comments = {
    enable = true;
    lazyLoad.settings.event = [
      "BufReadPost"
      "BufNewFile"
    ];
    settings = { };
  };
}
