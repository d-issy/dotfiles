# dotfiles

d-issy's dotfiles

## Require

- zsh
- curl
- os
  - macOS
    - require brew
  - WSL2 on Windows / Linux
    - require apt

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
