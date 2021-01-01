function tmux
	# not compatible for under v3.1
	command tmux -f "$XDG_CONFIG_HOME/tmux/tmux.conf" $argv
end
