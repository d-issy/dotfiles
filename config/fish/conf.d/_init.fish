# starship
if type -q starship then
  starship init fish | source
end

# zoxide
if type -q zoxide
  zoxide init fish | source
end

# fuck
if type -q thefuck
  thefuck --alias | source
end
