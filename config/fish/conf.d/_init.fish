# fisher
if ! type -q fisher
  function fisher_init
    curl -sL https://git.io/fisher | source && fisher update  && fisher install jorgebucaran/fisher
    exec $SHELL -l
  end
end


# starship
if type -q starship
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
