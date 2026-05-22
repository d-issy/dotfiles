{ files }:

path: builtins.readFile (files + "/${path}")
