# dotfiles

d-issy's dotfiles

## Require

- zsh
- curl
- os
  - macOS
    - brew
  - WSL2 on Windows / Linux
    - apt

## init

```
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply d-issy
```

## diff check

```
chezmoi diff
```

## update

```
chezmoi update -v
```
