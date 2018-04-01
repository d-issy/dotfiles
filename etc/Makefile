NODE_VER   := v9.3.0
PYTHON_VER := 3.6.5
RUBY_VER   := 2.4.3

uname := $(shell uname)

ifeq ($(uname),Darwin)
setup: brew anyenv go vim refresh
endif

ifeq ($(uname),Linux)
setup: anyenv go vim
endif

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
	brew cask cleanup

anyenv: anyenv/setup anyenv/install

anyenv/setup: $(HOME)/.anyenv
	@anyenv install -s ndenv
	@anyenv install -s pyenv
	@anyenv install -s rbenv
	@exec $$SHELL -l

$(HOME)/.anyenv:
	git clone https://github.com/riywo/anyenv $@
	@exec $$SHELL -l

anyenv/install: ndenv pyenv rbenv

ndenv:
	ndenv install -s $(NODE_VER)
	@ndenv global $(NODE_VER)

pyenv:
	pyenv install -s $(PYTHON_VER)
	@pyenv global $(PYTHON_VER)

rbenv:
	rbenv install -s $(RUBY_VER)
	@rbenv global $(RUBY_VER)

go:
	which ghq > /dev/null 2>&1 || go get -u github.com/motemen/ghq
	which gore > /dev/null 2>&1 || go get -u github.com/motemen/gore

vim: vim/setup

vim/setup: $(abspath ../.vim/autoload/plug.vim)

$(abspath ../.vim/autoload/plug.vim):
	curl -fLo $@ --create-dirs \
		https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim

refresh:
	exec $$SHELL -l
