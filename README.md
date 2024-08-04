# dotfiles

d-issy's dotfiles

## Require

- nix
- os
  - macOS
  - WSL2 on Windows / Linux
- mise (asdf)
- aqua

## init

```sh
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply d-issy
```

```sh
# for linux
nix run home-manger -- switch --flake .#linux

# for macOS Sillicon
nix run home-manger -- switch --flake .#macos

# for macOS Intel
nix run home-manger -- switch --flake .#macos-intel
```
