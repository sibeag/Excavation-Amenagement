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
| `services.html` | Full services page — one detailed bloc per service |
| `soumission.html` | Quote request form with client-side validation |
| `css/style.css` | Single stylesheet shared by all three pages |

## Development

No build step. Open any HTML file directly in a browser, or use a dev server:

```bash
npx serve .          # Node.js
python -m http.server 8080  # Python
# VS Code: right-click index.html → Open with Live Server
```

## Architecture

**CSS** is organized in named sections (`/* === ... === */`) in this order: variables/reset → utilities → nav → hero → intro → service cards → services page → CTA → form → footer → responsive. All design tokens (colors, radius, shadow) are CSS custom properties on `:root`.

**Navigation** is duplicated in all three pages — update it in all files when adding pages. The current page gets `class="active"` on its `<a>` link.

**Form (`soumission.html`)** performs client-side validation only. To wire up real email delivery, integrate [Formspree](https://formspree.io): add `action="https://formspree.io/f/YOUR_ID"` to the `<form>` tag and remove the `e.preventDefault()` call in the submit handler.

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
