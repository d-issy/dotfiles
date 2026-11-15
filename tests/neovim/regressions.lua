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

test("autoformat is checked against the given buffer", function()
  local current = new_buffer { "current" }
  local other = vim.api.nvim_create_buf(true, false)
  local format = require "util.format"
  vim.g.autoformat = nil
  vim.b[other].autoformat = false
  assert(format.enabled(current), "current buffer should default to enabled")
  assert(not format.enabled(other), "buffer-local setting of a non-current buffer was ignored")
  vim.b[other].autoformat = nil
  vim.b[current].autoformat = false
  assert(not format.enabled(), "current buffer setting was ignored without an argument")
  assert(format.enabled(other), "current buffer setting leaked into another buffer")
end)

test("buffer deletion saves and names the target buffer, not the current one", function()
  local dir = vim.fn.tempname()
  vim.fn.mkdir(dir, "p")
  local current = new_buffer { "current" }
  local target = vim.api.nvim_create_buf(true, false)
  vim.api.nvim_buf_set_name(target, dir .. "/target.txt")
  vim.api.nvim_buf_set_lines(target, 0, -1, false, { "target content" })
  vim.api.nvim_set_current_buf(current)
  local confirm, prompt = vim.fn.confirm, nil
  vim.fn.confirm = function(message)
    prompt = message
    return 1
  end
  require("util.buffer").delete(target)
  vim.fn.confirm = confirm
  assert(prompt and prompt:find("target.txt", 1, true), "prompt named the wrong buffer: " .. tostring(prompt))
  assert(vim.deep_equal(vim.fn.readfile(dir .. "/target.txt"), { "target content" }), "target buffer was not written")
  assert(not vim.api.nvim_buf_is_loaded(target))
  assert(vim.api.nvim_buf_is_loaded(current) and vim.api.nvim_get_current_buf() == current)
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
