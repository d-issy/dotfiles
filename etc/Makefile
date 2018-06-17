NODE_VER   := v8.11.3
PYTHON_VER := 3.6.5
RUBY_VER   := 2.5.1

ANYENV_DIR := $(HOME)/.anyenv
uname := $(shell uname)

ifeq ($(uname),Darwin)
setup: brew anyenv go vim refresh
endif

ifeq ($(uname),Linux)
setup: anyenv go vim refresh
endif

brew: brew/setup brew/install brew/cleanup

brew/update:
	brew update

brew/install:
	@brew bundle

brew/cleanup:
	brew cleanup
	brew cask cleanup

anyenv: anyenv/setup
	@$(MAKE) -j 3 env/setup

env/setup: ndenv pyenv rbenv

ndenv: $(ANYENV_DIR)/envs/ndenv/bin/ndenv
	@eval "$$(anyenv init -)" && \
		$< install -s $(NODE_VER) && \
		$< global $(NODE_VER)

pyenv: $(ANYENV_DIR)/envs/pyenv/bin/pyenv
	@eval "$$(anyenv init -)" && \
		$< install -s $(PYTHON_VER) && \
		$< global $(PYTHON_VER)

rbenv: $(ANYENV_DIR)/envs/rbenv/bin/rbenv
	@eval "$$(anyenv init -)" && \
		$< install -s $(RUBY_VER) && \
		$< global $(RUBY_VER)

go:
	which ghq > /dev/null 2>&1 || go get -u github.com/motemen/ghq
	which gore > /dev/null 2>&1 || go get -u github.com/motemen/gore

vim: vim/setup

refresh:
	exec $$SHELL -l

# Setup Locations
brew/setup: /usr/local/bin/brew
/usr/local/bin/brew:
	/usr/bin/ruby -e "$$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

anyenv/setup: $(ANYENV_DIR)
$(HOME)/.anyenv:
	git clone https://github.com/riywo/anyenv $@
	@eval "$$(anyenv init -)"

vim/setup: $(abspath ../.vim/autoload/plug.vim)
$(abspath ../.vim/autoload/plug.vim):
	curl -fLo $@ --create-dirs \
		https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim

$(ANYENV_DIR)/envs/%:
	anyenv install -s $(@F)
