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
nix run . -- switch --flake --impure .#linux

# for macOS Sillicon
nix run . -- switch --flake --impure .#macos

# for macOS Intel
nix run . -- switch --flake --impure .#macos-intel
```
