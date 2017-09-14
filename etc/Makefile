setup: brew go refresh

brew: brew/setup brew/update brew/install brew/cleanup

brew/setup:
	@which brew > /dev/null || /usr/bin/ruby -e "$$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

brew/update:
	brew update

brew/install:
	brew bundle

brew/cleanup:
	brew cleanup

go:
	which ghq > /dev/null | go get -u github.com/motemen/ghq
	which gore > /dev/null | go get -u github.com/motemen/gore

refresh:
	exec $$SHELL -l
