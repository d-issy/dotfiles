# fisher
if ! type -q fisher
  function fisher_init
    curl https://git.io/fisher --create-dirs -sLo ~/.config/fish/functions/fisher.fish
    $SHELL -l -c 'fisher update'
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
