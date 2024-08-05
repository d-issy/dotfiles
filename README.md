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
# first time setup
export NIX_CONFIG="extra-experimental-features = nix-command flakes"

# for linux
nix run . -- switch --flake .#linux

# for macOS Sillicon
nix run . -- switch --flake .#macos

# for macOS Intel
nix run . -- switch --flake .#macos-intel
```
