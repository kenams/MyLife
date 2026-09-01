# MyLife — Beta Gate

Le beta gate ne ferme que si un test réel, sans intervention développeur, passe sur production :

1. créer/ouvrir un compte réel ;
2. avatar terminé ;
3. Map chargée et ville visible ;
4. sollicitation NPC dirigée avant 180 s ;
5. répondre ;
6. conversation + relation `contact` visibles ;
7. fermer/se déconnecter ;
8. nouvelle session : état cloud réhydraté sans double interaction ;
9. revenir sur Map : le même NPC est prioritaire et rappelle la rencontre ;
10. refaire avec refus : aucun malus et aucune relance immédiate.

Les tests unitaires/CI prouvent le contrat de code ; ils ne remplacent pas ce test production.
