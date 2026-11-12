// PREPARED, NOT EXECUTED. Imported only by the separately approved proof child.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {registerHooks,isBuiltin,syncBuiltinESMExports} from 'node:module'
import cp from 'node:child_process'
import workers from 'node:worker_threads'
import http from 'node:http'
import https from 'node:https'
import http2 from 'node:http2'
import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns'
import dgram from 'node:dgram'

export const sha=raw=>createHash('sha256').update(raw).digest('hex')
export const root=path.resolve(process.env.READER_CLEANUP_ROOT||'.')
export const here=path.dirname(fileURLToPath(import.meta.url))
const rawRead=fs.readFileSync
export const closure=JSON.parse(rawRead(path.join(here,'closure.json'),'utf8'))
const sealed=JSON.parse(rawRead(path.join(here,'preparation-manifest.json'),'utf8'))
assert.equal(process.env.READER_CLEANUP_GO_SHA256,sha(rawRead(path.join(here,'preparation-manifest.json'))),'Explicit reviewed preparation SHA required')
export const flow=closure.flows.find(row=>row.id===process.env.READER_CLEANUP_FLOW)
assert.ok(flow,'Exact named flow required')
assert.ok(process.permission,'Strict Node permission mode required')
export const counters=Object.fromEntries(['network','database','browser','child','worker','addon','fsWrite','unexpectedModule','unexpectedRead','unexpectedRequest'].map(key=>[key,0]))
export const deny=kind=>()=>{counters[kind]++;throw Error('Reader cleanup proof denied '+kind)}
const resolve=filename=>path.resolve(filename instanceof URL?fileURLToPath(filename):String(filename))
const modules=new Map(flow.modules.map(pin=>[path.resolve(root,pin.path),pin]))
const files=new Map([...flow.modules,...flow.additional_reads,...sealed.childProofFiles].map(pin=>[path.resolve(root,pin.path),pin]))
for(const [filename,pin]of files){const raw=rawRead(filename);assert.equal(sha(raw),pin.sha256,filename);assert.equal(raw.length,pin.bytes,filename)}
const allowed=new Set([...files.keys(),path.join(here,'preparation-manifest.json')])
export const observedReads=new Set(),imported=new Map()
const readCheck=filename=>{const resolved=resolve(filename);if(!allowed.has(resolved))return deny('unexpectedRead')();observedReads.add(resolved);return resolved}
globalThis.fetch=deny('network')
for(const module of[http,https])for(const key of['request','get'])module[key]=deny('network')
http2.connect=deny('network');net.connect=deny('network');net.createConnection=deny('network');net.createServer=deny('network');net.Socket.prototype.connect=deny('network')
tls.connect=deny('network');tls.createServer=deny('network');dgram.createSocket=deny('network')
for(const module of[dns,dns.promises])for(const key of Object.keys(module))if(/^(lookup|resolve|reverse)/.test(key)&&typeof module[key]==='function')module[key]=deny('network')
for(const key of['exec','execFile','spawn','fork','execSync','execFileSync','spawnSync'])cp[key]=deny('child')
workers.Worker=class{constructor(){deny('worker')()}}
process.dlopen=deny('addon')
for(const module of[fs,fs.promises])for(const key of Object.keys(module))if(/^(write|append|truncate|ftruncate|unlink|rm|rmdir|mkdir|mkdtemp|rename|copyFile|cp|link|symlink|chmod|chown|lchown|fchown|utimes|lutimes|futimes)/.test(key)&&typeof module[key]==='function')module[key]=deny('fsWrite')
fs.createWriteStream=deny('fsWrite')
for(const [module,key]of[[fs,'readFileSync'],[fs,'readFile'],[fs.promises,'readFile'],[fs,'createReadStream'],[fs,'statSync'],[fs,'stat'],[fs.promises,'stat'],[fs,'lstatSync'],[fs,'lstat'],[fs.promises,'lstat'],[fs,'accessSync'],[fs,'access'],[fs.promises,'access']]){
 const original=module[key];module[key]=function(filename,...args){readCheck(filename);return Reflect.apply(original,this,[filename,...args])}
}
for(const module of[fs,fs.promises])for(const key of['readdir','readdirSync','opendir','opendirSync','readlink','readlinkSync'])if(typeof module[key]==='function')module[key]=deny('unexpectedRead')
for(const [module,key]of[[fs,'open'],[fs,'openSync'],[fs.promises,'open']]){const original=module[key];module[key]=function(filename,flags,...args){if(!['r','rs',0].includes(flags))return deny('fsWrite')();readCheck(filename);return Reflect.apply(original,this,[filename,flags,...args])}}
syncBuiltinESMExports()
export const permissions=Object.fromEntries(['addons','worker','child','fs.write'].map(kind=>[kind,process.permission.has(kind)]))
assert.deepEqual(permissions,{addons:false,worker:false,child:false,'fs.write':false})
assert.equal(globalThis.DOMMatrix,undefined)
const applicationBuiltins=new Set(flow.application_builtins)
registerHooks({resolve(specifier,context,next){
 if(/^(mongoose|mongodb)(\/|$)/.test(specifier)||/saveToDB\.js(?:$|\?)/.test(specifier))return deny('database')()
 if(/^(puppeteer|playwright)(\/|$)/.test(specifier))return deny('browser')()
 if(/pdfjs|canvas|DOMMatrix/i.test(specifier))return deny('unexpectedModule')()
 const result=next(specifier,context)
 if(isBuiltin(result.url)){
  if(context.parentURL?.startsWith('file:')&&modules.has(fileURLToPath(context.parentURL))&&!applicationBuiltins.has(result.url))return deny('unexpectedModule')()
 }else if(!result.url.startsWith('file:')||!modules.has(fileURLToPath(result.url)))return deny('unexpectedModule')()
 return result
},load(url,context,next){
 if(url.startsWith('file:')){const filename=fileURLToPath(url),pin=modules.get(filename);if(!pin)return deny('unexpectedModule')();const raw=fs.readFileSync(filename);assert.equal(sha(raw),pin.sha256,filename);imported.set(filename,{path:pin.path,sha256:sha(raw),bytes:raw.length})}
 return next(url,context)
}})
export function assertGuard(){
 assert.deepEqual(counters,Object.fromEntries(Object.keys(counters).map(key=>[key,0])))
 assert.equal(globalThis.DOMMatrix,undefined)
 assert.equal(imported.size,flow.modules.length,'Every granted eager module must be loaded; unexplained closure grants fail review')
}
