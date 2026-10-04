#!/usr/bin/env node
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
