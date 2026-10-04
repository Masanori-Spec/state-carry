// Independent review witnesses. These do not use production helpers as an oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,truncate} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {applyPatch,validateOps,validateEnvelope,validateProject,runProject,migrate,reviewContracts,parseJSON,pointer,LIMITS} from '../src/core.mjs';
import {moduleSource,fixtureSource,RUNNER_SOURCE,reportHTML} from '../src/export.mjs';

const copy=x=>JSON.parse(JSON.stringify(x));
const project=(input={},output=input,ops=[],contracts=[])=>({schema:'statecarry/v1',name:'Independent witness',versions:[1,2],transitions:[{from:1,to:2,ops}],fixtures:[{id:'literal',name:'Literal expected result',input:{version:1,payload:input},expected:{kind:'value',value:{version:2,payload:output}},contracts}]});
const account=r=>r.accounting.map(x=>[x.path,x.status]);

test('review: exhaustive small array move/copy destinations use post-removal length',()=>{
  for(let n=1;n<=7;n++)for(let from=0;from<n;from++) {
    const input=Array.from({length:n},(_,i)=>'id'+i), original=copy(input);
    for(let to=0;to<n;to++) {
      const rest=input.filter((_,i)=>i!==from);
      const expected=[...rest.slice(0,to),input[from],...rest.slice(to)];
      const r=applyPatch(input,[{op:'move',from:'/'+from,path:'/'+to}]);
      assert.equal(r.ok,true);assert.deepEqual(r.value,expected);assert.deepEqual(input,original);
    }
    assert.equal(applyPatch(input,[{op:'move',from:'/'+from,path:'/'+n}]).ok,false);
    for(let to=0;to<=n;to++) {
      const expected=[...input.slice(0,to),input[from],...input.slice(to)];
      assert.deepEqual(applyPatch(input,[{op:'copy',from:'/'+from,path:'/'+to}]).value,expected);
    }
  }
});
test('review: escape order, empty keys, Unicode identity and RFC extra members',()=>{
  const input={'~1':'tilde-one','/':'slash','':{'é':1,'e\u0301':2},'-':4};
  const r=applyPatch(input,[{op:'test',path:'/\u007e01',value:'tilde-one',ignored:{x:true}},{op:'test',path:'/\u007e1',value:'slash'},{op:'replace',path:'//é',value:9},{op:'test',path:'//e\u0301',value:2},{op:'replace',path:'/-',value:5}]);
  assert.equal(r.ok,true); assert.deepEqual(r.value,{'~1':'tilde-one','/':'slash','':{'é':9,'e\u0301':2},'-':5});
  for(const index of ['00','01','-1','+1','1.0','1e0',' 0'])assert.equal(applyPatch([7,8],[{op:'remove',path:'/'+index}]).ok,false);
  assert.throws(()=>pointer('/0\n')); assert.throws(()=>pointer('/~2')); assert.throws(()=>parseJSON('{"op":"add","\\u006fp":"remove"}'));
});
test('review: root moves, copies and prefix checks preserve atomic caller data',()=>{
  const input={a:{x:1},ab:2},before=copy(input);
  assert.deepEqual(applyPatch(input,[{op:'move',from:'/a',path:''}]).value,{x:1});
  assert.deepEqual(applyPatch(input,[{op:'copy',from:'',path:'/snapshot'},{op:'replace',path:'/snapshot/a/x',value:3}]).value,{a:{x:1},ab:2,snapshot:{a:{x:3},ab:2}});
  assert.deepEqual(applyPatch(input,[{op:'move',from:'/a',path:'/ab'}]).value,{ab:{x:1}});
  for(const ops of [[{op:'move',from:'/a',path:'/a/x'}],[{op:'move',from:'/a',path:'/missing/x'}],[{op:'move',from:'',path:'/a'}],[{op:'move',from:'/a',path:'/a'},{op:'test',path:'/ab',value:3}]]) {
    const r=applyPatch(input,ops);assert.equal(r.ok,false);assert.equal(Object.hasOwn(r,'value'),false);assert.deepEqual(input,before);
  }
  assert.equal(applyPatch(input,[{op:'move',from:'',path:''}]).ok,true);
});
test('review: overwritten destination leaves and empty containers require their own accounting',()=>{
  const p=project({source:7,destination:9,emptyObject:{},emptyArray:[]},{destination:7},[{op:'move',from:'/source',path:'/destination'},{op:'remove',path:'/emptyObject'},{op:'remove',path:'/emptyArray'}],[{kind:'preserve',source:'/source',target:'/destination',reason:''}]);
  let r=runProject(p).results[0];assert.equal(r.execution,'applied');assert.equal(r.expectation,'pass');assert.equal(r.ok,false);
  assert.deepEqual(account(r.contract),[['/source','preserved'],['/destination','unreviewed'],['/emptyObject','unreviewed'],['/emptyArray','unreviewed']]);
  p.fixtures[0].contracts.push({kind:'change',source:'/destination',target:'/destination',reason:'Explicit intentional replacement'},{kind:'drop',source:'/emptyObject',reason:'Remove obsolete container'},{kind:'drop',source:'/emptyArray',reason:'Remove obsolete container'});
  r=runProject(p).results[0];assert.equal(r.ok,true);assert.equal(r.migration.warnings.length,1);
});
test('review: same-path value equality is neither identity nor an inferred move',()=>{
  let r=reviewContracts({a:1,b:1},{a:1},[],{a:1});assert.deepEqual(account(r),[['/a','same-path-equal'],['/b','unreviewed']]);
  r=reviewContracts({a:[1,1]},{a:[1]},[{kind:'drop',source:'/a/0',reason:'Drop first position'}],{a:[1]});assert.equal(r.ok,false);assert.deepEqual(account(r),[['/a/0','contract-failed'],['/a/1','unreviewed']]);
  r=reviewContracts({},[],[],[]);assert.deepEqual(account(r),[['','unreviewed']]);
});
test('review: execution, independent expectation and declarations cannot substitute for one another',()=>{
  const p=project({x:1},{x:2},[{op:'replace',path:'/x',value:2}],[{kind:'change',source:'/x',target:'/x',reason:'Intentional'}]);
  assert.equal(runProject(p).ok,true); const independent=copy(p.fixtures);
  p.transitions[0].ops[0].value=3;let r=runProject(p).results[0];assert.equal(r.execution,'applied');assert.equal(r.expectation,'mismatch');assert.equal(r.contractStatus,'failed');assert.deepEqual(p.fixtures,independent);
  p.fixtures[0].expected={kind:'unasserted'};assert.equal(runProject(p).ok,false);
  p.transitions[0].ops.push({op:'test',path:'/x',value:0});p.fixtures[0].expected={kind:'error',code:'PATCH_FAILED'};r=runProject(p).results[0];assert.equal(r.ok,true);assert.equal(r.contractStatus,'not-run');assert.equal(Object.hasOwn(r.migration,'value'),false);
  p.fixtures[0].expected.code='UNKNOWN_VERSION';assert.equal(runProject(p).ok,false);
});
test('review: valid long generated leaf paths do not inherit external pointer input caps',()=>{
  let payload={leaf:1};for(let i=0;i<10;i++)payload={['/~'.repeat(64)]:payload};
  const p=project(payload);validateProject(p);const r=runProject(p);assert.equal(r.ok,true);assert.ok(r.results[0].contract.accounting[0].path.length>1024);
  assert.throws(()=>pointer(r.results[0].contract.accounting[0].path));
  p.transitions[0].ops=[{op:'replace',path:'',value:{}}];p.fixtures[0].expected.value.payload={};assert.equal(runProject(p).results[0].contract.accounting[0].status,'unreviewed');
});
test('review: direct envelope API rejects getters, hidden properties and custom prototypes without evaluation',()=>{
  let calls=0;
  const getter={payload:{}};Object.defineProperty(getter,'version',{enumerable:true,get(){calls++;return 1;}});
  const hidden={version:1,payload:{}};Object.defineProperty(hidden,'extra',{value:1});
  const symbol={version:1,payload:{}};symbol[Symbol('extra')]=1;
  const proto=Object.assign(Object.create({extra:1}),{version:1,payload:{}});
  for(const e of [getter,hidden,symbol,proto]){assert.throws(()=>validateEnvelope(e));assert.throws(()=>migrate(project(),e));}
  assert.equal(calls,0);
});
test('review: direct operation API validates array and operation descriptors before reading',()=>{
  let calls=0;
  const op={path:'/x',value:1};Object.defineProperty(op,'op',{enumerable:true,get(){calls++;return 'add';}});
  const array=[];Object.defineProperty(array,'0',{enumerable:true,get(){calls++;return {op:'add',path:'/x',value:1};}});
  for(const ops of [[op],array]){assert.throws(()=>validateOps(ops));assert.throws(()=>applyPatch({},ops));}assert.equal(calls,0);
});
test('review: generated module and runner execute literal witnesses and reject bounded invalid files',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'statecarry-review-'));
  try {
    const p=project({old:{x:7},gone:[]},{new:{x:7}},[{op:'move',from:'/old',path:'/new'},{op:'remove',path:'/gone'}],[{kind:'preserve',source:'/old',target:'/new',reason:''},{kind:'drop',source:'/gone',reason:'Obsolete'}]);
    await writeFile(join(dir,'statecarry-migration.mjs'),moduleSource(p,await readFile('src/core.mjs','utf8')));await writeFile(join(dir,'statecarry-run.mjs'),RUNNER_SOURCE);await writeFile(join(dir,'statecarry-fixtures.json'),fixtureSource(p));
    const engine=await import(pathToFileURL(join(dir,'statecarry-migration.mjs')));assert.equal(Object.isFrozen(engine.PLAN.transitions[0].ops[0]),true);
    for(const payload of [{old:{x:7},gone:[]},{old:null,gone:[]},{gone:[]},{old:{x:'</script><img src=x>'},gone:[1]}]) {
      const input={version:1,payload},before=copy(input);assert.deepEqual(engine.migrateSaved(input),migrate(p,input));assert.deepEqual(input,before);
    }
    const run=(name='statecarry-fixtures.json')=>spawnSync(process.execPath,['statecarry-run.mjs',name],{cwd:dir,encoding:'utf8',timeout:2000,maxBuffer:8*1024*1024});
    let r=run();assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),runProject(p));
    await writeFile(join(dir,'oversized.json'),'');await truncate(join(dir,'oversized.json'),LIMITS.projectBytes+1);assert.equal(run('oversized.json').status,2);
    // Simulate a file growing after stat: the descriptor read still stops at cap+1.
    await writeFile(join(dir,'audit-read.mjs'),`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const open=fs.promises.open;let bytes=0;fs.promises.open=async(...args)=>{const h=await open(...args),read=h.read.bind(h);h.stat=async()=>({isFile:()=>true,size:0});h.read=async(buffer,offset,length,position)=>{if(length>4194305-bytes)throw Error('UNBOUNDED_READ');const r=await read(buffer,offset,length,position);bytes+=r.bytesRead;return r;};return h;};syncBuiltinESMExports();process.on('exit',()=>console.error('AUDIT_BYTES='+bytes));`);
    r=spawnSync(process.execPath,['--import','./audit-read.mjs','statecarry-run.mjs','oversized.json'],{cwd:dir,encoding:'utf8',timeout:2000});assert.equal(r.status,2);assert.ok(r.stderr.includes('AUDIT_BYTES='+String(LIMITS.projectBytes+1)),r.stderr);assert.equal(r.stderr.includes('UNBOUNDED_READ'),false);
    await writeFile(join(dir,'malformed.json'),Buffer.from([0xff]));assert.equal(run('malformed.json').status,2);
    assert.equal(run('.').status,2);
    if(process.platform!=='win32') { assert.equal(spawnSync('mkfifo',[join(dir,'pipe')]).status,0);r=run('pipe');assert.equal(r.status,2,'FIFO must reject promptly: '+JSON.stringify(r.error)); }
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('review: escaped report preserves hostile values as inert text',()=>{
  const hostile='</pre><script>alert("x")</script><img src="https://example.invalid/">&\u2028日本語';const p=project({data:hostile});p.name='</h1><img src=x>';
  const html=reportHTML(p);assert.equal(html.includes('<script>'),false);assert.equal(html.includes('<img src='),false);assert.ok(html.includes('&lt;/pre&gt;'));assert.ok(html.includes('日本語'));assert.ok(html.includes("default-src 'none'"));
});

