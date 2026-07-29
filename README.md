# Site Espace SB

Site statique d’Espace SB servi par un Worker Cloudflare. Le formulaire de
soumission envoie les demandes par Resend et déclenche une conversion Google
Ads uniquement après un envoi accepté.

## Développement local

```bash
npm run dev
```

Le site et l’API du formulaire sont alors disponibles à la même adresse locale.
Le formulaire accepte aussi une page ouverte avec Live Server sur
`localhost`/`127.0.0.1` : dans ce cas, Wrangler doit tout de même fonctionner
sur son port par défaut `8787`. Le script place l’état local de Wrangler dans
`/tmp` pour éviter que ses fichiers internes déclenchent un rechargement
continu des ressources du site.

## Configuration du formulaire

Les variables publiques se trouvent dans `wrangler.jsonc` :

- `RESEND_FROM_EMAIL` : expéditeur utilisant un domaine vérifié dans Resend;
- `RESEND_TO_EMAIL` : destinataire interne des demandes;
- `FORM_ALLOWED_ORIGINS` : origines web supplémentaires autorisées à appeler
  l’API, séparées par des virgules (l’origine du Worker est toujours autorisée);
- `GOOGLE_ADS_CONVERSION_TARGET` : identifiant complet de l’action de
  conversion (`AW-…/…`).

La cible distincte des clics téléphoniques se configure dans
`js/analytics.js`. Elle doit provenir d’une action Google Ads de type appel ou
clic sur numéro, afin de ne pas mélanger les appels et les formulaires.

La clé Resend demeure un secret Cloudflare et ne doit jamais être ajoutée au
dépôt :

```bash
npx wrangler secret put RESEND_API_KEY
```

Pour les essais locaux, créer un fichier `.dev.vars` non suivi par Git :

```dotenv
RESEND_API_KEY=re_votre_cle
```

Avant le premier envoi réel, vérifier dans Resend le domaine utilisé par
`RESEND_FROM_EMAIL` (actuellement `militime.ai`).

## Vérifications

```bash
node --test worker.test.mjs
node --check worker.js
node --check js/soumission.js
```
