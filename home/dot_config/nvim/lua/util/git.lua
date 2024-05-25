M = {}

function M.refresh()
  if package.loaded["neo-tree.sources.git_status"] then
    require("neo-tree.sources.git_status").refresh()
  end
end

function M.lazygit()
  require("util.terminal").open { "lazygit" }
  M.refresh()
end

return M
