EXCLUSIONS := .DS_Store .ex.gitconfig.user .git .gitignore .gitmodules
CANDIDATES := $(wildcard .??*) bin
DOTFILES   := $(filter-out $(EXCLUSIONS), $(CANDIDATES))

.DEFAULT_GOAL := help
.PHONY: init link unlink update help

list:
	@$(foreach val, $(DOTFILES), ls -dF $(val);)

init:
	@echo init
	@$(MAKE) setup -C ./etc

link:
	@echo symbolic link to home
	@$(foreach val, $(DOTFILES), ln -snvf $(realpath $(val)) $(HOME)/$(val);)

unlink:
	@echo unlink from home dot files
	@$(foreach val, $(DOTFILES), rm -vrf $(HOME)/$(val);)

update:
	@git pull origin master

help:
	@echo 'Usage'
	@echo '- make list'
	@echo '- make init'
	@echo '- make link'
	@echo '- make unlink'
	@echo '- make update'
