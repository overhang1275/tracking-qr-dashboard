#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="https://github.com/overhang1275/tracking-qr-dashboard.git"
REPO_BRANCH="master"
INSTALL_DIR="/opt/tracking-qr-dashboard"
NGINX_SITE="tracking-qr-dashboard"
SERVICE_NAME="tracking-qr-dashboard"

fail() {
	printf 'Error: %s\n' "$*" >&2
	exit 1
}

ask() {
	local label="$1" variable="$2" answer
	read -r -p "$label: " answer </dev/tty || fail "No se pudo leer la configuración desde la terminal."
	printf -v "$variable" '%s' "$answer"
}

[[ "$EUID" -eq 0 ]] || fail "Ejecuta este instalador como root."
[[ -r /dev/tty ]] || fail "Este instalador requiere una terminal interactiva."
[[ -f /etc/os-release ]] || fail "No se pudo identificar la distribución."
# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == "debian" || "${ID:-}" == "ubuntu" || "${ID_LIKE:-}" == *debian* ]] ||
	fail "Distribución no compatible: ${PRETTY_NAME:-desconocida}. Se requiere Debian o Ubuntu."
command -v apt-get >/dev/null 2>&1 || fail "No se encontró apt-get."

NGINX_CONFIG="/etc/nginx/sites-available/$NGINX_SITE"
NGINX_ENABLED="/etc/nginx/sites-enabled/$NGINX_SITE"
UPDATE_MODE=false
PRESERVE_NGINX=false
CONFIGURE_SUPABASE=true
SERVICE_WAS_ACTIVE=false
ENV_TMP=""

cleanup_on_exit() {
	local exit_status=$?
	trap - EXIT
	if [[ -n "$ENV_TMP" ]]; then
		rm -f -- "$ENV_TMP"
	fi
	if [[ "$SERVICE_WAS_ACTIVE" == true ]]; then
		if ! systemctl start "$SERVICE_NAME"; then
			printf 'Aviso: no se pudo reactivar %s; revisa systemctl status.\n' "$SERVICE_NAME" >&2
		fi
	fi
	exit "$exit_status"
}
trap cleanup_on_exit EXIT

if [[ -e "$INSTALL_DIR" ]]; then
	[[ -d "$INSTALL_DIR/.git" && -f "$INSTALL_DIR/package.json" ]] ||
		fail "$INSTALL_DIR existe, pero no parece ser el clon esperado. No se modificó."
	EXISTING_REMOTE="$(git -C "$INSTALL_DIR" remote get-url origin 2>/dev/null || true)"
	[[ "$EXISTING_REMOTE" == "$REPO_URL" ]] || fail "$INSTALL_DIR no apunta al repositorio esperado."
	[[ "$(git -C "$INSTALL_DIR" branch --show-current)" == "$REPO_BRANCH" ]] ||
		fail "La instalación no está en la rama $REPO_BRANCH."
	[[ -z "$(git -C "$INSTALL_DIR" status --porcelain --untracked-files=all)" ]] ||
		fail "Hay cambios locales en el código. Guárdalos o revísalos antes de actualizar."
	UPDATE_MODE=true
	if grep -q '^NEXT_PUBLIC_SUPABASE_URL=.' "$INSTALL_DIR/.env.production" 2>/dev/null &&
		grep -q '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=.' "$INSTALL_DIR/.env.production" 2>/dev/null; then
		CONFIGURE_SUPABASE=false
	fi
	printf 'Instalación existente verificada; se conservarán .env.production y Nginx.\n'
fi

PUBLIC_HOST=""
if [[ -e "$NGINX_CONFIG" || -L "$NGINX_CONFIG" ]]; then
	if [[ -f "$NGINX_CONFIG" && ! -s "$NGINX_CONFIG" ]]; then
		rm -- "$NGINX_CONFIG"
	elif grep -q 'proxy_pass http://127.0.0.1:3000;' "$NGINX_CONFIG"; then
		PRESERVE_NGINX=true
		PUBLIC_HOST="$(awk '$1 == "server_name" { print $2; exit }' "$NGINX_CONFIG" | tr -d ';')"
	elif [[ "$UPDATE_MODE" == true ]]; then
		fail "La configuración Nginx actual no enruta al servidor Next.js. Actualízala manualmente a 127.0.0.1:3000 y vuelve a ejecutar."
	else
		fail "Ya existe una configuración Nginx llamada $NGINX_SITE. No se modificó."
	fi
fi

if [[ "$PRESERVE_NGINX" == false ]]; then
	ask "Dominio público o IP, sin protocolo ni ruta (ej. qr.ejemplo.gob.mx)" PUBLIC_HOST
	[[ "$PUBLIC_HOST" =~ ^[A-Za-z0-9.-]+$ && "$PUBLIC_HOST" != *..* && "$PUBLIC_HOST" != .* && "$PUBLIC_HOST" != *. ]] ||
		fail "Dominio o IP no válido."
