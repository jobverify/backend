import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {isBuiltin, registerHooks, syncBuiltinESMExports} from 'node:module'
import childProcess from 'node:child_process'
import workerThreads from 'node:worker_threads'
import http from 'node:http'
import https from 'node:https'
import http2 from 'node:http2'
import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns'
import dgram from 'node:dgram'

// Preparation only. Importing this file is source execution and requires root GO.
assert.ok(process.permission, 'Node permission mode is required')
export const RealResponse=globalThis.Response,RealReadableStream=globalThis.ReadableStream
const directory=path.dirname(fileURLToPath(import.meta.url))
const originalRead=fs.readFileSync.bind(fs)
export const hash=value=>createHash('sha256').update(value).digest('hex')
export const manifest=JSON.parse(originalRead(path.join(directory,'manifest.json'),'utf8'))
export const backend=manifest.backend
export const counters={network:0,database:0,browser:0,child:0,worker:0,addon:0,fsWrite:0,unexpectedModule:0,unexpectedRead:0,unexpectedRequest:0,opaqueInspection:0}
const deny=kind=>()=>{counters[kind]++;throw Error('Group B source control denies '+kind)}
export const denyFetch=deny('network')
export const requestFailure=url=>{counters.unexpectedRequest++;throw Error('Unplanned logical request: '+String(url))}
globalThis.fetch=denyFetch
for(const module of [http,https]){module.request=deny('network');module.get=deny('network')}
http2.connect=deny('network');net.connect=deny('network');net.createConnection=deny('network')
net.createServer=deny('network');net.Socket.prototype.connect=deny('network')
tls.connect=deny('network');tls.createServer=deny('network');dgram.createSocket=deny('network')
for(const module of [dns,dns.promises])for(const key of Object.keys(module))if(/^(?:lookup|resolve|reverse)/.test(key)&&typeof module[key]==='function')module[key]=deny('network')
for(const key of ['exec','execFile','spawn','fork','execSync','execFileSync','spawnSync'])childProcess[key]=deny('child')
workerThreads.Worker=class{constructor(){deny('worker')()}}
process.dlopen=deny('addon')
for(const module of [fs,fs.promises])for(const key of Object.keys(module))if(/^(?:write|append|truncate|ftruncate|unlink|rm|rmdir|mkdir|mkdtemp|rename|copyFile|cp|link|symlink|chmod|chown|lchown|fchown|utimes|lutimes|futimes)/.test(key)&&typeof module[key]==='function')module[key]=deny('fsWrite')
fs.createWriteStream=deny('fsWrite')
const allowedReads=new Set(manifest.reads.map(item=>path.resolve(item.path)))
const checkedPath=value=>{
 const resolved=path.resolve(value instanceof URL?fileURLToPath(value):Buffer.isBuffer(value)?value.toString():String(value))
 if(!allowedReads.has(resolved))return deny('unexpectedRead')()
 return value
}
for(const [module,key]of [[fs,'readFileSync'],[fs,'readFile'],[fs.promises,'readFile']]){
 const original=module[key].bind(module)
 module[key]=(name,...rest)=>original(checkedPath(name),...rest)
}
const open=fs.open.bind(fs),openSync=fs.openSync.bind(fs),promiseOpen=fs.promises.open.bind(fs.promises)
const readOnly=flags=>flags==='r'||flags==='rs'||flags===0
fs.open=(filename,flags,...rest)=>readOnly(flags)?open(checkedPath(filename),flags,...rest):deny('fsWrite')()
fs.openSync=(filename,flags,...rest)=>readOnly(flags)?openSync(checkedPath(filename),flags,...rest):deny('fsWrite')()
fs.promises.open=(filename,flags,...rest)=>readOnly(flags)?promiseOpen(checkedPath(filename),flags,...rest):deny('fsWrite')()
syncBuiltinESMExports()
export const permissions=Object.fromEntries(['addons','worker','child','fs.write'].map(kind=>[kind,process.permission.has(kind)]))
assert.deepEqual(permissions,{addons:false,worker:false,child:false,'fs.write':false})
const phase=process.argv.find(value=>value.startsWith('--phase='))?.slice(8)
assert.ok(['preimage','current'].includes(phase),'Declare --phase=preimage or --phase=current')
export const executionPhase=phase
const allowedModules=new Map(manifest.modules.map(item=>[path.resolve(item.path),item]))
export const imported=new Map()
const volatile=new Set(manifest.mutableSources.filter(value=>path.resolve(value)!==path.resolve(manifest.pinnedHelper.path)).map(value=>path.resolve(value)))
registerHooks({resolve(specifier,context,next){
 if(/^(?:mongoose|mongodb)(?:\/|$)/.test(specifier)||/saveToDB\.js(?:$|\?)/.test(specifier))return deny('database')()
 if(/^(?:puppeteer|playwright)(?:\/|$)/.test(specifier))return deny('browser')()
 const result=next(specifier,context)
 if(!isBuiltin(result.url)&&(!result.url.startsWith('file:')||!allowedModules.has(path.resolve(fileURLToPath(result.url)))))return deny('unexpectedModule')()
 return result
},load(url,context,next){
 if(url.startsWith('file:')){
  const filename=path.resolve(fileURLToPath(url)),expected=allowedModules.get(filename)
  if(!expected)return deny('unexpectedModule')()
  const raw=originalRead(filename),digest=hash(raw)
  if(!(phase==='current'&&volatile.has(filename)))assert.equal(digest,expected.sha256,'Frozen module changed: '+filename)
  imported.set(filename,{path:path.relative(manifest.workspace,filename).replaceAll('\\','/'),sha256:digest,bytes:raw.length})
 }
 return next(url,context)
}})
export const readAllowed=name=>fs.readFileSync(path.resolve(backend,name))
export const finishGuard=()=>{
 const files=[...imported].map(([filename,item])=>({...item,unchangedAtExit:hash(originalRead(filename))===item.sha256}))
 assert.ok(files.every(row=>row.unchangedAtExit))
 for(const row of manifest.reads)if(row.sha256&&!volatile.has(path.resolve(row.path)))assert.equal(hash(originalRead(row.path)),row.sha256,'Frozen permitted read changed: '+row.path)
 assert.ok(Object.values(counters).every(value=>value===0),'Physical and unexpected counters must all remain zero')
 return{phase,permissions,counters,files,externalRequests:0,codeGenerationDeniedByCommand:true,substitutions:manifest.substitutions}
}
