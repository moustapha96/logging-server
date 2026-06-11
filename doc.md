
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

sur le frontend : 
VITE_LOGGER_URL="http://gros.ccbme.sn:4000"

# Voir les logs en temps réel
docker compose logs -f logger

# Redémarrer
docker compose restart logger

# Arrêter
docker compose down

# Mettre à jour après modification
docker compose up -d --build

# Voir l'état du conteneur
docker inspect ccbm-logger

# Accéder au shell du conteneur
docker exec -it ccbm-logger sh

# Voir les logs enregistrés dans le volume
docker exec ccbm-logger ls /app/logs/


VITEssh user@IP_VPS
cd /opt/ccbm-logger

cat > .env << 'EOF'
PORT=4000
NODE_ENV=production
FRONTEND_ORIGINS=https://gros.ccbme.sn,http://localhost:5173
LOG_RETENTION_DAYS=30
MAX_REQUESTS_PER_MINUTE=300
EOF



_LOGGER_URL="https://gros.ccbme.sn/logger"


----------------------------------
rsync -av --exclude='node_modules' --exclude='logs' --exclude='.env' `
  "C:/Users/alhus/Documents/Projet Gestion Stock/logging-server/" `
  user@IP_VPS:/opt/ccbm-logger/



# Lancer le conteneur
docker compose up -d --build

# Ouvrir le port 4000
ufw allow 4000/tcp && ufw reload

# Tester
curl http://localhost:4000/api/stats/health