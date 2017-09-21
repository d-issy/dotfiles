NODE_VER   := v8.5.0
PYTHON_VER := 3.6.2
RUBY_VER   := 2.4.2

setup: brew anyenv go vim refresh

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

anyenv: anyenv/setup anyenv/install

anyenv/setup: $(HOME)/.anyenv
	@anyenv install -s ndenv
	@anyenv install -s pyenv
	@anyenv install -s rbenv

$(HOME)/.anyenv:
	git clone https://github.com/riywo/anyenv $@

anyenv/install: ndenv pyenv rbenv

ndenv:
	ndenv install -s $(NODE_VER)
	ndenv global $(NODE_VER)

pyenv:
	pyenv install -s $(PYTHON_VER)
	pyenv global $(PYTHON_VER)

rbenv:
	rbenv install -s $(RUBY_VER)
	rbenv global $(RUBY_VER)

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
