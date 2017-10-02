# dotfiles
My dotfiles

## Requirement
- macOS latest
- xcode-select --install

## init
For the first time, you need to run init endopoint. 

This endpoint install dependences software and do config.

```
make init
```

## link 
This endpoint create a symbolic link of dotfiles in your HOME directory.

Please note that duplicate files are removed.

```
make link
```

## unlink
This endpoint remove the symbolic links of dotfiles from the HOME directory.

Please note that all dotfiles under monitoring in this repository will be deleted.

```
make unlink
```

## user gitconfig
Execute the following command

```
cp .ex.gitconfig.user .gitconfig.user
```

And then, replace {name}, {email} in .gitconfig.user with your information.