// Minimal independent DOM double for actual application event handlers. It has
// no layout, HTML parser, accessibility tree or browser task-queue semantics.
async function uiHarness() {
  const html=await readFile('web/index.html','utf8'), nodes=new Map(), downloads=[],workers=[],timers=new Map();let tick=0;
  class Node {
    constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.value='';this.textContent='';this.disabled=false;this.hidden=false;this.open=false;this.attributes={};}
    append(...xs){this.children.push(...xs);}
    replaceChildren(...xs){this.children=[...xs];}
    setAttribute(k,v){this.attributes[k]=v;}
    focus(){}
    remove(){}
    click(){downloads.push(this);}
    showModal(){this.open=true;}
    close(){this.open=false;}
  }
  for(const [,tag,id]of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"/g))nodes.set(id,new Node(tag));
  const form=nodes.get('operation-form');form.elements={op:new Node(),path:new Node(),from:new Node(),value:new Node()};form.elements.op.value='move';form.elements.value.value='null';
  nodes.get('contract-form').elements={kind:new Node(),source:new Node(),target:new Node(),reason:new Node()};nodes.get('contract-form').elements.kind.value='preserve';
  const tabs=new Node(),document={getElementById:id=>nodes.get(id),createElement:tag=>new Node(tag),querySelectorAll:()=>[],querySelector:()=>tabs,documentElement:new Node('html'),body:new Node('body')};
  class Worker {constructor(){workers.push(this);}postMessage(p){this.project=copy(p);}terminate(){this.stopped=true;}reply(data={ok:true,report:runProject(this.project)}){this.onmessage({data});}}
  const originals={document:globalThis.document,Worker:globalThis.Worker,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
  Object.assign(globalThis,{document,Worker,setTimeout:(fn,ms)=>{const id=++tick;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
  await import('../web/app.mjs?review='+Math.random());
  const $=id=>nodes.get(id),click=id=>$(id).onclick({preventDefault(){}}),input=(id,value)=>{$(id).value=value;$(id).oninput?.();};
  return {$,click,input,workers,timers,downloads,load(p){click('open-import');input('import-json',JSON.stringify(p));click('apply-import');assert.equal($('import-dialog').open,false,$('import-error').textContent);},cleanup(){click('cancel-run');Object.assign(globalThis,originals);}};
}
test('review: actual handlers retain valid selections after rejected version/fixture additions',async()=>{
  const ui=await uiHarness();
  try {
    const p=project();p.versions=Array.from({length:16},(_,i)=>i+1);p.transitions=p.versions.slice(1).map(v=>({from:v-1,to:v,ops:[]}));p.fixtures=Array.from({length:50},(_,i)=>({...copy(p.fixtures[0]),id:'f'+i}));
    ui.load(p);const before=ui.$('patch-json').value;ui.click('add-version');assert.equal(ui.$('status').className,'error');ui.input('patch-json',before);ui.click('apply-patch');assert.notEqual(ui.$('status').className,'error',ui.$('status').textContent);
    ui.click('add-fixture');assert.equal(ui.$('status').className,'error');ui.input('fixture-name','Still selected');ui.click('apply-fixture');assert.notEqual(ui.$('status').className,'error',ui.$('status').textContent);assert.equal(ui.$('fixture-name').value,'Still selected');
  } finally {ui.cleanup();}
});
test('review: actual handlers reject late completion after cancellation and plan edit',async()=>{
  const ui=await uiHarness();
  try {const old=ui.workers.at(-1);ui.click('cancel-run');old.reply();assert.equal(ui.$('export-module').disabled,true);
    ui.click('run');const pending=ui.workers.at(-1);ui.input('patch-json','[]');pending.reply();assert.equal(ui.$('export-module').disabled,true);assert.ok(ui.$('freshness').textContent.includes('未検証'));ui.click('cancel-patch');ui.click('run');ui.workers.at(-1).reply();assert.equal(ui.$('export-module').disabled,false);ui.click('run');assert.equal(ui.$('metrics').children[2].children[1].textContent,'—');
  } finally {ui.cleanup();}
});
test('review: actual handlers retain stale state after timeout or structured worker failure',async()=>{
  const ui=await uiHarness();
  try {const old=ui.workers.at(-1);const timer=[...ui.timers.values()].find(t=>t.ms===6000);timer.fn();assert.equal(ui.$('export-module').disabled,true);old.reply();assert.equal(ui.$('export-module').disabled,true,'Late callback after timeout must stay stale');
    ui.click('run');ui.workers.at(-1).reply({ok:false,error:'synthetic bounded failure'});assert.equal(ui.$('run').disabled,false);assert.equal(ui.$('export-module').disabled,true);assert.ok(!ui.$('freshness').textContent.includes('検証中'),'Structured error must not leave VERIFYING status');
  } finally {ui.cleanup();}
});
test('review: array subclasses cannot run serialization hooks or silently change payloads',()=>{
  let calls=0;class Impostor extends Array{toJSON(){calls++;return ['changed'];}}
  const payload=new Impostor();payload.push('original');assert.throws(()=>validateEnvelope({version:1,payload}));assert.throws(()=>migrate(project(),{version:1,payload}));assert.equal(calls,0);
  const ops=new Impostor();ops.push({op:'add',path:'/x',value:1});assert.throws(()=>validateOps(ops));assert.equal(calls,0);
});
test('review: accounting amplification rejects honestly without a partial passing report',()=>{
  let payload=Object.fromEntries(Array.from({length:2000},(_,i)=>['n'+i,i]));
  for(let i=0;i<19;i++)payload={['/~'.repeat(64)]:payload};
  const p=project(payload),before=JSON.stringify(p);validateProject(p);
  assert.throws(()=>runProject(p),e=>e.code==='RESOURCE_LIMIT');assert.equal(JSON.stringify(p),before);
  let smaller=Object.fromEntries(Array.from({length:1000},(_,i)=>['n'+i,i]));for(let i=0;i<19;i++)smaller={['/~'.repeat(64)]:smaller};
  const q=project(smaller);assert.equal(runProject(q).ok,true);try{assert.ok(Buffer.byteLength(reportHTML(q))<=16777216);}catch(e){assert.equal(e.code,'RESOURCE_LIMIT');}q.fixtures.push({...copy(q.fixtures[0]),id:'second'});assert.throws(()=>runProject(q),e=>e.code==='RESOURCE_LIMIT');
});
test('review: nonempty container shape remains a full-expectation responsibility',()=>{
  const p=project({a:{'0':7}},{a:[7]},[{op:'replace',path:'/a',value:[7]}]);
  const r=runProject(p).results[0];assert.equal(r.ok,true);assert.deepEqual(account(r.contract),[['/a/0','same-path-equal']]);
  p.fixtures[0].expected.value.payload={a:{'0':7}};assert.equal(runProject(p).results[0].expectation,'mismatch');
});
test('review: HTML pre-render limit accounts for both escaping and deep indentation',()=>{
  let value=Array.from({length:19000},()=> '&'.repeat(18));for(let i=0;i<19;i++)value={a:value};
  const p=project();p.fixtures=[];p.transitions[0].ops=Array.from({length:6},()=>({op:'add',path:'/x',value}));validateProject(p);
  assert.throws(()=>reportHTML(p),e=>e.code==='RESOURCE_LIMIT');
});
test('review: emitted worker bundle executes independently with source-engine parity',async()=>{
  const {Worker}=await import('node:worker_threads');
  const {WORKER_SOURCE}=await import('../src/runtime-source.mjs');
  const p=project({old:7},{new:7},[{op:'move',from:'/old',path:'/new'}],[{kind:'preserve',source:'/old',target:'/new',reason:''}]);
  p.fixtures.push({...copy(p.fixtures[0]),id:'failure',input:{version:1,payload:{}},expected:{kind:'error',code:'PATCH_FAILED'}});
  const bundledURL='data:text/javascript;base64,'+Buffer.from(WORKER_SOURCE).toString('base64');
  const entry=`import {parentPort,workerData} from 'node:worker_threads';globalThis.self={postMessage:value=>parentPort.postMessage(value)};await import(${JSON.stringify(bundledURL)});self.onmessage({data:workerData});`;
  const worker=new Worker(new URL('data:text/javascript;base64,'+Buffer.from(entry).toString('base64')),{workerData:p});
  try {const r=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('worker timeout')),3000);worker.once('message',data=>{clearTimeout(timeout);resolve(data);});worker.once('error',error=>{clearTimeout(timeout);reject(error);});});assert.deepEqual(r,{ok:true,report:runProject(p)});}finally{await worker.terminate();}
});
