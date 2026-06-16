# Politique de Confidentialité — MyLife

**Version 1.0 — En vigueur au 16 juin 2026**
**Responsable de traitement : KAH Digital · kahdigital42@gmail.com**

---

## 1. Données collectées

| Donnée | Finalité | Durée de conservation |
|--------|----------|-----------------------|
| Email | Authentification, communications | Durée du compte + 30 jours |
| Pseudonyme / Avatar | Affichage dans l'app | Durée du compte |
| Position GPS (opt-in) | Affichage sur Life Map | 72h maximum |
| Statut relationnel | Affichage sur Life Map | Durée du compte |
| Activités in-app | Game loop, statistiques | 90 jours |
| Logs de connexion | Sécurité | 30 jours |

---

## 2. Partage des données

Vos données ne sont **jamais vendues** à des tiers.

Elles peuvent être partagées avec :
- **Supabase** (hébergement base de données, UE) — [politique Supabase](https://supabase.com/privacy)
- **Expo / EAS** (build de l'application) — [politique Expo](https://expo.dev/privacy)

---

## 3. Géolocalisation

La géolocalisation est **100% optionnelle**. Vous pouvez :
- Ne jamais l'activer → votre position n'est jamais collectée
- L'activer et la désactiver à tout moment via le mode **Ghost ⚫**
- Révoquer la permission depuis les paramètres de votre téléphone

Votre position visible sur la map est **approximative** (précision quartier, pas adresse exacte).

---

## 4. Cookies et stockage local

MyLife utilise le stockage local de l'appareil (AsyncStorage) pour mémoriser votre session. Aucun cookie publicitaire n'est utilisé.

---

## 5. Vos droits RGPD

Contactez kahdigital42@gmail.com pour exercer :
- Droit d'accès · Rectification · Effacement · Portabilité · Opposition

Réponse garantie sous 30 jours. Suppression complète sous 72h après demande.

---

## 6. Sécurité

- Mots de passe hashés (bcrypt via Supabase Auth)
- Communications chiffrées (HTTPS/TLS)
- Accès base de données via Row Level Security (RLS)
- Aucun employé n'a accès aux mots de passe

---

## 7. Mineurs

MyLife est **interdite aux mineurs de moins de 18 ans**. Si vous pensez qu'un mineur utilise l'app, signalez-le à kahdigital42@gmail.com.

---

## 8. Contact DPO

Pour toute question relative à vos données personnelles :
**kahdigital42@gmail.com** — Objet : [RGPD MyLife]
