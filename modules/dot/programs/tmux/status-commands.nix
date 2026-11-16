{ config, pkgs, ... }:

let
  cfg = config.dot.programs.tmux;
  wrap =
    name: env:
    pkgs.dotApps.wrapTmuxNotice {
      inherit name env;
      tmux = cfg.package;
    };
  colors = cfg.status.sessionList.colors;
in
{
  paneNotice = wrap "tmux-pane-notice" {
    TMUX_STATUS_PANE_INACTIVE_STYLE = cfg.paneBorder.title.inactiveStyle;
    TMUX_STATUS_NOTICE_BRIGHT = colors.noticeBright;
  };

  sessions = wrap "tmux-status-sessions" {
    TMUX_STATUS_NOTICE_BRIGHT = colors.noticeBright;
    TMUX_STATUS_SESSION_ACTIVE = colors.active;
    TMUX_STATUS_SESSION_INACTIVE = colors.inactive;
  };

  windowNotices = wrap "tmux-status-window-notices" { };
}
