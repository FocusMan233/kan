# Kan

Plateforme de collecte de voix et de traductions en langues du Burkina Faso (Mooré et Dioula) pour entraîner de futures IA vocales (téléphonie, santé, doublage).

## Démarrage
```bash
npm install
cp .env.example .env.local   # puis change ADMIN_TOKEN
npm run dev                  # http://localhost:3000
```
Node 22.13+ requis (SQLite intégré `node:sqlite`). Les données sont dans `data/` (base + audios), à sauvegarder.

## Parcours
- **Contributeur** : inscription par téléphone + code à 4 chiffres, puis trois tâches : *Lire* (enregistrer), *Traduire*, *Valider*.
- **Qualité** : une contribution est validée à 2 avis positifs (et plus que de négatifs), rejetée à 2 négatifs ; on ne valide pas son propre travail. Les gains passent de « en attente » à « gagné » ou annulé.
- **Admin** : `/admin` avec `ADMIN_TOKEN` (défaut `kan-admin` en développement uniquement). Statistiques, ajout de phrases, export JSONL des audios et traductions validés.

## Voix
Les consignes sont lues à voix haute. Si des fichiers `public/voice/<langue>/<clé>.mp3` existent, ils sont utilisés ; sinon la synthèse vocale du navigateur lit en français. Aucune voix synthétique en Mooré/Dioula n'existe encore.

## Photos
Voir `IMAGES.md`.

## Limites et à faire avant lancement
- Paiement Mobile Money : manuel, à partir du registre des gains (`ledger`).
- Faire relire le texte de consentement par un juriste (données vocales = données personnelles).
- Faire valider les lettres spéciales (ɛ, ɔ, ɲ, ʋ…) par un coordinateur de chaque langue.
- Limitation des connexions en mémoire : à remplacer en cas de plusieurs serveurs.
