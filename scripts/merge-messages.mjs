// Dev helper: merges a JSON fragment into messages/<locale>.json  (node scripts/merge-messages.mjs en fragment.json)
import fs from "node:fs";
const [locale, fragmentPath] = process.argv.slice(2);
const file = `messages/${locale}.json`;
const base = JSON.parse(fs.readFileSync(file, "utf8"));
const frag = JSON.parse(fs.readFileSync(fragmentPath, "utf8"));
const merge = (a, b) => {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object") merge(a[k], v);
    else a[k] = v;
  }
  return a;
};
fs.writeFileSync(file, JSON.stringify(merge(base, frag), null, 2) + "\n");
console.log(`merged into ${file}`);
