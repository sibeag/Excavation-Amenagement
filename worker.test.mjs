import assert from "node:assert/strict";
import test from "node:test";

import { onRequest as onRequestSoumission } from "./functions/api/soumission.js";
import worker from "./worker.js";

const ENV = {
  ASSETS: {
    fetch: () => new Response("asset"),
  },
  RESEND_API_KEY: "re_test_key",
  RESEND_FROM_EMAIL: "Espace SB <soumission@espacesb.com>",
  RESEND_TO_EMAIL: "p@example.com, simon@example.com",
  GOOGLE_ADS_CONVERSION_TARGET:
    "AW-18139948408/JFtbCMih59gcEPjK5slD",
};

const SOUMISSION_VALIDE = {
  prenom: "Jean",
  nom: "Tremblay",
  telephone: "514-555-1234",
  courriel: "jean@example.com",
  ville: "bromont",
  adresse: "123, rue des Érables",
  service: "excavation",
  echeance: "flexible",
  description: "Nivellement du terrain arrière.",
  siteweb: "",
  submissionId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
};

function creerRequete(payload = SOUMISSION_VALIDE, options = {}) {
  return new Request("https://espacesb.com/api/soumission", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: options.origin || "https://espacesb.com",
    },
    body: JSON.stringify(payload),
  });
}

test("expose la soumission sur la route Cloudflare Pages", async (t) => {
  const fetchOriginal = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = fetchOriginal;
  });

  globalThis.fetch = async () => Response.json({ id: "email_pages_123" });

  const reponse = await onRequestSoumission({
    request: creerRequete(),
    env: ENV,
  });

  assert.equal(reponse.status, 200);
  assert.equal((await reponse.json()).accepted, true);
});

test("envoie une soumission valide à Resend et retourne la conversion", async (t) => {
  const fetchOriginal = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = fetchOriginal;
  });

  let requeteResend;
  let optionsResend;
  globalThis.fetch = async (requete, options) => {
    requeteResend = requete;
    optionsResend = options;
    return Response.json({ id: "email_123" });
  };

  const reponse = await worker.fetch(creerRequete(), ENV);
  const resultat = await reponse.json();
  const courriel = JSON.parse(optionsResend.body);

  assert.equal(reponse.status, 200);
  assert.equal(
    reponse.headers.get("Access-Control-Allow-Origin"),
    "https://espacesb.com",
  );
  assert.deepEqual(resultat, {
    ok: true,
    accepted: true,
    submissionId: SOUMISSION_VALIDE.submissionId,
    conversionTarget: ENV.GOOGLE_ADS_CONVERSION_TARGET,
  });
  assert.equal(requeteResend, "https://api.resend.com/emails");
  assert.equal(optionsResend.method, "POST");
  assert.equal(
    optionsResend.headers["Idempotency-Key"],
    `soumission-${SOUMISSION_VALIDE.submissionId}`,
  );
  assert.equal(optionsResend.headers.Authorization, "Bearer re_test_key");
  assert.deepEqual(courriel.to, ["p@example.com", "simon@example.com"]);
  assert.equal(courriel.reply_to, "jean@example.com");
  assert.match(courriel.subject, /Jean Tremblay \(Bromont\)/);
  assert.match(courriel.html, /Nivellement du terrain arrière/);
});

test("refuse une soumission incomplète avant tout appel à Resend", async (t) => {
  const fetchOriginal = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = fetchOriginal;
  });

  let nombreAppels = 0;
  globalThis.fetch = async () => {
    nombreAppels += 1;
    return Response.json({ id: "email_123" });
  };

  const reponse = await worker.fetch(
    creerRequete({ ...SOUMISSION_VALIDE, courriel: "" }),
    ENV,
  );
  const resultat = await reponse.json();

  assert.equal(reponse.status, 400);
  assert.equal(resultat.ok, false);
  assert.equal(nombreAppels, 0);
});

test("ignore silencieusement le piège à robots", async (t) => {
  const fetchOriginal = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = fetchOriginal;
  });

  let nombreAppels = 0;
  globalThis.fetch = async () => {
    nombreAppels += 1;
    return Response.json({ id: "email_123" });
  };

  const reponse = await worker.fetch(
    creerRequete({ ...SOUMISSION_VALIDE, siteweb: "https://robot.example" }),
    ENV,
  );

  assert.deepEqual(await reponse.json(), { ok: true, accepted: false });
  assert.equal(nombreAppels, 0);
});

test("refuse une origine externe", async () => {
  const reponse = await worker.fetch(
    creerRequete(SOUMISSION_VALIDE, { origin: "https://spam.example" }),
    ENV,
  );

  assert.equal(reponse.status, 403);
});

test("accepte la requête CORS préliminaire du domaine configuré", async () => {
  const reponse = await worker.fetch(
    new Request("https://ensemblesb.workers.dev/api/soumission", {
      method: "OPTIONS",
      headers: {
        Origin: "https://www.espacesb.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    }),
    {
      ...ENV,
      FORM_ALLOWED_ORIGINS: "https://www.espacesb.com",
    },
  );

  assert.equal(reponse.status, 204);
  assert.equal(
    reponse.headers.get("Access-Control-Allow-Origin"),
    "https://www.espacesb.com",
  );
  assert.equal(
    reponse.headers.get("Access-Control-Allow-Methods"),
    "POST, OPTIONS",
  );
  assert.equal(
    reponse.headers.get("Access-Control-Allow-Headers"),
    "Content-Type",
  );
});

test("accepte Live Server vers Wrangler uniquement sur la boucle locale", async () => {
  const reponse = await worker.fetch(
    new Request("http://127.0.0.1:8787/api/soumission", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5500",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    }),
    ENV,
  );

  assert.equal(reponse.status, 204);
  assert.equal(
    reponse.headers.get("Access-Control-Allow-Origin"),
    "http://localhost:5500",
  );
});

test("refuse une requête directe sans origine", async () => {
  const reponse = await worker.fetch(
    new Request("https://espacesb.com/api/soumission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SOUMISSION_VALIDE),
    }),
    ENV,
  );

  assert.equal(reponse.status, 403);
});

test("refuse une valeur JSON qui n'est pas un objet", async () => {
  const reponse = await worker.fetch(
    new Request("https://espacesb.com/api/soumission", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://espacesb.com",
      },
      body: "null",
    }),
    ENV,
  );

  assert.equal(reponse.status, 400);
});

test("ne retourne aucune conversion lorsque Resend échoue", async (t) => {
  const fetchOriginal = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = fetchOriginal;
  });

  globalThis.fetch = async () =>
    Response.json({ message: "provider error" }, { status: 422 });

  const reponse = await worker.fetch(creerRequete(), ENV);
  const resultat = await reponse.json();

  assert.equal(reponse.status, 502);
  assert.deepEqual(resultat, {
    ok: false,
    error: "Impossible d'envoyer la demande pour le moment.",
  });
  assert.equal("conversionTarget" in resultat, false);
});
