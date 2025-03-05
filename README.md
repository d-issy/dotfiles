# dotfiles

d-issy's dotfiles

## Require

- os
  - macOS (aarch64/x64_86)
  - WSL2 on Windows / Linux
- nix

## init

```sh
git clone https://github.com/d-issy/dotfiles.git ~/code/github.com/d-issy/dotfiles
export NIX_CONFIG="extra-experimental-features = nix-command flakes"
```

## apply

```sh
# for linux
nix run . -- switch --flake .#linux

# for macOS Silicon
nix run . -- switch --flake .#macos

# for macOS Intel
nix run . -- switch --flake .#macos_intel
```
