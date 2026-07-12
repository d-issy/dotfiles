# dotfiles

d-issy's Nix Flakes + Home Manager dotfiles for Linux, macOS, and NixOS.

## Requirements

- One of the following environments:
  - macOS Apple Silicon (`aarch64-darwin`)
  - macOS Intel (`x86_64-darwin`)
  - WSL2 / Linux (`x86_64-linux`)
  - NixOS (`x86_64-linux`)
- Nix with `nix-command` and `flakes` enabled

## Init

```sh
git clone https://github.com/d-issy/dotfiles.git ~/code/github.com/d-issy/dotfiles
cd ~/code/github.com/d-issy/dotfiles
export NIX_CONFIG="extra-experimental-features = nix-command flakes"
```

## Switch

`.#switch` automatically selects the matching configuration for the current system.

```sh
nix run .#switch
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
