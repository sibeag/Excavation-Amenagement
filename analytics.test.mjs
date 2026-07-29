import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./js/analytics.js", import.meta.url), "utf8");
const CIBLE_TELEPHONE = "AW-18139948408/PhoneLabel_123";

function preparerSuivi(cible = "") {
  let gestionnaire;
  const evenements = [];
  const delais = [];
  const window = {
    location: { href: "https://www.espacesb.com/" },
    gtag: (...args) => evenements.push(args),
    setTimeout: (callback, delai) => delais.push({ callback, delai }),
  };
  const document = {
    addEventListener: (type, callback) => {
      if (type === "click") gestionnaire = callback;
    },
  };
  const script = source.replace(
    /const PHONE_CONVERSION_TARGET = "[^"]*";/,
    `const PHONE_CONVERSION_TARGET = "${cible}";`,
  );

  vm.runInNewContext(script, { document, window });

  return { gestionnaire, evenements, delais, window };
}

function creerClic() {
  let navigationBloquee = false;
  const lien = {
    href: "tel:+15147798590",
    dataset: { phoneLocation: "navigation" },
  };

  return {
    event: {
      target: { closest: () => lien },
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => {
        navigationBloquee = true;
      },
    },
    navigationBloquee: () => navigationBloquee,
  };
}

test("laisse le lien téléphonique fonctionner si la cible Google manque", () => {
  const suivi = preparerSuivi();
  const clic = creerClic();

  suivi.gestionnaire(clic.event);

  assert.equal(clic.navigationBloquee(), false);
  assert.equal(suivi.evenements.length, 0);
});

test("déclare la conversion avant d'ouvrir le composeur téléphonique", () => {
  const suivi = preparerSuivi(CIBLE_TELEPHONE);
  const clic = creerClic();

  suivi.gestionnaire(clic.event);

  assert.equal(clic.navigationBloquee(), true);
  assert.equal(suivi.evenements.length, 1);
  assert.equal(suivi.evenements[0][0], "event");
  assert.equal(suivi.evenements[0][1], "conversion");
  assert.equal(suivi.evenements[0][2].send_to, CIBLE_TELEPHONE);
  assert.equal(suivi.evenements[0][2].phone_location, "navigation");
  assert.equal(suivi.delais[0].delai, 900);

  suivi.evenements[0][2].event_callback();
  assert.equal(suivi.window.location.href, "tel:+15147798590");

  suivi.delais[0].callback();
  assert.equal(suivi.window.location.href, "tel:+15147798590");
});
