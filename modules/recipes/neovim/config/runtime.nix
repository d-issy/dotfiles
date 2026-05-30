_:

{
  programs.nixvim.extraConfigLuaPre = ''
    local function is_writable_directory(path)
      local WRITABLE_DIRECTORY = 2
      return path and path ~= "" and vim.fn.filewritable(path) == WRITABLE_DIRECTORY
    end

    local xdg_runtime_dir = vim.env.XDG_RUNTIME_DIR
    if xdg_runtime_dir and xdg_runtime_dir ~= "" and not is_writable_directory(xdg_runtime_dir) then
      vim.env.XDG_RUNTIME_DIR = nil
    end

    local tmpdir = vim.env.TMPDIR
    if not is_writable_directory(tmpdir) then
      vim.env.TMPDIR = (vim.uv or vim.loop).os_tmpdir()
    end
  '';
}
