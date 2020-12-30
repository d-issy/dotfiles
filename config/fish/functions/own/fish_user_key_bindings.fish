# user key function
function fish_user_key_bindings
  fish_vi_key_bindings insert

  bind -M insert \ca beginning-of-line
  bind -M insert \ce end-of-line
  bind -M insert \ck kill-line
  bind -M insert \cn down-or-search
  bind -M insert \cp up-or-search

  # user definition
  bind -M insert \cr inc-search-history
end
