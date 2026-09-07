const fs = require('fs');
const path = require('path');

const translationsDir = path.join(__dirname, '..', 'src', 'i18n', 'translations');

const ejectDescUpdates = {
  pt: "Sem vendor lock-in absoluto. A qualquer momento, gere e faça download do código fonte completo no backend da sua escolha: Next.js (Node.js) ou Next.js + Spring Boot 3.x (Java 21).",
  en: "Zero vendor lock-in. At any time, generate and download complete source code in the backend of your choice: Next.js (Node.js) or Next.js + Spring Boot 3.x (Java 21).",
  es: "Cero bloqueo de proveedor. En cualquier momento, genera y descarga el código fuente completo en el backend de tu elección: Next.js (Node.js) o Next.js + Spring Boot 3.x (Java 21)."
};

for (const lang of ['pt', 'en', 'es']) {
  const filePath = path.join(translationsDir, `${lang}.json`);
  const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  if (json.marketing_v2 && json.marketing_v2.features && json.marketing_v2.features.ide) {
    json.marketing_v2.features.ide.eject_desc = ejectDescUpdates[lang];
  }

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf-8');
  console.log(`Updated ide.eject_desc in ${lang}.json`);
}
