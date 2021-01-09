set -l NIX_LINK $HOME/.nix-profile
if test -d $NIX_LINK
  set -gx NIX_PATH $NIX_PATH $HOME/.nix-defexpr/channels
  set -gx NIX_PROFILES "/nix/var/nix/profiles/default $HOME/.nix-profile"
  if test -e /etc/ssl/certs/ca-certificates.crt
    set -gx NIX_SSL_CERT_FILE /etc/ssl/certs/ca-certificates.crt
  else if test -e /etc/pki/tls/certs/ca-bundle.crt
    set -gx NIX_SSL_CERT_FILE /etc/pki/tls/certs/ca-bundle.crt
  else if test -e $NIX_LINK/etc/ssl/certs/ca-bundle.crt
    set -gx NIX_SSL_CERT_FILE $NIX_LINK/etc/ssl/certs/ca-bundle.crt
  else if test -e $NIX_LINK/etc/ca-bundle.crt
    set -gx NIX_SSL_CERT_FILE $NIX_LINK/etc/ca-bundle.crt
  end
end
