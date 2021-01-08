.DEFAULT_GOAL := help

ifeq ($(shell uname),Darwin)
	LINK_OPTION=-svnf
else
	LINK_OPTION=-svTF
endif

help:
	@echo Read Makefile
	@cat Makefile

link:
	ln $(LINK_OPTION) $(realpath config) $(abspath $(HOME)/.config)
	@echo link is done

unlink:
	unlink $(abspath $(HOME)/.config)
	@echo unlink is done
