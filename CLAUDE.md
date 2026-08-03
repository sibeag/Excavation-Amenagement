# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static website (HTML/CSS/JS — no build tools, no framework) for **Groupe SPB**, an excavation and landscaping company serving the Cantons-de-l'Est region of Quebec (Bromont, Sutton, Knowlton, Lac Brome, Shefford, Cowansville). Open any `.html` file directly in a browser to preview.

## Contact info

- Phone: `514-779-8590`
- Email: `infogroupespb@gmail.com`
- Service area: Bromont, Sutton, Knowlton, Lac Brome, Shefford, Cowansville

## Structure

| File | Role |
|------|------|
| `index.html` | Home page — hero, intro, service preview cards, CTA |
| `amenagement-paysager.html` | Service page — Aménagement Paysager, incl. its own project photo gallery |
| `nivellement-drainage.html` | Service page — Nivellement & Drainage, incl. its own project photo gallery |
| `excavation-soutenement.html` | Service page — Excavation & Soutènement, incl. its own project photo gallery |
| `pave-uni-dalles.html` | Service page — Pavé Uni & Dalles de Béton, incl. its own project photo gallery |
| `deneigement.html` | Snow removal service page (blue theme via `body.theme-bleu`) |
| `soumission.html` | Custom quote request form |
| `css/style.css` | Single stylesheet shared by all main-site pages above |
| `js/soumission.js` | Form validation, submission state, and Google Ads conversion event |
| `functions/api/soumission.js` | Cloudflare Pages route for the quote API |
| `worker.js` | Shared Resend-backed quote handler and Worker test adapter |
| `ads/` | Standalone Google Ads landing funnel — same pages/content, own design (`css/landing-ads.css`), `noindex` |

There is no single "Services" page — a dropdown nav item (`.nav-dropdown`, `.nav-dropdown-menu`) links to the 4 service pages instead. There is also no standalone "Réalisations" page — each service page ends with its own "Nos réalisations" photo gallery (`.galerie-grid` + click-to-enlarge `.lightbox`) showing real project photos for that service, sourced from `images/realisations/`. Captions are the raw image filename (minus extension), per client preference — don't "clean up" the wording without asking.

## Development

No build step. Open any HTML file directly in a browser, or use a dev server:

```bash
npx serve .          # Node.js
python -m http.server 8080  # Python
# VS Code: right-click index.html → Open with Live Server
```

## Architecture

**CSS** is organized in named sections (`/* === ... === */`) in this order: variables/reset → utilities → nav → hero → intro → service cards → services page → CTA → form → footer → responsive. All design tokens (colors, radius, shadow) are CSS custom properties on `:root`.

**Navigation** is duplicated across every page (both the main site and `ads/`) — update it in all files when adding pages. The current page gets `class="active"` on its `<a>` link; on a service page, the "Services" dropdown toggle also gets `class="active"`.

**Form (`soumission.html`)** posts JSON to `/api/soumission`. The Cloudflare
Pages Function validates the request through the shared handler in `worker.js`
and sends the lead through Resend. It returns the configured Google Ads
conversion target only after Resend accepts the email; the browser then fires
the conversion event with the submission UUID as its transaction ID.

Keep `RESEND_API_KEY` in a Cloudflare secret or local `.dev.vars`, never in the
repository. The sender domain must be verified in Resend.

## Services offered (industry terminology)

Use these standard Quebec industry terms consistently across the site:

| Service | Terms to use |
|---|---|
| Excavation | Excavation, terrassement, nivellement de terrain, déblai/remblai, drain français |
| Landscaping | Aménagement paysager, pose de tourbe, engazonnement, enrochement, haies de cèdres, plantations |
| Concrete/pavers | Pavé uni, dalles de béton, béton estampé, béton coloré, pourtour de piscine |
| Retaining walls | Murets de soutènement, murs de soutènement, blocs à emboîtement, enrochement |

## Language

All user-facing content is in **French (Canadian)**. Keep new content in French.
