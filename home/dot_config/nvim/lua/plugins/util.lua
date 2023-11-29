return {
  "project.nvim",
  opts = {
    manual_mode = true,
    sync_root_with_cwd = true,
    respect_buf_cwd = true,
    update_focused_file = {
      enable = true,
      update_cwd = true,
    },
    patterns = { ".git", "_darces", ".hg", "pyproject.toml", "Makefile", "package.json" },
    silent_chdir = false,
    scope_chdir = "win",
  },
}
