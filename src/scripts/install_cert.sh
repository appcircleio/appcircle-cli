#!/bin/bash
set +x

UNAME=$(uname)
echo "[+] OS: $UNAME"

# Add certificate to macOS Keychain
function add_cert_macos() {
  CERT=$1
  echo "[-] Adding '$CERT' to Keychain"
  # Allow additiong of root certificate without GUI
  sudo security authorizationdb write com.apple.trust-settings.admin allow
  # trustAsRoot and trustRoot are different
  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $CERT
  # Set the old rule back
  sudo security authorizationdb remove com.apple.trust-settings.admin
}

# Add certificate to Linux Distros
function add_cert_linux() {
  CERT=$1
  echo "[-] Adding '$CERT' to Keychain"

  if [[ -f /etc/redhat-release ]]; then
    # Redhat or Fedora
    sudo cp $CERT /etc/pki/ca-trust/source/anchors/
    sudo update-ca-trust
  elif [[ -f /etc/SuSE-release ]]; then
    # Suse
    sudo cp $CERT /etc/pki/trust/anchors/
    sudo update-ca-certificates
  elif [[ -f /etc/lsb-release ]]; then
    # Ubuntu or Debian
    sudo cp $CERT /usr/local/share/ca-certificates/
    sudo update-ca-certificates
  else
    echo "[!] Unsupported operating system"
  fi
}

# Add certificate to Nodejs
function add_cert_nodejs() {
  ZSHRC_FILE="$HOME/.zshrc"
  BASHRC_FILE="$HOME/.bashrc"
  CERTS_PATH="$HOME/.appcircle-cacerts.crt"
  LINE_TO_ADD="export NODE_EXTRA_CA_CERTS=\"$CERTS_PATH\""

  echo "[-] Adding Certs to Nodejs"

  if [[ $(uname) == "Darwin" ]]; then
    security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain >"$CERTS_PATH"
    security find-certificate -a -p /Library/Keychains/System.keychain >>"$CERTS_PATH"
    security find-certificate -a -p ~/Library/Keychains/login.keychain-db >>"$CERTS_PATH"
    if ! grep -qF "$LINE_TO_ADD" "$ZSHRC_FILE"; then
      echo "$LINE_TO_ADD" >>"$ZSHRC_FILE"
      echo "Added the line to $ZSHRC_FILE"
    else
      echo "The line already exists in $ZSHRC_FILE"
    fi
  else
    cat "/etc/ssl/certs/ca-certificates.crt" >"$CERTS_PATH"
    if [[ "$SHELL" == "/bin/bash" ]]; then
      echo "Adding NodeJs Custom CA env variable to the .bashrc file."
      if ! grep -qF "$LINE_TO_ADD" "$BASHRC_FILE"; then
        echo "$LINE_TO_ADD" >>"$BASHRC_FILE"
        echo "Added the line to $BASHRC_FILE"
      else
        echo "The line already exists in $BASHRC_FILE"
      fi
    else
      echo "Your current shell is not Bash."
      echo "You should add this line to your shell's profile or rc file."
    fi
  fi
}

# Verify certificate against host
function verify_cert() {
  HOST=$1
  echo "[-] Verifying connection to '$HOST'"
  if [[ $(uname) == "Darwin" ]]; then
    result=$(security verify-cert -v "https://$HOST" 2>&1)
    if echo "$result" | grep -q "certificate verification successful"; then
      echo " [+] Verification successful!"
    else
      echo " [!] Verification failed!"
      echo "$result"
    fi
  else
    result=$(openssl s_client -connect "$HOST":443 -showcerts </dev/null 2>&1)
    if echo "$result" | grep -q "Verify return code: 0 (ok)"; then
      echo " [+] Verification successful!"
    else
      echo " [!] Verification failed!"
      echo "$result"
    fi
  fi
}

function extract_root() {
  HOST=$1
  PORT=$2
  if [[ -f "${HOST}-chain.crt" ]]; then
    rm "${HOST}-chain.crt"
  fi
  openssl s_client -showcerts -connect "$HOST:$PORT" -servername "$HOST" </dev/null 2>/dev/null |
    awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/{ if(/BEGIN CERTIFICATE/){a++}; out="cert"a".pem"; print >out}'
  for cert in *.pem; do
    subject=$(openssl x509 -noout -subject -in "$cert")
    subject="${subject#subject=}"
    issuer=$(openssl x509 -noout -issuer -in "$cert")
    issuer="${issuer#issuer=}"
    if [[ "$subject" == "$issuer" ]]; then
      mv "$cert" "$HOST.crt"
      echo "Found cert that has same subject and issuer"
      rm "${HOST}-chain.crt"
    else
      # sub or leaf certificate
      cat "$cert" >>"${HOST}-chain.crt"
      rm "$cert"
    fi
  done
}

# Get certificate for given host
function get_cert() {
  HOST=$1
  PORT=${2:-443}
  if [ -z "$HOST" ]; then
    echo "[!] Invalid syntax"
    echo "Syntax: get_cert host port"
    exit 1
  fi
  # Remove https if it exists
  HOST=$(echo "$1" | sed -E -e 's/https?:\/\///' -e 's/\/.*//')
  echo "[-] Allowing addition of root certificates"
  echo "[-] Getting root certificate of '$HOST'"
  extract_root $HOST $PORT
  certFile="cert.pem"
  if [[ -f "${HOST}.crt" ]]; then
    certFile="${HOST}.crt"
  else
    certFile="${HOST}-chain.crt"
  fi
  echo " [+] Certificate written to '$certFile'"
  trust_cert "${HOST}" "443" "${certFile}"
}

function trust_cert() {
  HOST=$1
  PORT=${2:-443}
  CERT=$3

  echo " [+] Subject: $(openssl x509 -in "$CERT" -noout -subject | sed -n '/^subject/s/^.*CN=//p')"
  echo " [+] Expires on: $(openssl x509 -in "$CERT" -noout -enddate | cut -d= -f 2)"

  if [[ $UNAME == 'Darwin' ]]; then
    add_cert_macos "$CERT"
  elif [[ $UNAME == 'Linux' ]]; then
    add_cert_linux "$CERT"
  else
    echo " [!] Unsupported OS: $UNAME"
    exit 1
  fi
  add_cert_nodejs
  verify_cert "$HOST"
  echo -e "\033[0;32mThe root cert has been trusted successfully.\033[0m"
  echo -e "\033[0;32mYou must open a new terminal session for the changes to take effect.\033[0m"
}

main() {
  CERT="${1:-}"
  HOST="${2:-}"

  validate='^((https?|ftp|file)://)?[-A-Za-z0-9\+&@#/%?=~_|!:,.;]*[-A-Za-z0-9\+&@#/%=~_|]\.[-A-Za-z0-9\+&@#/%?=~_|!:,.;]*[-A-Za-z0-9\+&@#/%=~_|]$'

  if [ $# -eq 1 ]; then
    url=$1
    if [[ "$url" =~ $validate ]]; then
      echo "Appcircle URL is valid: $url"
      get_cert "$url"
    else
      echo "Invalid URL. Please try again."
    fi
  else
    echo "Invalid number of arguments."
    echo "Please give a cert file path and url."
    echo "Example: ./install_cert spacetech.com.crt api.appcircle.spacetech.com"
  fi
  exit 0
}

main "$@"
