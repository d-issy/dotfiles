# lang default versions
NODE_VER   := v8.11.3
PYTHON_VER := 3.7.0
RUBY_VER   := 2.5.1

# env paths or directories
ANYENV_DIR := $(HOME)/.anyenv
CARGO_DIR := $(HOME)/.cargo
BREW_PATH := /usr/local/bin/brew

# os check
UNAME := $(shell uname)

# for macOS
ifeq ($(UNAME),Darwin)
setup: brew anyenv go rust refresh
endif

# for other Linux
ifeq ($(UNAME),Linux)
setup: anyenv go refresh
endif

# homebrew
brew: brew/setup brew/install brew/cleanup

brew/setup: $(BREW_PATH)

brew/update:
	@brew update

brew/install:
	@brew bundle

brew/cleanup:
	@brew cleanup
	@brew cask cleanup

# anyenv
anyenv: anyenv/setup anyenv/setup
	@$(MAKE) -j 3 env/setup

anyenv/setup: $(ANYENV_DIR)
anyenv/update: anyenv/setup
	@eval "$$(anyenv init -)" && \
		anyenv update

anyenv/init:
	@eval "$$(anyenv init -)"

env/setup: ndenv pyenv rbenv

ndenv: $(ANYENV_DIR)/envs/ndenv/bin/ndenv
	@eval "$$(anyenv init -)" && \
		$< install -s $(NODE_VER) && \
		$< global $(NODE_VER) && \
		npm install -g eslint tern

pyenv: $(ANYENV_DIR)/envs/pyenv/bin/pyenv
	@eval "$$(anyenv init -)" && \
		$< install -s $(PYTHON_VER) && \
		$< global $(PYTHON_VER) && \
		pip install -U pip autopep8 isort mypy jedi vim-vint

rbenv: $(ANYENV_DIR)/envs/rbenv/bin/rbenv
	@eval "$$(anyenv init -)" && \
		$< install -s $(RUBY_VER) && \
		$< global $(RUBY_VER)

# golang
go:
	go get -u github.com/motemen/ghq
	go get -u github.com/motemen/gore

# rust
rust: rust/setup
	@rustup update
	@rustup component add rustfmt-preview

rust/setup: $(CARGO_DIR)

# refresh
refresh:
	@exec $$SHELL -l

# Setup Locations
$(BREW_PATH):
	@/usr/bin/ruby -e "$$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

export PATH := $(shell echo $$PATH):$(ANYENV_DIR)/bin
$(ANYENV_DIR):
	@git clone https://github.com/riywo/anyenv $@
	@git clone https://github.com/znz/anyenv-update.git $@/plugins/anyenv-update

$(CARGO_DIR):
	@yes 1 | curl https://sh.rustup.rs -sSf | sh -s -- -y

$(ANYENV_DIR)/envs/%: anyenv/setup
	@anyenv install -s $(@F)
