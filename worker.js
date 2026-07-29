const RESEND_API_URL = "https://api.resend.com/emails";
const MAX_REQUEST_BYTES = 20_000;

const VILLES = {
  bromont: "Bromont",
  granby: "Granby",
  sutton: "Sutton",
  knowlton: "Knowlton",
  "lac-brome": "Lac Brome",
  shefford: "Shefford",
  cowansville: "Cowansville",
  autre: "Autre ville de la région",
};

const SERVICES = {
  excavation: "Excavation / Terrassement",
  drain: "Drain français / Drainage",
  paysager: "Aménagement paysager",
  tourbe: "Pose de tourbe / Engazonnement",
  "pave-uni": "Pavé uni",
  dalles: "Dalles de béton / Béton estampé",
  murets: "Murets de béton / Mur de soutènement",
  enrochement: "Enrochement",
  multiple: "Plusieurs services",
  autre: "Autre",
};

const ECHEANCES = {
  urgent: "Le plus tôt possible",
  "1mois": "Dans le prochain mois",
  printemps: "Au printemps",
  ete: "Cet été",
  automne: "À l'automne",
  flexible: "Date flexible",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/soumission") {
      return handleSoumissionRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

export async function handleSoumissionRequest(request, env) {
  const entetesCors = creerEntetesCors(request, env);

  if (!entetesCors) {
    return jsonResponse({ ok: false, error: "Origine non permise." }, 403);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...entetesCors,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Méthode non permise." },
      405,
      { ...entetesCors, Allow: "POST, OPTIONS" },
    );
  }

  return handleSoumission(request, env, entetesCors);
}

async function handleSoumission(request, env, entetesCors) {
  const repondre = (body, status = 200, headers = {}) =>
    jsonResponse(body, status, { ...entetesCors, ...headers });

  const tailleDeclaree = Number(request.headers.get("Content-Length") || 0);
  if (tailleDeclaree > MAX_REQUEST_BYTES) {
    return repondre({ ok: false, error: "La demande est trop volumineuse." }, 413);
  }

  if (!request.headers.get("Content-Type")?.includes("application/json")) {
    return repondre({ ok: false, error: "Format de requête invalide." }, 415);
  }

  let donnees;
  try {
    donnees = await request.json();
  } catch {
    return repondre({ ok: false, error: "Requête invalide." }, 400);
  }

  if (!donnees || typeof donnees !== "object" || Array.isArray(donnees)) {
    return repondre({ ok: false, error: "Requête invalide." }, 400);
  }

  if (JSON.stringify(donnees).length > MAX_REQUEST_BYTES) {
    return repondre({ ok: false, error: "La demande est trop volumineuse." }, 413);
  }

  const soumission = {
    prenom: nettoyer(donnees.prenom, 80),
    nom: nettoyer(donnees.nom, 80),
    telephone: nettoyer(donnees.telephone, 30),
    courriel: nettoyer(donnees.courriel, 254).toLowerCase(),
    ville: nettoyer(donnees.ville, 40),
    adresse: nettoyer(donnees.adresse, 180),
    service: nettoyer(donnees.service, 40),
    echeance: nettoyer(donnees.echeance, 40),
    description: nettoyerDescription(donnees.description, 3_000),
    siteweb: nettoyer(donnees.siteweb, 180),
    submissionId: nettoyer(donnees.submissionId, 36),
  };

  // Les robots remplissent souvent ce champ invisible. On répond normalement,
  // mais aucun courriel ni événement de conversion ne sera produit.
  if (soumission.siteweb) {
    return repondre({ ok: true, accepted: false });
  }

  const erreur = validerSoumission(soumission);
  if (erreur) {
    return repondre({ ok: false, error: erreur }, 400);
  }

  const destinataires = extraireDestinataires(env.RESEND_TO_EMAIL);
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || destinataires.length === 0) {
    return repondre(
      {
        ok: false,
        error: "Le service de courriel est temporairement indisponible.",
      },
      503,
    );
  }

  const ville = VILLES[soumission.ville];
  const service = SERVICES[soumission.service] || "Non précisé";
  const echeance = ECHEANCES[soumission.echeance] || "Non précisée";

  const courriel = {
    from: env.RESEND_FROM_EMAIL,
    to: destinataires,
    reply_to: soumission.courriel,
    subject: `Nouvelle soumission — ${soumission.prenom} ${soumission.nom} (${ville})`,
    text: creerVersionTexte(soumission, { ville, service, echeance }),
    html: creerVersionHtml(soumission, { ville, service, echeance }),
  };

  let reponseResend;
  try {
    reponseResend = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `soumission-${soumission.submissionId}`,
      },
      body: JSON.stringify(courriel),
    });
  } catch {
    return repondre(
      { ok: false, error: "Impossible d'envoyer la demande pour le moment." },
      502,
    );
  }

  if (!reponseResend.ok) {
    return repondre(
      { ok: false, error: "Impossible d'envoyer la demande pour le moment." },
      502,
    );
  }

  return repondre({
    ok: true,
    accepted: true,
    submissionId: soumission.submissionId,
    conversionTarget: cibleConversionValide(env.GOOGLE_ADS_CONVERSION_TARGET)
      ? env.GOOGLE_ADS_CONVERSION_TARGET
      : null,
  });
}