fi

SUPABASE_URL=""
SUPABASE_PUBLISHABLE_KEY=""
if [[ "$CONFIGURE_SUPABASE" == true ]]; then
	ask "URL del proyecto Supabase" SUPABASE_URL
	ask "Publishable key de Supabase" SUPABASE_PUBLISHABLE_KEY
	[[ "$SUPABASE_URL" =~ ^https://[A-Za-z0-9.-]+/?$ ]] || fail "La URL de Supabase debe usar HTTPS."
	[[ -n "$SUPABASE_PUBLISHABLE_KEY" ]] || fail "La publishable key no puede estar vacía."
fi

if [[ "$UPDATE_MODE" == true ]]; then
	printf '\nActualizando la instalación existente...\n'
else
	printf '\nInstalando dependencias y preparando Next.js...\n'
fi
apt-get update
apt-get install -y ca-certificates curl git nginx gnupg
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$NODE_MAJOR" -ge 22 ]] || fail "Se requiere Node.js 22 o superior."

if [[ "$UPDATE_MODE" == true ]]; then
	git -C "$INSTALL_DIR" fetch --depth 1 origin "$REPO_BRANCH"
	git -C "$INSTALL_DIR" merge --ff-only FETCH_HEAD
else
	git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"

if [[ "$UPDATE_MODE" == true ]] && systemctl is-active --quiet "$SERVICE_NAME"; then
	printf 'Deteniendo %s mientras se actualizan dependencias y build...\n' "$SERVICE_NAME"
	systemctl stop "$SERVICE_NAME"
	SERVICE_WAS_ACTIVE=true
fi

if [[ "$CONFIGURE_SUPABASE" == true ]]; then
	ENV_TMP="$(mktemp "$INSTALL_DIR/.env.production.XXXXXX")"
	if [[ -f .env.production ]]; then
		awk -F= '
			$1 != "NEXT_PUBLIC_SUPABASE_URL" &&
			$1 != "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" &&
			$1 !~ /^NEXT_PUBLIC_FIREBASE_/ &&
			$1 != "NEXT_PUBLIC_USE_EMULATORS" { print }
		' .env.production > "$ENV_TMP"
	fi
	cat >> "$ENV_TMP" <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
EOF
	chmod 600 "$ENV_TMP"
	mv -- "$ENV_TMP" .env.production
	ENV_TMP=""
fi

npm ci
npm run build
[[ -f .next/BUILD_ID ]] || fail "La compilación terminó sin generar .next/BUILD_ID."
mkdir -p .next/cache
chown -R www-data:www-data .next

cat > "/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=Panel institucional Colima
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
EnvironmentFile=$INSTALL_DIR/.env.production
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

if [[ "$PRESERVE_NGINX" == false ]]; then
	cat > "$NGINX_CONFIG" <<EOF
server {
	listen 80;
	listen [::]:80;
	server_name $PUBLIC_HOST;

	add_header X-Content-Type-Options nosniff always;
	add_header Referrer-Policy strict-origin-when-cross-origin always;
	add_header X-Frame-Options DENY always;
	add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

	location / {
		proxy_pass http://127.0.0.1:3000;
		proxy_http_version 1.1;
		proxy_set_header Host \$host;
		proxy_set_header X-Forwarded-Host \$host;
		proxy_set_header X-Forwarded-Proto \$scheme;
		proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
		proxy_set_header Upgrade \$http_upgrade;
		proxy_set_header Connection "upgrade";
		proxy_buffering off;
	}
}
EOF
fi

if [[ -e "$NGINX_ENABLED" || -L "$NGINX_ENABLED" ]]; then
	[[ -L "$NGINX_ENABLED" && "$(readlink -f "$NGINX_ENABLED")" == "$(readlink -f "$NGINX_CONFIG")" ]] ||
		fail "Ya existe una entrada Nginx llamada $NGINX_SITE que apunta a otra configuración. No se modificó."
else
	ln -s "$NGINX_CONFIG" "$NGINX_ENABLED"
fi

nginx -t
systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
SERVICE_WAS_ACTIVE=false
trap - EXIT
systemctl enable --now nginx
systemctl reload nginx

if [[ "$UPDATE_MODE" == true ]]; then
	printf '\nActualización terminada.\n'
else
	printf '\nInstalación terminada.\n'
fi
printf 'Aplicación Next.js: http://127.0.0.1:3000\n'
printf 'Nginx para el Cloudflare Tunnel: http://127.0.0.1:80\n'
printf 'Configura el dominio público como URL del sitio y redirección permitida en Supabase Auth.\n'
