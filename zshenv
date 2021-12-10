if [ -e $HOME/.config ]; then
	export XDG_CONFIG_HOME=$HOME/.config
fi

if [ -e $HOME/.nix-profile/etc/profile.d/nix.sh ]; then
	. $HOME/.nix-profile/etc/profile.d/nix.sh
fi

if [ -d $HOME/.local/bin ]; then
	export PATH=$HOME/.local/bin:$PATH
fi
