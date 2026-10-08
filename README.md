# Réviser le grec

Petit site de cartes mémoire pour réviser le grec moderne. Il lit directement
[`words/grec_francais_ankidroid.csv`](words/grec_francais_ankidroid.csv) : le
séparateur est le point-virgule et les colonnes attendues sont `Grec`,
`Prononciation` et `English`.

## Publication

Le workflow GitHub Pages publie le site à chaque push sur `main`. Pour la
première publication, ouvrir **Settings → Pages** dans le dépôt et choisir
**GitHub Actions** comme source. Le site est ensuite disponible à l’adresse
`https://damiendevienne.github.io/learngreek/`.

Pour mettre à jour les cartes, modifier le CSV puis pousser le changement sur
`main`. Le site récupère le CSV actualisé à la prochaine ouverture avec une
connexion Internet. Une copie est conservée pour pouvoir réviser hors ligne.

## Installation sur le téléphone

- **Android** : ouvrir le site dans Chrome, puis choisir **Installer
  l’application** ou **Ajouter à l’écran d’accueil** dans le menu du navigateur.
- **iPhone** : ouvrir le site dans Safari, toucher **Partager**, puis **Sur
  l’écran d’accueil**.

Le choix du côté de départ est mémorisé sur chaque appareil. En mode aléatoire,
chaque carte choisit son côté indépendamment.

Le menu **Ordre** propose deux façons de réviser : **Tous les mots** mélange
les cartes et les montre une fois chacune avant de remélanger le paquet ;
**Random** tire un mot avec remise à chaque clic sur Suivant et masque le
compteur. Il affiche uniquement un grand bouton **Suivant**. Le mode d’ordre
n’est pas mémorisé et revient à **Tous les mots** à chaque ouverture.
