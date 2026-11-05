# Déploiement sur le VPS — camp.tangagroup.com

1. **DNS** : crée un enregistrement `A` : `camp` → IP du VPS.
2. **Récupérer le code** : `git clone -b jeu-3d https://github.com/FocusMan233/kan.git && cd kan/jeu-3d`
3. **Mot de passe admin** : `echo 'ADMIN_PASSWORD=choisis-un-mot-de-passe-solide' > .env`
4. **Lancer (Docker)** : `docker compose up -d --build`
   (sans Docker : Node 22+, `npm install`, puis `ADMIN_PASSWORD=... npm start`, idéalement avec pm2 ou systemd).
5. **HTTPS** (obligatoire pour le micro et le partage de clip) : 
   - Caddy : copie `deploy/Caddyfile` dans `/etc/caddy/Caddyfile`, `sudo systemctl reload caddy` (HTTPS automatique), ou
   - Nginx : `deploy/nginx-camp.conf` puis `sudo certbot --nginx -d camp.tangagroup.com`.
6. **Vraies cartes** : au premier démarrage, le serveur télécharge tout seul les cartes OpenStreetMap des 4 quartiers (logs : `docker compose logs -f`). Il faut que le VPS ait accès à Internet. Relance à la main si besoin : `docker compose exec kan node tools/import-osm.mjs`. Quand c'est fini, le badge « Carte réelle ✓ » apparaît dans le choix du quartier.
7. **Admin** : https://camp.tangagroup.com/admin

Sauvegarde : le volume `kan-data` (base SQLite + voix).