function extraireDestinataires(valeur) {
  return [
    ...new Set(
      String(valeur || "")
        .split(",")
        .map((courriel) => courriel.trim())
        .filter(Boolean),
    ),
  ];
}

function creerEntetesCors(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;

  const urlRequete = new URL(request.url);
  const originesPermises = new Set([urlRequete.origin]);
  for (const origine of (env.FORM_ALLOWED_ORIGINS || "").split(",")) {
    if (origine.trim()) originesPermises.add(origine.trim());
  }

  if (
    !originesPermises.has(origin) &&
    !estOrigineLocalePermise(urlRequete, origin)
  ) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
}

function estOrigineLocalePermise(urlRequete, origin) {
  try {
    const urlOrigine = new URL(origin);
    return (
      estHoteLocal(urlRequete.hostname) &&
      estHoteLocal(urlOrigine.hostname) &&
      ["http:", "https:"].includes(urlOrigine.protocol)
    );
  } catch {
    return false;
  }
}

function estHoteLocal(hote) {
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hote);
}

function validerSoumission(soumission) {
  const requis = [
    ["prenom", "Veuillez indiquer votre prénom."],
    ["nom", "Veuillez indiquer votre nom."],
    ["telephone", "Veuillez indiquer votre numéro de téléphone."],
    ["courriel", "Veuillez indiquer votre adresse courriel."],
    ["ville", "Veuillez sélectionner votre ville."],
    ["adresse", "Veuillez indiquer l'adresse des travaux."],
  ];

  for (const [champ, message] of requis) {
    if (!soumission[champ]) return message;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(soumission.courriel)) {
    return "L'adresse courriel est invalide.";
  }

  if (soumission.telephone.replace(/\D/g, "").length < 10) {
    return "Le numéro de téléphone est invalide.";
  }

  if (!VILLES[soumission.ville]) {
    return "La ville sélectionnée est invalide.";
  }

  if (soumission.service && !SERVICES[soumission.service]) {
    return "Le service sélectionné est invalide.";
  }

  if (soumission.echeance && !ECHEANCES[soumission.echeance]) {
    return "L'échéance sélectionnée est invalide.";
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      soumission.submissionId,
    )
  ) {
    return "Identifiant de demande invalide.";
  }

  return null;
}

function nettoyer(valeur, longueurMax) {
  if (typeof valeur !== "string") return "";
  return valeur
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, longueurMax);
}

function nettoyerDescription(valeur, longueurMax) {
  if (typeof valeur !== "string") return "";
  return valeur
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, longueurMax);
}

function creerVersionTexte(soumission, libelles) {
  return [
    "Nouvelle demande de soumission — Espace SB",
    "",
    `Nom : ${soumission.prenom} ${soumission.nom}`,
    `Téléphone : ${soumission.telephone}`,
    `Courriel : ${soumission.courriel}`,
    `Ville : ${libelles.ville}`,
    `Adresse des travaux : ${soumission.adresse}`,
    `Service : ${libelles.service}`,
    `Échéance souhaitée : ${libelles.echeance}`,
    "",
    "Description du projet :",
    soumission.description || "Non précisée",
    "",
    `Référence : ${soumission.submissionId}`,
  ].join("\n");
}

function creerVersionHtml(soumission, libelles) {
  const lignes = [
    ["Nom", `${soumission.prenom} ${soumission.nom}`],
    ["Téléphone", soumission.telephone],
    ["Courriel", soumission.courriel],
    ["Ville", libelles.ville],
    ["Adresse des travaux", soumission.adresse],
    ["Service", libelles.service],
    ["Échéance souhaitée", libelles.echeance],
  ]
    .map(
      ([titre, valeur]) => `
        <tr>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">${echapperHtml(titre)}</td>
          <td style="padding:10px 14px;color:#0f1f1a;font-size:15px;font-weight:600;border-bottom:1px solid #e2e8f0;">${echapperHtml(valeur)}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#334155;">
    <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
      <div style="background:#1e3a2f;padding:24px 28px;border-radius:10px 10px 0 0;">
        <p style="margin:0 0 6px;color:#d9c39f;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Espace SB</p>
        <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:1.3;">Nouvelle demande de soumission</h1>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:0;padding:28px;border-radius:0 0 10px 10px;">
        <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:24px;">${lignes}</table>
        <h2 style="margin:0 0 8px;color:#1e3a2f;font-size:17px;">Description du projet</h2>
        <p style="margin:0;padding:16px;background:#f8fafc;border-left:3px solid #b8843a;white-space:pre-wrap;line-height:1.6;">${echapperHtml(soumission.description || "Non précisée")}</p>
        <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">Référence : ${echapperHtml(soumission.submissionId)}</p>
      </div>
    </div>
  </body>
</html>`;
}

function echapperHtml(valeur) {
  return String(valeur)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cibleConversionValide(cible) {
  return /^AW-\d+\/[A-Za-z0-9_-]+$/.test(cible || "");
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
