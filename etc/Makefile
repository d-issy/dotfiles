setup: brew go vim refresh

brew: brew/setup brew/update brew/install brew/cleanup

brew/setup:
	@which brew > /dev/null || \
		/usr/bin/ruby -e "$$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

brew/update:
	brew update

brew/install:
	brew bundle

brew/cleanup:
	brew cleanup

go:
	which ghq > /dev/null || go get -u github.com/motemen/ghq
	which gore > /dev/null || go get -u github.com/motemen/gore

vim: vim/setup vim/plugin

vim/setup: ../.vim/autoload/plug.vim

vim/plugin:
	@vim -u $(abspath ../.vimrc) -c "PlugInstall | quitall"

../.vim/autoload/plug.vim:
	@cat $(abspath $@) > /dev/null || \
		curl -fLo $(abspath $@) --create-dirs \
		https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim

refresh:
	exec $$SHELL -l
