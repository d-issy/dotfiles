local root = assert(vim.env.DOTFILES_ROOT, "DOTFILES_ROOT must point to the repository")
vim.opt.runtimepath:prepend(root .. "/files/nvim")

local passed = 0
local function test(name, run)
  local ok, err = xpcall(run, debug.traceback)
  if not ok then
    io.stderr:write(name .. ": " .. err .. "\n")
    vim.cmd "cquit 1"
  end
  passed = passed + 1
  print("ok: " .. name)
end

local function new_buffer(lines)
  local buf = vim.api.nvim_create_buf(true, false)
  vim.api.nvim_set_current_buf(buf)
  for _, other in ipairs(vim.api.nvim_list_bufs()) do
    if other ~= buf then
      vim.api.nvim_buf_delete(other, { force = true })
    end
  end
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  return buf
end

for _, choice in ipairs { 0, 3 } do
  test("buffer deletion preserves changes when confirmation returns " .. choice, function()
    local buf = new_buffer { "unsaved changes" }
    local confirm = vim.fn.confirm
    vim.fn.confirm = function()
      return choice
    end
    require("util.buffer").delete()
    vim.fn.confirm = confirm
    assert(vim.api.nvim_buf_is_loaded(buf), "cancellation deleted the buffer")
    assert(vim.api.nvim_buf_get_lines(buf, 0, -1, false)[1] == "unsaved changes")
  end)
end

test("buffer deletion still discards changes when No is selected", function()
  local buf = new_buffer { "discard these changes" }
  local confirm = vim.fn.confirm
  vim.fn.confirm = function()
    return 2
  end
  require("util.buffer").delete()
  vim.fn.confirm = confirm
  assert(not vim.api.nvim_buf_is_loaded(buf))
end)

test("quit preserves unnamed content after a blank first line", function()
  local buf = new_buffer { "", "unsaved second line" }
  local command, requested = vim.api.nvim_command, nil
  vim.api.nvim_command = function(cmd)
    requested = cmd
  end
  require("util.quit").all()
  vim.api.nvim_command = command
  assert(requested == "quitall")
  assert(vim.api.nvim_buf_is_loaded(buf), "quit deleted nonempty unnamed content")
  assert(vim.deep_equal(vim.api.nvim_buf_get_lines(buf, 0, -1, false), { "", "unsaved second line" }))
end)

test("quit can still remove a truly empty unnamed buffer", function()
  local buf = new_buffer { "" }
  local command = vim.api.nvim_command
  vim.api.nvim_command = function() end
  require("util.quit").all()
  vim.api.nvim_command = command
  assert(not vim.api.nvim_buf_is_loaded(buf))
end)

test("big-file handling detaches the LSP client", function()
  local buf = new_buffer { "big-file content" }
  local get_client, detach = vim.lsp.get_client_by_id, vim.lsp.buf_detach_client
  local detached
  vim.lsp.get_client_by_id = function(id)
    assert(id == 42)
    return { id = id }
  end
  vim.lsp.buf_detach_client = function(target, id)
    detached = { target, id }
  end
  require("util.file").disable_futures_for_bigfile(buf)
  vim.api.nvim_exec_autocmds("LspAttach", { buffer = buf, data = { client_id = 42 } })
  assert(
    vim.wait(1000, function()
      return detached ~= nil
    end),
    "LSP client was not detached"
  )
  vim.lsp.get_client_by_id, vim.lsp.buf_detach_client = get_client, detach
  assert(vim.deep_equal(detached, { buf, 42 }))
end)

test("completion leaves native additional edits applied exactly once", function()
  local buf = new_buffer { "package main", "", "func main() {}" }
  dofile(root .. "/files/nvim/lua/nixvim/lsp/default.lua")
  local edits = {
    {
      range = { start = { line = 0, character = 12 }, ["end"] = { line = 0, character = 12 } },
      newText = '\n\nimport "fmt"',
    },
  }
  local completed, get_client = vim.v.completed_item, vim.lsp.get_client_by_id
  vim.lsp.get_client_by_id = function()
    return { offset_encoding = "utf-16" }
  end
  vim.api.nvim_set_vvar("completed_item", {
    user_data = { nvim = { lsp = { client_id = 42, completion_item = { additionalTextEdits = edits } } } },
  })
  -- Native LSP completion applies these edits before CompleteDone listeners finish.
  vim.lsp.util.apply_text_edits(edits, buf, "utf-16")
  vim.api.nvim_exec_autocmds("CompleteDone", { buffer = buf })
  vim.wait(100, function()
    return false
  end)
  vim.api.nvim_set_vvar("completed_item", completed)
  vim.lsp.get_client_by_id = get_client
  assert(
    vim.deep_equal(vim.api.nvim_buf_get_lines(buf, 0, -1, false), {
      "package main",
      "",
      'import "fmt"',
      "",
      "func main() {}",
    }),
    "completion applied additional edits more than once"
  )
end)

test("application shortcuts survive unavailable applications and app restarts", function()
  local running, looked_up, opened, focused = nil, {}, {}, {}
  local filter = {}
  function filter:setDefaultFilter()
    return self
  end
  function filter:subscribe() end
  function filter:getWindows()
    return {}
  end
  hs = {
    window = { highlight = { ui = {} }, filter = {
      new = function()
        return filter
      end,
    } },
    grid = { setMargins = function() end },
    eventtap = {
      event = { types = { keyDown = 1 } },
      new = function()
        return {}
      end,
    },
    application = {
      find = function(id)
        table.insert(looked_up, id)
        return running
      end,
      open = function(id)
        assert(type(id) == "string", "lost the application identifier")
        table.insert(opened, id)
      end,
    },
  }
  local function application(name)
    return {
      mainWindow = function()
        return {
          isMinimized = function()
            return false
          end,
          focus = function()
            table.insert(focused, name)
          end,
        }
      end,
    }
  end
  dofile(root .. "/files/hammerspoon/winmanager.lua")
  local shortcut = WinManager.focusApplication "example.app"
  shortcut()
  shortcut()
  running = application "first process"
  shortcut()
  running = application "restarted process"
  shortcut()
  assert(vim.deep_equal(looked_up, { "example.app", "example.app", "example.app", "example.app" }))
  assert(vim.deep_equal(opened, { "example.app", "example.app" }))
  assert(vim.deep_equal(focused, { "first process", "restarted process" }))
end)

print(passed .. " Neovim/Lua regressions passed")
vim.cmd "qa!"
