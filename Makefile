.DEFAULT_GOAL := help

help:
	@echo Read Makefile
	@cat Makefile

link:
	ln -svTf $(realpath config) $(abspath $(HOME)/.config)
	@echo link is done

unlink:
	unlink $(abspath $(HOME)/.config)
	@echo unlink is done
