// Validates the assets/ folder with the same importer the app uses.
//   npm run assets:check            -> report, exit 1 on errors
//   npm run assets:check -- --strict -> also exit 1 on warnings
//   npm run assets:check -- --list   -> print every group and item
// Runs automatically before `npm run build`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const src = fs.readFileSync(path.join(root, "src/lib/assets/importer.ts"), "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
}).outputText;
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mf-assets-")), "importer.mjs");
fs.writeFileSync(tmp, js);
const { importAssets } = await import(pathToFileURL(tmp).href);
fs.rmSync(path.dirname(tmp), { recursive: true, force: true });

const args = process.argv.slice(2);
const dir = path.resolve(process.env.ASSETS_DIR || path.join(root, "assets"));
const reg = importAssets(dir);

for (const g of reg.groups) {
  const flags = [g.access, `order ${g.order}`, g.hidden ? "hidden" : ""].filter(Boolean).join(", ");
  console.log(`${g.id.padEnd(20)} ${String(g.assets.length).padStart(4)} assets ${String(g.patterns.length).padStart(3)} textures  (${flags})  ${g.name.en}`);
  if (args.includes("--list")) {
    for (const a of g.assets) console.log(`    ${a.id.padEnd(28)} ${a.category.padEnd(12)} ${a.cells.join("x").padEnd(8)} ${a.layer.padEnd(8)} ${a.name.en}${a.hidden ? " (hidden)" : ""}`);
    for (const p of g.patterns) console.log(`    ${p.id.padEnd(28)} texture      ${p.name.en}${p.hidden ? " (hidden)" : ""}`);
  }
}
const errors = reg.issues.filter((i) => i.level === "error");
const warnings = reg.issues.filter((i) => i.level === "warning");
for (const i of reg.issues) console.log(`${i.level === "error" ? "ERROR  " : "warning"} ${i.file}: ${i.message}`);
console.log(`\n${reg.assetsById.size} assets, ${reg.patternsById.size} textures in ${reg.groups.length} groups · ${errors.length} errors, ${warnings.length} warnings · version ${reg.version}`);
if (errors.length || (args.includes("--strict") && warnings.length)) process.exit(1);
