#!/usr/bin/env bash
# Génère android/airgocc-release.keystore et un modèle keystore.properties.
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

if [[ -f "$ANDROID_DIR/airgocc-release.keystore" ]]; then
  echo "Existe déjà : $ANDROID_DIR/airgocc-release.keystore" >&2
  exit 1
fi

mkdir -p "$ANDROID_DIR"
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore "$ANDROID_DIR/airgocc-release.keystore" \
  -alias airgocc \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$PASS" \
  -keypass "$PASS" \
  -dname "CN=AirGoCC, OU=Dev, O=AirGoCC, L=Paris, ST=IDF, C=FR"

cat > "$ANDROID_DIR/keystore.properties" <<EOF
storeFile=airgocc-release.keystore
keyAlias=airgocc
storePassword=$PASS
keyPassword=$PASS
EOF

chmod 600 "$ANDROID_DIR/keystore.properties"
echo "OK : $ANDROID_DIR/airgocc-release.keystore + keystore.properties (gitignored)."
