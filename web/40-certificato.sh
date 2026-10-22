#!/bin/sh
# Eseguito da nginx all'avvio del container: se non c'è già un certificato (montato da fuori) ne crea uno
# autofirmato valido per localhost. La chiave nasce nel container e non è mai nell'immagine.
set -e

dir=/etc/nginx/certs
if [ -s "$dir/tls.crt" ] && [ -s "$dir/tls.key" ]; then
  echo "40-certificato: uso il certificato presente in $dir"
  exit 0
fi

mkdir -p "$dir"
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout "$dir/tls.key" -out "$dir/tls.crt" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
chmod 600 "$dir/tls.key"
echo "40-certificato: creato un certificato autofirmato per localhost (solo per la demo locale)"
