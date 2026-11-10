// Lists translation keys that exist in English but are missing in another language.
// Run: npm run check-translations
import fs from "node:fs";
const en = JSON.parse(fs.readFileSync("messages/en.json", "utf8"));
function keys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}
const enKeys = keys(en);
let missing = 0;
for (const file of fs.readdirSync("messages")) {
  if (file === "en.json" || !file.endsWith(".json")) continue;
  const other = new Set(keys(JSON.parse(fs.readFileSync(`messages/${file}`, "utf8"))));
  const gaps = enKeys.filter((k) => !other.has(k));
  missing += gaps.length;
  console.log(`${file}: ${gaps.length ? gaps.length + " missing (English will be shown):\n  " + gaps.join("\n  ") : "complete ✓"}`);
}
process.exitCode = missing ? 1 : 0;
