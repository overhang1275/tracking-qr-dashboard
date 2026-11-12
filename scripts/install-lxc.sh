#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="https://github.com/overhang1275/tracking-qr-dashboard.git"
REPO_BRANCH="master"
INSTALL_DIR="/opt/tracking-qr-dashboard"
NGINX_SITE="tracking-qr-dashboard"

fail() {
	printf 'Error: %s\n' "$*" >&2
	exit 1
}

ask() {
	local label="$1"
	local variable="$2"
	local answer
	read -r -p "$label: " answer </dev/tty || fail "No se pudo leer la configuración desde la terminal."
	printf -v "$variable" '%s' "$answer"
}

[[ "$EUID" -eq 0 ]] || fail "Ejecuta este instalador como root, por ejemplo: curl ... | sudo bash"
[[ -r /dev/tty ]] || fail "Este instalador requiere una terminal interactiva."
[[ -f /etc/os-release ]] || fail "No se pudo identificar la distribución. Se requiere Debian o Ubuntu."
# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == "debian" || "${ID:-}" == "ubuntu" || "${ID_LIKE:-}" == *debian* ]] ||
	fail "Distribución no compatible: ${PRETTY_NAME:-desconocida}. Se requiere Debian o Ubuntu."
command -v apt-get >/dev/null 2>&1 || fail "No se encontró apt-get."

NGINX_CONFIG="/etc/nginx/sites-available/$NGINX_SITE"
NGINX_ENABLED="/etc/nginx/sites-enabled/$NGINX_SITE"
UPDATE_MODE=false
PRESERVE_NGINX=false
CONFIGURE_FIREBASE=true

if [[ -e "$INSTALL_DIR" ]]; then
	[[ -d "$INSTALL_DIR/.git" && -f "$INSTALL_DIR/package.json" ]] ||
		fail "$INSTALL_DIR existe, pero no parece ser el clon esperado. No se modificó."
	EXISTING_REMOTE="$(git -C "$INSTALL_DIR" remote get-url origin 2>/dev/null || true)"
	[[ "$EXISTING_REMOTE" == "$REPO_URL" ]] ||
		fail "$INSTALL_DIR no apunta a $REPO_URL. No se modificó."
	CURRENT_BRANCH="$(git -C "$INSTALL_DIR" branch --show-current)"
	[[ "$CURRENT_BRANCH" == "$REPO_BRANCH" ]] ||
		fail "La instalación está en la rama '$CURRENT_BRANCH', no '$REPO_BRANCH'. No se modificó."
	[[ -z "$(git -C "$INSTALL_DIR" status --porcelain --untracked-files=no)" ]] ||
		fail "Hay cambios locales en el código. Guárdalos o revísalos antes de actualizar."
	UPDATE_MODE=true
	if [[ -s "$INSTALL_DIR/.env.production" ]]; then
		CONFIGURE_FIREBASE=false
	fi
	printf 'Instalación existente verificada: se actualizará el código y se conservará su configuración.\n'
fi

if [[ -e "$NGINX_CONFIG" || -L "$NGINX_CONFIG" ]]; then
	if [[ -f "$NGINX_CONFIG" && ! -s "$NGINX_CONFIG" ]]; then
		printf 'Retirando el archivo Nginx vacío que dejó un intento fallido anterior.\n'
		rm -- "$NGINX_CONFIG"
	elif [[ "$UPDATE_MODE" == true && -f "$NGINX_CONFIG" && ! -L "$NGINX_CONFIG" ]]; then
		PRESERVE_NGINX=true
		printf 'Se conservará la configuración Nginx existente.\n'
	else
		fail "Ya existe una configuración Nginx no vacía llamada $NGINX_SITE. No se modificó."
	fi
fi
if [[ -e "$NGINX_ENABLED" || -L "$NGINX_ENABLED" ]]; then
	[[ -L "$NGINX_ENABLED" && "$(readlink "$NGINX_ENABLED")" == "$NGINX_CONFIG" ]] ||
		fail "Ya existe una entrada Nginx llamada $NGINX_SITE en sites-enabled. No se modificó."
fi

printf '\nInstalación de Tracking QR para LXC (Debian/Ubuntu)\n'
printf 'La configuración web de Firebase es pública. No introduzcas claves Admin ni secretos.\n\n'
PUBLIC_HOST=""
if [[ "$PRESERVE_NGINX" == true ]]; then
	PUBLIC_HOST="$(awk '$1 == "server_name" { print $2; exit }' "$NGINX_CONFIG" | tr -d ';')"
	[[ -n "$PUBLIC_HOST" ]] || fail "No se pudo leer server_name en la configuración Nginx existente."
else
	ask "Dominio público o IP, sin protocolo ni ruta (ej. qr.ejemplo.gob.mx)" PUBLIC_HOST
	[[ "$PUBLIC_HOST" =~ ^[A-Za-z0-9.-]+$ && "$PUBLIC_HOST" != *..* && "$PUBLIC_HOST" != .* && "$PUBLIC_HOST" != *. ]] ||
		fail "Dominio o IP no válido. Usa solo letras, números, puntos y guiones, sin protocolo ni ruta."
