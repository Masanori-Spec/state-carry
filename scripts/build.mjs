import { mkdir, rm, readFile, writeFile, copyFile } from "node:fs/promises";
const source = await readFile("src/core.mjs", "utf8");
const workerBody = (await readFile("web/worker.mjs", "utf8")).replace(
  /^import[^;]+;/,
  "",
);
await writeFile(
  "src/runtime-source.mjs",
  "// Generated from the tested engine; no user data.\nexport const CORE_SOURCE=" +
    JSON.stringify(source) +
    ";\nexport const WORKER_SOURCE=" +
    JSON.stringify(source + "\n" + workerBody) +
    ";\n",
);
await rm("dist", { recursive: true, force: true });
await mkdir("dist/src", { recursive: true });
for (const f of ["core.mjs", "example.mjs", "export.mjs", "runtime-source.mjs"])
  await copyFile("src/" + f, "dist/src/" + f);
for (const f of ["index.html", "styles.css"])
  await copyFile("web/" + f, "dist/" + f);
for (const f of ["app.mjs", "worker.mjs"])
  await writeFile(
    "dist/" + f,
    (await readFile("web/" + f, "utf8")).replace(
      /(["'])\.\.\/src\//g,
      "$1./src/",
    ),
  );
console.log("Built self-contained static site; subpath-safe assets.");
