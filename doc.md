
# Sur ton PC, envoyer le dossier logging-server vers le VPS
scp -r "logging-server/" user@TON_VPS_IP:/var/www/ccbm-logger/

# OU avec rsync (ignore node_modules automatiquement)
rsync -av --exclude='node_modules' --exclude='logs' \
  "logging-server/" user@TON_VPS_IP:/var/www/ccbm-logger/

  ----------------------
  sur le vps:

  ssh user@TON_VPS_IP

cd /var/www/ccbm-logger

# Construire et démarrer
docker compose up -d --build

# Vérifier que ça tourne
docker compose ps
docker compose logs -f


# Si UFW (Ubuntu/Debian)
ufw allow 4000/tcp
ufw reload

# Si firewalld (CentOS/Rocky)
firewall-cmd --permanent --add-port=4000/tcp
firewall-cmd --reload

# Vérifier
curl http://localhost:4000/api/stats/health