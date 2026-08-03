const burger = document.getElementById("burger");
const navLinks = document.getElementById("nav-links");
const formulaire = document.getElementById("form-soumission");
const message = document.getElementById("form-message");
const bouton = formulaire?.querySelector(".form-submit");
const texteBouton = bouton?.querySelector(".form-submit-texte");
const chargementBouton = bouton?.querySelector(".form-submit-chargement");
const champSubmissionId = document.getElementById("submission-id");

burger?.addEventListener("click", () => {
  const menuOuvert = navLinks.classList.toggle("open");
  burger.setAttribute("aria-expanded", String(menuOuvert));
});

document.querySelectorAll(".nav-dropdown-toggle").forEach((toggle) => {
  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    const parent = toggle.closest(".nav-dropdown");
    const isOpen = parent.classList.contains("open");
    document.querySelectorAll(".nav-dropdown.open").forEach((d) => d.classList.remove("open"));
    if (!isOpen) parent.classList.add("open");
  });
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".nav-dropdown")) {
    document.querySelectorAll(".nav-dropdown.open").forEach((d) => d.classList.remove("open"));
  }
});

if (formulaire) {
  renouvelerSubmissionId();

  formulaire.querySelectorAll("input, select, textarea").forEach((champ) => {
    champ.addEventListener("input", () => champ.removeAttribute("aria-invalid"));
    champ.addEventListener("change", () => champ.removeAttribute("aria-invalid"));
    champ.addEventListener("invalid", () => champ.setAttribute("aria-invalid", "true"));
  });

  formulaire.addEventListener("submit", envoyerSoumission);
}

async function envoyerSoumission(event) {
  event.preventDefault();
  masquerMessage();

  if (!formulaire.checkValidity()) {
    formulaire.reportValidity();
    formulaire.querySelector(":invalid")?.focus();
    return;
  }

  definirChargement(true);

  const donnees = Object.fromEntries(new FormData(formulaire).entries());

  try {
    const reponse = await fetch(resoudreUrlSoumission(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(donnees),
    });

    const resultat = await lireJson(reponse);

    if (!reponse.ok || !resultat.ok) {
      throw new Error(
        resultat.error || "La demande n’a pas pu être envoyée. Veuillez réessayer.",
      );
    }

    afficherMessage(
      "Votre demande a bien été envoyée. Notre équipe vous contactera dans les 24 heures.",
      "succes",
    );

    if (resultat.accepted) {
      declarerConversion(resultat.conversionTarget, resultat.submissionId);
    }

    formulaire.reset();
    renouvelerSubmissionId();
  } catch (erreur) {
    afficherMessage(
      obtenirMessageErreur(erreur),
      "erreur",
    );
  } finally {
    definirChargement(false);
  }
}

function resoudreUrlSoumission() {
  if (window.location.protocol === "file:") {
    throw new Error(
      "Le formulaire doit être ouvert avec un serveur local. Lancez « npx wrangler dev » puis ouvrez l’adresse affichée.",
    );
  }

  if (
    estHoteLocal(window.location.hostname) &&
    window.location.port !== "8787"
  ) {
    return formulaire.dataset.localApiUrl;
  }

  return formulaire.action;
}

function estHoteLocal(hote) {
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hote);
}

function obtenirMessageErreur(erreur) {
  if (erreur instanceof TypeError) {
    if (estHoteLocal(window.location.hostname)) {
      return "Le serveur local du formulaire est inaccessible. Lancez « npx wrangler dev » dans le projet, puis réessayez.";
    }

    return "Impossible de joindre le service de soumission. Réessayez ou appelez-nous au 514-779-8590.";
  }

  return (
    erreur.message ||
    "La demande n’a pas pu être envoyée. Réessayez ou appelez-nous au 514-779-8590."
  );
}

async function lireJson(reponse) {
  try {
    return await reponse.json();
  } catch {
    return {
      ok: false,
      error:
        "La demande n’a pas pu être envoyée. Réessayez ou appelez-nous au 514-779-8590.",
    };
  }
}

function definirChargement(estEnCours) {
  bouton.disabled = estEnCours;
  formulaire.setAttribute("aria-busy", String(estEnCours));
  texteBouton.hidden = estEnCours;
  chargementBouton.hidden = !estEnCours;
}

function afficherMessage(texte, type) {
  message.textContent = texte;
  message.className = `form-message form-message-${type}`;
  message.hidden = false;
  message.focus({ preventScroll: true });
}

function masquerMessage() {
  message.hidden = true;
  message.textContent = "";
  message.className = "form-message";
}

function renouvelerSubmissionId() {
  if (champSubmissionId) {
    champSubmissionId.value =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : creerUuid();
  }
}

function creerUuid() {
  const octets = crypto.getRandomValues(new Uint8Array(16));
  octets[6] = (octets[6] & 0x0f) | 0x40;
  octets[8] = (octets[8] & 0x3f) | 0x80;
  const hexadecimal = Array.from(octets, (octet) =>
    octet.toString(16).padStart(2, "0"),
  ).join("");

  return [
    hexadecimal.slice(0, 8),
    hexadecimal.slice(8, 12),
    hexadecimal.slice(12, 16),
    hexadecimal.slice(16, 20),
    hexadecimal.slice(20),
  ].join("-");
}

function declarerConversion(cible, submissionId) {
  if (
    typeof window.gtag !== "function" ||
    !/^AW-\d+\/[A-Za-z0-9_-]+$/.test(cible || "")
  ) {
    return;
  }

  window.gtag("event", "conversion", {
    send_to: cible,
    value: 1.0,
    currency: "CAD",
    transaction_id: submissionId,
  });
}
