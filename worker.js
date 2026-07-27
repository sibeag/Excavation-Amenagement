import { EmailMessage } from "cloudflare:email";

const DESTINATION = "simonbeaudet@yahoo.ca";
const FROM_ADDRESS = "soumission@espacesb.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/soumission" && request.method === "POST") {
      return handleSoumission(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleSoumission(request, env) {
  let data;
  try {
    data = await request.formData();
  } catch {
    return jsonResponse({ ok: false, error: "Requête invalide" }, 400);
  }

  const champ = (nom) => (data.get(nom) || "").toString().trim();

  const prenom = champ("prenom");
  const nom = champ("nom");
  const telephone = champ("telephone");
  const courriel = champ("courriel");
  const ville = champ("ville");
  const adresse = champ("adresse");
  const service = champ("service");
  const echeance = champ("echeance");
  const description = champ("description");

  if (!prenom || !nom || !telephone || !ville || !service || !description) {
    return jsonResponse({ ok: false, error: "Champs requis manquants" }, 400);
  }

  const corps = [
    "Nouvelle demande de soumission — Espace SB",
    "",
    `Nom: ${prenom} ${nom}`,
    `Téléphone: ${telephone}`,
    `Courriel: ${courriel || "non fourni"}`,
    `Ville: ${ville}`,
    `Adresse des travaux: ${adresse || "non fournie"}`,
    `Service: ${service}`,
    `Échéance souhaitée: ${echeance || "non précisée"}`,
    "",
    "Description du projet:",
    description,
  ].join("\r\n");

  const raw = buildMime({
    to: DESTINATION,
    subject: `Nouvelle soumission — ${prenom} ${nom} (${ville})`,
    replyTo: courriel || undefined,
    texte: corps,
  });

  try {
    const message = new EmailMessage(FROM_ADDRESS, DESTINATION, raw);
    await env.SEB_MAIL.send(message);
  } catch (err) {
    return jsonResponse({ ok: false, error: "Échec de l'envoi du courriel" }, 502);
  }

  return jsonResponse({ ok: true });
}

function buildMime({ to, subject, replyTo, texte }) {
  const lignes = [
    `From: Espace SB — Site Web <${FROM_ADDRESS}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  if (replyTo) lignes.push(`Reply-To: ${replyTo}`);
  lignes.push("", texte);
  return lignes.join("\r\n");
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
