# Clim Pilot

Application de pilotage des interventions de nettoyage et d’hygiénisation de climatisations. Elle comprend un back-office administratif, un parcours technicien mobile, un stockage privé des preuves et une file d’intégrations asynchrone.

## Fonctionnalités disponibles

- tableau de bord alimenté par PostgreSQL ;
- planning jour et semaine, détection des chevauchements et affectation ;
- répertoire clients, sites et équipements ;
- parcours technicien complet : pré-contrôle, photos avant/après, checklist versionnée, produits, incidents, test final et clôture ;
- contrôle qualité et historique détaillé ;
- suivi des techniciens et de leurs échéances documentaires ;
- supervision de la file n8n/Twenty avec retries exponentiels et webhooks signés ;
- isolation des organisations par RLS et contrôle des rôles côté serveur.

## Démarrage local

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Ouvrir ensuite [http://localhost:3000](http://localhost:3000). La commande `db:seed` refuse les bases distantes et celles dont le nom ne se termine pas par `_dev`.

## Variables d’environnement

Copier `.env.example` vers `.env.local`, puis renseigner au minimum `DATABASE_URL`, `APP_BASE_URL`, `FILE_STORAGE_ROOT` et un `SESSION_SECRET` aléatoire d’au moins 32 caractères.

Pour la file d’intégrations, ajouter `N8N_WEBHOOK_URL` et `INTEGRATION_WEBHOOK_SECRET`. Ne jamais réutiliser les secrets de développement en production.

## Commandes de contrôle

```bash
pnpm db:check
pnpm lint
pnpm build
pnpm integrations:dispatch
pnpm auth:bootstrap -- --organization "Clim Air Services" --email admin@example.com --first-name Emma --last-name Martin
```

Le dispatcher est conçu pour être lancé régulièrement par cron ou par un service dédié. Il réserve les événements avec `SKIP LOCKED`, transmet un identifiant d’idempotence, signe le corps en HMAC-SHA256 et applique un délai exponentiel en cas d’échec.

L’endpoint `/api/health` vérifie que l’application peut joindre PostgreSQL. La page `/admin/integrations` affiche l’état de la file d’événements.

## Mise en production

Le déploiement cible un VPS Linux avec HTTPS, une base PostgreSQL dédiée, un volume persistant privé pour les fichiers et des sauvegardes automatiques. Exécuter les migrations avant de démarrer la nouvelle version.

La connexion locale par choix de profil est automatiquement désactivée avec `NODE_ENV=production`. La production utilise Auth.js, des sessions PostgreSQL et des passkeys WebAuthn. Il n’existe aucune inscription publique : le premier Owner est créé avec `auth:bootstrap`, puis les autres comptes sont invités depuis `/admin/access`. Les invitations sont nominatives, valables 30 minutes et utilisables une seule fois. Un Owner ou un administrateur peut révoquer toutes les sessions actives d’un utilisateur.

Définir un `AUTH_SECRET` distinct et aléatoire en production, activer `AUTH_TRUST_HOST` uniquement derrière le reverse proxy prévu, puis conserver `APP_BASE_URL` sur l’URL HTTPS publique exacte. WebAuthn est lié au domaine : un changement de domaine doit être préparé avant le déploiement.
