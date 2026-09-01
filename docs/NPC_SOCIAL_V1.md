# NPC SOCIAL V1 — Beta Gate

Objectif unique : rendre fiable la première boucle sociale solo sans créer un second moteur NPC.

## Parcours cible

Compte + avatar → Map → sollicitation PNJ dirigée en moins de 3 minutes → répondre/refuser → conséquence → relation persistée → session suivante → le même PNJ se souvient du lien.

## Implémentation

- Réutilise les PNJ déjà produits par Living City / CityRuntime.
- Le directeur de présentation attend 45 s pour une première rencontre et 60 s pour un callback connu.
- Priorité à un habitant simulé du quartier du joueur ; QA exclue.
- `RÉPONDRE` utilise les actions existantes `updateNpcRelation(+15)` et `startDirectConversation`.
- `npcRelations` et `conversations` font déjà partie du player cloud state : le listener Supabase existant les synchronise avec CAS/idempotence du cloud state.
- `PAS MAINTENANT` ne modifie ni score ni compteur de relation et applique un cooldown local de 3 h pour éviter le spam.
- Double tap protégé côté présentation par un verrou synchrone.
- Aucun nouveau tick, moteur, canal Realtime, LLM ou migration.

## Acceptation

- A1 : carte visible/actionnable < 180 s sans action joueur — délai produit : 45 s.
- A2 : répondre/refuser sont de vraies actions.
- A3 : répondre crée au minimum une relation NPC `contact` (score 15) et une conversation ; double tap bloqué.
- A4 : relation + conversation sont dans le cloud state existant et sont réhydratées à la connexion.
- A5 : une relation connue est prioritaire à la session suivante ; callback après 60 s et texte de mémoire explicite.
- A6 : refus neutre, cooldown 3 h, aucun spam immédiat.

La validation production réelle (nouveau compte, téléphone, logout/login) reste obligatoire avant de déclarer le beta gate fermé.
