# dotfiles

d-issy's dotfiles

## Require

- macOS
  - `brew install curl asdf`
- WSL2 Ubuntu on Windows
  - `apt install curl`
  - `git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.10.2`

## init

```
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply d-issy
asdf install
```

## diff check

```
chezmoi diff
```

## update

```
chezmoi update -v
asdf install
```
