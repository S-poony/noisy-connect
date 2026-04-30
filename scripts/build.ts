import { join } from "path";
import { existsSync, mkdirSync, copyFileSync, readdirSync, lstatSync, rmSync, readFileSync, writeFileSync } from "fs";

const dist = join(process.cwd(), "dist");

// 0. Clear dist
console.log("Cleaning dist...");
if (existsSync(dist)) {
  rmSync(dist, { recursive: true, force: true });
}
mkdirSync(dist);

// 1. Build the JS
console.log("Building JS...");
const result = await Bun.build({
  entrypoints: ["src/main.ts"],
  outdir: "dist",
  minify: true,
});

if (!result.success) {
  console.error("Build failed:", result.logs);
  process.exit(1);
}

// 2. Copy and Patch index.html
console.log("Copying and patching index.html...");
let indexHtml = readFileSync("index.html", "utf-8");
// Change <script ... src="./dist/main.js"></script> to <script ... src="./main.js"></script>
indexHtml = indexHtml.replace('./dist/main.js', './main.js');
writeFileSync(join(dist, "index.html"), indexHtml);

// 3. Copy src/style.css (preserving structure)
console.log("Copying style.css...");
const distSrc = join(dist, "src");
if (!existsSync(distSrc)) mkdirSync(distSrc);
copyFileSync(join("src", "style.css"), join(distSrc, "style.css"));

// 4. Copy public/ directory
console.log("Copying public/...");
function copyRecursiveSync(src: string, dest: string) {
  if (!existsSync(src)) return;

  const stats = lstatSync(src);
  if (stats.isDirectory()) {
    if (!existsSync(dest)) mkdirSync(dest);
    readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(join(src, childItemName), join(dest, childItemName));
    });
  } else {
    copyFileSync(src, dest);
  }
}

if (existsSync("public")) {
  copyRecursiveSync("public", join(dist, "public"));
}

console.log("Build complete! Production assets are in the 'dist' directory.");
