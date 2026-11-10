// Run after editing cat-model.js. Keeps the no-JavaScript cat identical to the animated model.
import { readFileSync, writeFileSync } from "node:fs";
import { catSvg } from "../public/ai-code/motion/cat-model.js";
const file = new URL("../public/ai-code/index.html", import.meta.url);
let html = readFileSync(file, "utf8");
html = html.replace(
  /(<div id="cat" aria-hidden="true">)[\s\S]*?(<\/div>)/,
  `$1${catSvg()}$2`,
);
writeFileSync(file, html);
