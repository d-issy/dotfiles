# paret
set -l red        F7768E
set -l orange     ff9e64
set -l yellow     e0af68
set -l green      9ece8a
set -l blue       7aa2f7
set -l purple     ad8ee6
set -l grey       444b6a

set -l backred    ff7a93
set -l backgreen  b9f27c
set -l backblue   7da6ff

set -l white      ffffff
set -l black      282828

# fish color
set -g fish_color_command $white
set -g fish_color_param   $white
set -g fish_color_error   $red
set -g fish_color_comment $grey

set -g fish_pager_color_progress    $white
set -g fish_pager_color_completion  $white
set -g fish_pager_color_prefix      $green
set -g fish_pager_color_description $orange

set -g fish_pager_color_selected_prefix      $grey
set -g fish_pager_color_selected_completion  $black
set -g fish_pager_color_selected_description $grey
set -g fish_pager_color_selected_background --background=$backgreen
