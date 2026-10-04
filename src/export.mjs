import {
  validateProject,
  runProject,
  clone,
  LIMITS,
  StateError,
} from "./core.mjs";
export function moduleSource(project, coreSource) {
  validateProject(project);
  const plan = {
    schema: project.schema,
    name: project.name,
    versions: clone(project.versions),
    transitions: clone(project.transitions),
    fixtures: [],
  };
  return (
    "// StateCarry reviewable migration artifact. Pure; no storage/network access.\n" +
    coreSource +
    "\nexport const PLAN = " +
    JSON.stringify(plan)
      .replaceAll("\u2028", "\\u2028")
      .replaceAll("\u2029", "\\u2029") +
    ";\nvalidateProject(PLAN);\nfunction freezePlan(value) { if(value && typeof value === 'object') { Object.values(value).forEach(freezePlan); Object.freeze(value); } }\nfreezePlan(PLAN);\nexport function migrateSaved(envelope) { return migrate(PLAN, envelope); }\n"
  );
}
export function fixtureSource(project) {
  validateProject(project);
  const data = {
    schema: "statecarry-fixtures/v1",
    name: project.name,
    fixtures: project.fixtures,
  };
  const pretty = JSON.stringify(data, null, 2);
  return new TextEncoder().encode(pretty).length <= 4194304
    ? pretty
    : JSON.stringify(data);
}
export const RUNNER_SOURCE = `#!/usr/bin/env node
import {open,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {PLAN,parseJSON,validateProject,runProject} from './statecarry-migration.mjs';
try {
 const file=process.argv[2]??'statecarry-fixtures.json';
 const limit=4194304;
 const initial=await lstat(file);
 if(!initial.isFile()) throw Error('Fixture input must be a regular file (no symlink or pipe)');
 const handle=await open(file,constants.O_RDONLY | (constants.O_NONBLOCK??0) | (constants.O_NOFOLLOW??0));
 let bytes;
 try {
  const stat=await handle.stat();
  if(!stat.isFile()) throw Error('Fixture input must be a regular file');
  if(stat.size>limit) throw Error('Fixture file exceeds 4 MiB');
  const buffer=Buffer.alloc(limit+1);let total=0;
  while(total<buffer.length){const {bytesRead}=await handle.read(buffer,total,buffer.length-total,null);if(!bytesRead)break;total+=bytesRead;}
  if(total>limit) throw Error('Fixture file exceeds 4 MiB');
  bytes=buffer.subarray(0,total);
 } finally {await handle.close();}
 const data=parseJSON(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));
 if(data.schema!=='statecarry-fixtures/v1'||Object.keys(data).sort().join(',')!=='fixtures,name,schema')throw Error('Invalid fixture schema');
 const project={...PLAN,name:data.name,fixtures:data.fixtures}; validateProject(project);
 const report=runProject(project); console.log(JSON.stringify(report,null,2));process.exitCode=report.ok?0:1;
} catch(error) {console.error(JSON.stringify({ok:false,code:error.code??'RUNNER_ERROR',error:error.message}));process.exitCode=2;}
`;
const h = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// Keep short blocks intact in print; let long blocks paginate. Count likely
// wrapped rows conservatively, including wide characters and long single lines.
// This is a layout hint, not a measured font-size or page-fit guarantee.
export function printBlockClass(text, columns = 88) {
  let rows = 1,
    width = 0;
  for (const char of text) {
    if (char === "\n") {
      rows++;
      width = 0;
    } else {
      width += char === "\t" ? 4 : char.codePointAt(0) > 255 ? 2 : 1;
      if (width > columns) {
        rows += Math.floor((width - 1) / columns);
        width = ((width - 1) % columns) + 1;
      }
    }
    if (rows > 32) return "print-flow";
  }
  return "print-keep";
}
export function reportHTML(project, r = runProject(project)) {
  const parts = [];
  let remaining = LIMITS.htmlEstimateBytes;
  function append(html) {
    const bytes = new TextEncoder().encode(html).length;
    if (bytes > remaining)
      throw new StateError(
        "RESOURCE_LIMIT",
        "HTML report exceeds 16 MiB; no partial report returned",
      );
    remaining -= bytes;
    parts.push(html);
  }
  function jsonBlock(value) {
    // Pretty-print whitespace and escaping are charged exactly as emitted.
    // Escape bounded slices rather than materializing an expanded whole block.
    const formatted = JSON.stringify(value, null, 2);
    append(`<pre class="${printBlockClass(formatted)}">`);
    for (let index = 0; index < formatted.length; index += 2048)
      append(h(formatted.slice(index, index + 2048)));
    append("</pre>");
  }
  append(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>StateCarry · ${h(project.name)}</title><style>body{font:14px system-ui;max-width:1100px;margin:40px auto;padding:0 20px;color:#283a35;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed}td,th{padding:8px;border:1px solid #c7d3c5;text-align:left;overflow-wrap:anywhere}th{background:#e9eee4}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f3ea;padding:15px;font-size:11px}.note{padding:15px;background:#fff2d4}h2{margin-top:35px}@page{size:A4;margin:16mm 14mm}@media print{body{margin:0;padding:0;font-size:11px}h1,h2,h3,h4{break-inside:avoid;break-after:avoid}p{orphans:3;widows:3}tr{break-inside:avoid}pre{font:10px/1.45 ui-monospace,monospace;break-inside:auto;orphans:3;widows:3}pre.print-keep{break-inside:avoid}}</style><body><small>STATECARRY / PRESERVATION REVIEW · statecarry/v1</small><h1>${h(project.name)}</h1><p>${r.ok ? "Contract and expected results passed for these fixtures" : "Review required"} · ${r.summary.passed}/${r.summary.fixtures} fixtures passed · ${r.summary.overwrites} overwrite warnings</p><p class="note">A passed fixture does not prove that all saved user data can survive. Expected values and intent declarations are independently authored. Equal values at the same path are observations, not identity or move inference. Empty containers count as original leaves. No storage, network or automatic user-file migration occurs.</p><h2>Version chain</h2><p>${project.versions.join(" → ")}</p>`,
  );
  for (const step of project.transitions) {
    append(`<h3>${step.from} → ${step.to}</h3>`);
    jsonBlock(step.ops);
  }
  for (const [index, result] of r.results.entries()) {
    append(
      `<h2>${h(result.name)}</h2><p>Execution: ${h(result.execution)} / Expected: ${h(result.expectation)} / Preservation: ${h(result.contractStatus)}</p>`,
    );
    if (result.migration.error)
      append(
        `<p>${h(result.migration.error.code)}: ${h(result.migration.error.message)}</p>`,
      );
    append("<h3>Overwrite warnings</h3>");
    jsonBlock(result.migration.warnings);
    append("<h3>Original envelope</h3>");
    jsonBlock(project.fixtures[index].input);
    append("<h3>Actual result</h3>");
    jsonBlock(
      result.migration.ok ? result.migration.value : result.migration.error,
    );
    append("<h3>Independent expectation</h3>");
    jsonBlock(project.fixtures[index].expected);
    append("<h3>Preservation / intent declarations</h3>");
    jsonBlock(result.contract?.checks ?? []);
    append(
      "<h3>Original-leaf accounting</h3><table><tr><th>Original path</th><th>Original value</th><th>Observed / declared status</th></tr>",
    );
    for (const leaf of result.contract?.accounting ?? [])
      append(
        `<tr><td>${h(leaf.path || "(root)")}</td><td>${h(JSON.stringify(leaf.value))}</td><td>${h(leaf.status)}${leaf.contractSource !== undefined ? " · " + h(leaf.contractSource || "(root)") : ""}</td></tr>`,
      );
    append("</table>");
  }
  append(
    "<h2>Interpretation limits</h2><p>Preserve compares an explicitly named old subtree to a new subtree. Change requires a reason and a target matching the independently expected output. Drop requires a reason and absence of the original path after migration. Array paths describe positions, not entity identities. Unreviewed original leaves block contract success. Extra output fields and nonempty container shape are checked through the whole expected output.</p></body></html>",
  );
  return parts.join("");
}