fi

if [[ "$CONFIGURE_FIREBASE" == true ]]; then
	ask "Firebase Web API Key" FIREBASE_API_KEY
	ask "Firebase Auth Domain (ej. proyecto.firebaseapp.com)" FIREBASE_AUTH_DOMAIN
	ask "Firebase Realtime Database URL (https://...firebaseio.com)" FIREBASE_DATABASE_URL
	ask "Firebase Project ID" FIREBASE_PROJECT_ID
	ask "Firebase App ID" FIREBASE_APP_ID

	for value in "$FIREBASE_API_KEY" "$FIREBASE_AUTH_DOMAIN" "$FIREBASE_DATABASE_URL" "$FIREBASE_PROJECT_ID" "$FIREBASE_APP_ID"; do
		[[ -n "$value" ]] || fail "Todos los valores de Firebase son obligatorios."
	done
	[[ "$FIREBASE_DATABASE_URL" =~ ^https://[A-Za-z0-9.-]+\.(firebaseio\.com|firebasedatabase\.app)/?$ ]] ||
		fail "La URL debe ser HTTPS y corresponder a Realtime Database, no a Storage."
	[[ "$FIREBASE_AUTH_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || fail "Firebase Auth Domain no es válido."
	[[ "$FIREBASE_PROJECT_ID" =~ ^[A-Za-z0-9-]+$ ]] || fail "Firebase Project ID no es válido."
fi

CERT_EMAIL=""
if [[ "$PRESERVE_NGINX" == false && "$PUBLIC_HOST" == *.* && ! "$PUBLIC_HOST" =~ ^[0-9.]+$ ]]; then
	ask "Correo para Let's Encrypt (deja vacío si TLS termina en un proxy externo)" CERT_EMAIL
fi

printf '\nInstalando dependencias y preparando la compilación...\n'
apt-get update
apt-get install -y ca-certificates curl git nginx gnupg
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$NODE_MAJOR" -ge 22 ]] || fail "Se requiere Node.js 22 o superior; se encontró $(node --version)."

if [[ "$UPDATE_MODE" == true ]]; then
	git -C "$INSTALL_DIR" fetch --depth 1 origin "$REPO_BRANCH"
	git -C "$INSTALL_DIR" merge --ff-only FETCH_HEAD
else
	git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"

if [[ "$CONFIGURE_FIREBASE" == true ]]; then
install -m 600 /dev/null .env.production
cat > .env.production <<EOF
NEXT_PUBLIC_FIREBASE_API_KEY=$FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_DATABASE_URL=$FIREBASE_DATABASE_URL
NEXT_PUBLIC_FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID=$FIREBASE_APP_ID
NEXT_PUBLIC_USE_EMULATORS=false
EOF
fi

npm ci
npm run build
[[ -f out/index.html ]] || fail "La compilación terminó sin generar out/index.html."

if [[ "$PRESERVE_NGINX" == false ]]; then
cat > "$NGINX_CONFIG" <<EOF
server {
		listen 80;
		listen [::]:80;
		server_name $PUBLIC_HOST;
		root $INSTALL_DIR/out;
		index index.html;

		add_header X-Content-Type-Options nosniff always;
		add_header Referrer-Policy strict-origin-when-cross-origin always;
		add_header X-Frame-Options DENY always;
		add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

		location ^~ /_next/static/ {
				expires 1y;
				add_header Cache-Control "public, immutable";
		}

		location / {
			try_files \$uri \$uri/ =404;
		}
}
EOF
fi

if [[ ! -L "$NGINX_ENABLED" ]]; then
	ln -s "$NGINX_CONFIG" "$NGINX_ENABLED"
fi
nginx -t
if command -v systemctl >/dev/null 2>&1; then
	systemctl enable --now nginx
	systemctl reload nginx
else
	service nginx start
fi

FINAL_SCHEME="http"
if [[ "$PRESERVE_NGINX" == true ]] && grep -Eq 'listen[[:space:]]+.*443' "$NGINX_CONFIG"; then
	FINAL_SCHEME="https"
elif [[ -n "$CERT_EMAIL" ]]; then
	printf '\nSolicitando certificado TLS para %s...\n' "$PUBLIC_HOST"
	apt-get install -y certbot python3-certbot-nginx
	if certbot --nginx --non-interactive --agree-tos --redirect --email "$CERT_EMAIL" -d "$PUBLIC_HOST"; then
		FINAL_SCHEME="https"
	else
		printf 'Aviso: no se pudo emitir el certificado. Revisa DNS y acceso entrante al puerto 80.\n' >&2
	fi
fi

printf '\nInstalación terminada. Sitio: %s://%s\n' "$FINAL_SCHEME" "$PUBLIC_HOST"
printf 'Directorio de la aplicación: %s\n' "$INSTALL_DIR"
printf 'Siguiente paso obligatorio: agrega %s a Authentication > Settings > Authorized domains en Firebase Console.\n' "$PUBLIC_HOST"
printf 'Verifica también que las reglas de Realtime Database estén publicadas desde database.rules.json.\n'
