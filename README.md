# dotfiles

d-issy's Nix Flakes + Home Manager dotfiles for Linux, macOS, and NixOS.

## Requirements

- One of the following environments:
  - macOS Apple Silicon (`aarch64-darwin`)
  - WSL2 / Linux (`x86_64-linux`)
  - NixOS (`x86_64-linux`)
- Nix with `nix-command` and `flakes` enabled

## Prerequisites

Nix does not install these on macOS; install them manually:

- [Ghostty](https://ghostty.org/) (`package = null` in `modules/recipes/ghostty.nix`)
- [Hammerspoon](https://www.hammerspoon.org/) (config deployed to `~/.hammerspoon`)
- Fonts: 0xProto, UDEV Gothic 35, Hack Nerd Font Mono (Ghostty and WezTerm), and Cica (WezTerm); Hiragino Kaku Gothic ProN and YuGothic ship with macOS

## Init

```sh
git clone https://github.com/d-issy/dotfiles.git ~/code/github.com/d-issy/dotfiles
cd ~/code/github.com/d-issy/dotfiles
export NIX_CONFIG="extra-experimental-features = nix-command flakes"
```

## Apply

`.#apply` automatically selects the matching configuration for the current system.
On NixOS, it applies the Linux Home Manager configuration. The generic NixOS
configuration is a CI fixture under `checks.x86_64-linux.nixos-home-manager`,
not a deployable host configuration.

```sh
nix run .#apply
```

## Generations

`.#generations` lists Home Manager generations.

```sh
nix run .#generations
```

## GC

`.#gc` expires Home Manager generations older than 7 days and runs `nix store gc`.

```sh
nix run .#gc
```

## Development

```sh
nix develop      # dev shell with the tooling
nix fmt          # format
nix flake check  # lint and regression checks
pnpm lint        # oxlint
pnpm typecheck
pnpm test
```
