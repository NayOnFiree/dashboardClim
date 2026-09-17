# Base de données

La migration `001_initial_schema.sql` prépare le modèle PostgreSQL du MVP : organisations, utilisateurs, clients, sites, équipements, interventions, checklists versionnées, photos, incidents, paiements, journal d’audit et outbox d’intégration.

## Commandes

- `pnpm db:check` verifie la connexion en lecture seule et liste les tables publiques.
- `pnpm db:migrate` applique les fichiers SQL non encore executes et controle leur empreinte.
- `pnpm db:seed` charge le jeu de demonstration idempotent. Par securite, cette commande refuse toute base distante ou dont le nom ne se termine pas par `_dev`.

Les commandes chargent `.env.local` sans en afficher les secrets. L’application devra ensuite :

1. définir `app.organization_id` dans chaque transaction après authentification ;
2. ajouter les politiques d’accès spécifiques aux techniciens assignés ;
3. implémenter les validations métier BR-001 à BR-015 dans la couche serveur ;
4. stocker les fichiers hors PostgreSQL et seulement leurs métadonnées en base ;
5. traiter `integration_events` de manière asynchrone et idempotente.
