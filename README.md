# mathieumissiaen.fr

Site statique, sans outil de compilation : du HTML, une feuille de style, un script, et trois fichiers de contenu.

## Où est quoi

| Dossier / fichier | Rôle |
|---|---|
| `content/projects.json` | Toutes les séries et commandes (textes, couleurs, police, images, crédits). L'ordre de la liste est l'ordre sur le site. |
| `content/films.json` | Les films de la page Moving image (numéro Vimeo, vignette, texte). |
| `content/site.json` | Textes de l'accueil, Lab, About, contact. |
| `images/` | Les images, rangées par projet. |
| `index.html`, `project.html`, `gallery.html`, `film.html`, `about.html` | Les pages (elles ne contiennent rien : tout vient des JSON). |
| `assets/site.css`, `assets/site.js` | Le design et le rendu. |
| `lab/rash-lab/` | L'outil Rash Lab. |
| `.pages.yml` | La configuration de l'éditeur Pages CMS. |

Une page de projet s'ouvre avec `project.html#identifiant`, par exemple `project.html#tal`.

## Modifier le site seul

1. Va sur https://app.pagescms.org et connecte-toi avec GitHub.
2. Choisis le dépôt du site. Les menus *Projets*, *Films* et *Textes du site* apparaissent.
3. Pour **ajouter une galerie** : *Projets* → *Ajouter*, remplis titre, identifiant, type (research ou commission), puis ajoute une section et ses images (glisser-déposer).
4. Pour **retirer une galerie** : supprime-la de la liste *Projets*.
5. Pour **ajouter un film** : *Films* → *Ajouter*, colle le numéro Vimeo (la fin de l'adresse vimeo.com/…).
6. Enregistre : Netlify remet le site en ligne tout seul en une minute environ.

Conseil images : JPG, 2200 px maximum sur le grand côté, moins de 1 Mo si possible.

## Modifier le site avec Claude

Demande simplement (« ajoute une série X avec ces images », « enlève Plates ») : Claude modifie les JSON et les images, puis pousse sur GitHub. Netlify publie.

## Mise en ligne (une seule fois)

1. Crée un compte sur https://www.netlify.com avec ton compte GitHub.
2. *Add new site* → *Import an existing project* → GitHub → choisis ce dépôt. Aucun réglage de build : laisse vide, dossier de publication `.`.
3. Le site est en ligne sur une adresse `….netlify.app`.
4. *Domain management* → ajoute `mathieumissiaen.fr`, puis chez ton registrar remplace les DNS pointant vers Adobe Portfolio par ceux indiqués par Netlify. Le HTTPS est automatique.

## Vimeo

Pour que le lecteur fonctionne sur le site : sur Vimeo, dans les réglages de confidentialité de chaque film (ou en masse), *Où cette vidéo peut-elle être intégrée* → *Partout*, ou *Domaines spécifiques* avec `mathieumissiaen.fr` et l'adresse `netlify.app`.

## Mises à jour

Le site est relié à Netlify : chaque modification envoyée sur la branche `main` est mise en ligne automatiquement.

## Référencement (SEO)

`build.py` est lancé automatiquement par Netlify à chaque mise en ligne. À partir des fichiers `content/*.json`, il génère :
- une vraie page par projet : `/work/<identifiant>/` (titre, description, image de partage, données structurées) ;
- les pages `index.html`, `gallery.html`, `film.html`, `about.html`, `404.html` avec leurs balises ;
- `sitemap.xml` et `robots.txt`.

Ne modifie pas ces fichiers à la main : change le contenu dans Pages CMS (ou les JSON), ils seront régénérés.
