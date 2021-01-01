function ls
  if type -q exa
    exa --icons $argv
  else if type -q colorls
    colorls $argv
  else
    command ls --color $argv
  end
end
