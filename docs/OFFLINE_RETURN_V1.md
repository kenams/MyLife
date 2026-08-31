# Offline Return V1

Objectif : donner au joueur une preuve visible que Toulouse a continué à vivre pendant son absence, sans ajouter de second moteur.

- Réutilise `livingCity.lastAbsenceSummary`, déjà produit par le City Engine après une absence d'au moins 45 minutes.
- Affiche au maximum 3 changements dans un panneau compact `PENDANT TON ABSENCE`.
- Déduplique les lignes et ne montre rien s'il n'y a aucun événement significatif.
- Le panneau est dismissible ; la signature du dernier résumé fermé est persistée localement pour éviter de le réafficher à chaque reload.
- Aucun nouveau timer, aucune nouvelle simulation, aucune migration DB, aucun LLM.

Prochaine tranche : City Pulse / Game Director visible dès l'ouverture avec 1 à 3 opportunités réellement contextuelles.
