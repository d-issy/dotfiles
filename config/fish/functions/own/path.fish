function path
  if test (count $argv) = 0
    for p in $PATH; echo $p; end
  end
  for p in $argv
    if test "$p" = "-f"; set FORCE 1; end
    if not test -d $p; or contains $p $PATH
      continue
    end
    if test "$FORCE" = "1"
      set -gx PATH $p $PATH
    else
      set -gx PATH $PATH $p
    end
  end
end
