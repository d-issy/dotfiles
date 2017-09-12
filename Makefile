EXCLUSIONS := .DS_Store .ex.gitconfig.user .git .gitignore .gitmodules
CANDIDATES := $(wildcard .??*) bin
DOTFILES   := $(filter-out $(EXCLUSIONS), $(CANDIDATES))

all: help

install:
	@echo install
	@$(foreach val, $(DOTFILES), ln -snvf $(realpath $(val)) $(HOME)/$(val);)

uninstall:
	@echo uninstall
	@$(foreach val, $(DOTFILES), rm -vrf $(HOME)/$(val);)

update:
	git pull origin master

help:
	@echo Usage
	@echo - make install
	@echo - make uninstall
