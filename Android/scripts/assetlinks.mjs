import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const packageName = "fr.techplanner.app";
const relation = "delegate_permission/common.handle_all_urls";
const defaultOutput = fileURLToPath(
  new URL("../../Frontend/public/.well-known/assetlinks.json", import.meta.url),
);

function normalizeFingerprint(value) {
  const fingerprint = value.trim().replaceAll(":", "").toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(fingerprint) || /^0+$/.test(fingerprint)) {
    throw new Error("Empreinte SHA-256 invalide : fournir les 32 octets du certificat de signature de l'APK.");
  }
  return fingerprint.match(/.{2}/g).join(":");
}

async function main() {
  const { values } = parseArgs({
    options: {
      sha256: { type: "string", multiple: true },
      output: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log('Usage : node Android/scripts/assetlinks.mjs --sha256 "EMPREINTE_DU_CERTIFICAT_APK" [--sha256 "AUTRE_EMPREINTE"] [--output fichier.json]');
    return;
  }
  if (!values.sha256?.length) {
    throw new Error("Empreinte manquante. Utiliser --sha256 avec le certificat de l'APK release, pas la cle debug.");
  }
  const fingerprints = values.sha256.map(normalizeFingerprint);
  const output = values.output ? resolve(values.output) : defaultOutput;
  let statements = [];
  try {
    statements = JSON.parse(await readFile(output, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (!Array.isArray(statements)) {
    throw new Error("Le fichier existant n'est pas un tableau JSON. Aucun remplacement effectue.");
  }
  const existing = statements.find(
    (statement) => statement?.target?.namespace === "android_app"
      && statement.target.package_name === packageName
      && statement.relation?.includes(relation),
  );
  if (existing) {
    if (!Array.isArray(existing.target.sha256_cert_fingerprints)) {
      throw new Error("La declaration Android existante ne contient pas une liste d'empreintes valide.");
    }
    existing.target.sha256_cert_fingerprints = [...new Set([
      ...existing.target.sha256_cert_fingerprints.map(normalizeFingerprint),
      ...fingerprints,
    ])];
  } else {
    statements.push({
      relation: [relation],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: [...new Set(fingerprints)],
      },
    });
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(statements, null, 2)}\n`, "utf8");
  console.log(`Association publique generee : ${output}`);
  console.log("Publier ce fichier sur https://techplanner.fr/.well-known/assetlinks.json avant de tester le plein ecran.");
}

main().catch((error) => {
  console.error(`Asset Links : ${error.message}`);
  process.exitCode = 1;
});
