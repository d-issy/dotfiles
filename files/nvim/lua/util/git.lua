--- @class util.git
local M = {}

--- @enum util.git.FLAGS
FLAGS = {
  NONE = 0,
  MODIFIED = 1,
  ADDED = 2,
  DELETED = 3,
  RENAMED = 4,
  COPY = 5,
  UNMERGED = 6,
  UNTRACKED = 7,
  IGNORED = 8,
}
M.FLAGS = FLAGS

--- Get the root directory of the git repository.
--- @return string?
function M.root()
  local cmd = vim.system({ "git", "rev-parse", "--show-toplevel" }, { text = true }):wait()
  if cmd.code ~= 0 then
    return nil
  end
  return vim.trim(cmd.stdout)
end

--- Get the status of the git repository.
--- @param git_root string
--- @return table<string, {staged: util.git.FLAGS, unstaged: util.git.FLAGS}>
function M.get_status(git_root)
  local cmd = vim.system({ "git", "status", "--ignored", "--porcelain" }, { text = true }):wait()
  if cmd.code ~= 0 then
    return {}
  end
  local status = {}
  for git_file in vim.gsplit(cmd.stdout, "\n") do
    local path = git_root .. "/" .. git_file:sub(4)
    local staged = M.map_status(git_file:sub(1, 1))
    local unstaged = M.map_status(git_file:sub(2, 2))
    status[path] = { staged = staged, unstaged = unstaged }
  end
  return status
end

--- Convert the git status flag to the util.git.FLAGS.
--- @param flag string
--- @return util.git.FLAGS
function M.map_status(flag)
  local flags = {
    M = FLAGS.MODIFIED,
    A = FLAGS.ADDED,
    D = FLAGS.DELETED,
    R = FLAGS.RENAMED,
    C = FLAGS.COPY,
    U = FLAGS.UNMERGED,
    ["?"] = FLAGS.UNTRACKED,
    ["!"] = FLAGS.IGNORED,
  }
  return flags[flag] or FLAGS.NONE
end

return M
