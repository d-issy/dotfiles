function aws
  if type -q awsmfa
    awsmfa -q 32400
  end
  command aws $argv
end
