# Outils RNN

Outils d'aide à la décision du **Service de Réanimation Néonatale du CHU de Saint-Étienne**.

Site statique, sans dépendance externe : tout le calcul se fait dans le navigateur,
aucune donnée saisie n'est transmise ni enregistrée.

## Contenu

| Outil | Fichier | Description |
|---|---|---|
| Prédiction du succès d'extubation | `outils/extubation.html` | Probabilité d'échec d'extubation à partir du **terme de naissance** (SA) et du **pH pré-extubation**. Modèle logistique issu du travail de M<sup>me</sup> Murgue : `logit(p) = 71,58 − 0,748 × ÂG(SA) − 7,29 × pH`, `p = 1 / (1 + e^−logit)`. |

## Structure

```
index.html                  page d'accueil (tuiles)
outils/extubation.html      outil « extubation »
assets/css/style.css        thème commun (clair / sombre)
assets/js/theme.js          bascule de thème
assets/js/extubation.js     modèle + graphiques de l'outil « extubation »
```

## Publication sur GitHub Pages

1. Créer un dépôt GitHub et y pousser le contenu de ce dossier (le fichier
   `index.html` doit être à la racine du dépôt).
2. Dans **Settings → Pages**, choisir *Deploy from a branch*, branche `main`,
   dossier `/ (root)`.
3. Le site est publié sur `https://<utilisateur>.github.io/<dépôt>/`.

Tous les chemins sont relatifs : le site fonctionne aussi bien à la racine d'un
domaine que dans un sous-dossier, et en ouverture directe des fichiers en local.

## Ajouter un outil

1. Créer `outils/<nom>.html` sur le modèle de `outils/extubation.html`
   (même barre supérieure, même pied de page, `../assets/…` pour les ressources).
2. Ajouter une tuile dans la liste `.tiles` de `index.html` — le bloc
   `tile--soon` sert de gabarit d'emplacement libre.

## Crédits

Cantais et al. — Service de Réanimation Néonatale, CHU de Saint-Étienne.

Ces outils sont des aides à la décision ; ils ne remplacent pas le jugement clinique.
