#!/usr/bin/env bash
# Génère android/airgo-release.keystore et un modèle keystore.properties.
# Usage :
#   ./scripts/create-android-release-keystore.sh 'MotDePasseSecret'
# Puis éditer android/keystore.properties si le mot de passe de la clé diffère (ici identique).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
PASS="${1:-}"

if [[ -z "$PASS" ]]; then
  echo "Usage: $0 '<mot_de_passe_keystore_et_cle>'" >&2
  exit 1
fi

if [[ -f "$ANDROID_DIR/airgo-release.keystore" ]]; then
  echo "Existe déjà : $ANDROID_DIR/airgo-release.keystore" >&2
  exit 1
fi

mkdir -p "$ANDROID_DIR"
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore "$ANDROID_DIR/airgo-release.keystore" \
  -alias airgo \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$PASS" \
  -keypass "$PASS" \
  -dname "CN=AirGo, OU=Dev, O=AirGo, L=Paris, ST=IDF, C=FR"

cat > "$ANDROID_DIR/keystore.properties" <<EOF
storeFile=airgo-release.keystore
keyAlias=airgo
storePassword=$PASS
keyPassword=$PASS
EOF

chmod 600 "$ANDROID_DIR/keystore.properties"
echo "OK : $ANDROID_DIR/airgo-release.keystore + keystore.properties (gitignored)."
