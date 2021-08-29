if [ -e $HOME/.config ]; then
	export XDG_CONFIG_HOME=$HOME/.config
fi

if [ -e $HOME/.config/zsh ]; then
	export ZDOTDIR=$XDG_CONFIG_HOME/zsh
fi

if [ -e $HOME/.nix-profile/etc/profile.d/nix.sh ]; then
	. $HOME/.nix-profile/etc/profile.d/nix.sh
fi
