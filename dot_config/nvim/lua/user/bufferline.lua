local status_ok, bufferline = pcall(require, 'bufferline')
if not status_ok then
  return
end

local groups = require('bufferline.groups')
bufferline.setup {
  options = {
    mode = 'buffers',
    groups = {
      options = {
        toggle_hhidden_on_enter = true
      },
      items = {
        groups.builtin.ungrouped,
        {
          name = 'docs',
          matcher = function(buf) return buf.name:match('%.md') end
        },
        {
          name = 'tests',
          matcher = function(buf)
            return buf.name:match('^.+_test%..+$')
                or buf.name:match('^test_.+$')
                or buf.name:match('%.spec%.')
          end
        },
      }
    },
  }
}
