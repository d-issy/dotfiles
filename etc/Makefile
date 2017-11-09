NODE_VER   := v9.1.0
PYTHON_VER := 3.6.3
RUBY_VER   := 2.4.2


.PHONY: setup
setup: brew anyenv go vim refresh

.PHONY: brew brew/setup brew/update brew/cleanup
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

.PHONY: anyenv anyenv/setup anyenv/install
anyenv: anyenv/setup anyenv/install

anyenv/setup: $(HOME)/.anyenv
	@anyenv install -s ndenv
	@anyenv install -s pyenv
	@anyenv install -s rbenv

$(HOME)/.anyenv:
	git clone https://github.com/riywo/anyenv $@

anyenv/install: ndenv pyenv rbenv

.PHONY: ndenv pyenv rbenv
ndenv:
	ndenv install -s $(NODE_VER)
	ndenv global $(NODE_VER)

pyenv:
	pyenv install -s $(PYTHON_VER)
	pyenv global $(PYTHON_VER)

rbenv:
	rbenv install -s $(RUBY_VER)
	rbenv global $(RUBY_VER)

.PHONY: go
go:
	which ghq > /dev/null || go get -u github.com/motemen/ghq
	which gore > /dev/null || go get -u github.com/motemen/gore

.PHONY: vim vim/setup vim/plugin
vim: vim/setup

vim/setup: ../.vim/autoload/plug.vim

../.vim/autoload/plug.vim:
	curl -fLo $(abspath $@) --create-dirs \
		https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim

.PHONY: refresh
refresh:
	exec $$SHELL -l
