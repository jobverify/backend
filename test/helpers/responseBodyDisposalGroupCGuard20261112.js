import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
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

// Closed portable regression read/module names; no report-folder inputs.
const SOURCE_MODULES=Object.freeze([
 "node_modules/acorn/dist/acorn.mjs",
 "node_modules/entities/dist/decode-codepoint.js",
 "node_modules/entities/dist/decode.js",
 "node_modules/entities/dist/encode.js",
 "node_modules/entities/dist/escape.js",
 "node_modules/entities/dist/generated/decode-data-html.js",
 "node_modules/entities/dist/generated/encode-html.js",
 "node_modules/entities/dist/index.js",
 "node_modules/entities/dist/internal/decode-data-format.js",
 "scraper-support/myworkday/nativeLifecycleDates.js",
 "scraper-support/shared/nativeJobPosting.js",
 "scraper-support/shared/responseBodyDisposal.js",
 "scraper-support/shared/rmkNativePairHtml.js",
 "scraper-support/supportPaths.js",
 "scraper-support/utils/activeNativeHtml.js",
 "scraper-support/utils/fetch.js",
 "scraper-support/utils/inventoryEvidence.js",
 "scraper-support/utils/loadConfig.js",
 "scraper-support/utils/normalizeScrapedJob.js",
 "scraper-support/utils/retry.js",
 "scraper-support/utils/retryPressure.js",
 "scraper-support/utils/sourceObservationEvidence.js",
 "scraper-support/utils/visibleNativeHtml.js",
 "scraper-support/utils/workableEmployerInventory.js",
 "scraper-support/utils/workablePublicApi.js",
 "scraper-support/utils/zohoNativeEmbed.js",
 "scraper-support/utils/zohoNativeInventory.js",
 "scraper/darwinbox/reviewedCandidateClient.js",
 "scraper/darwinbox/script.js",
 "scraper/lakshya/currentNative.js",
 "scraper/loginext/currentNative.js",
 "scraper/perfios/script.js",
 "scraper/precisionprecastsolutions/script.js",
 "scraper/ravetechnologies/catalog.js",
 "scraper/ravetechnologies/nativeContract.js",
 "scraper/ravetechnologies/script.js",
 "scraper/saginfotech/catalog.js",
 "scraper/saginfotech/native.js",
 "scraper/saginfotech/script.js",
 "scraper/samco/catalog.js",
 "scraper/samco/native.js",
 "scraper/samco/script.js",
 "scraper/samcosecuritieslimited/native.js",
 "scraper/samcosecuritieslimited/script.js",
 "scraper/sedintechnologies/catalog.js",
 "scraper/sedintechnologies/currentZoho.js",
 "scraper/sedintechnologies/native.js",
 "scraper/sedintechnologies/script.js",
 "scraper/stanplus/catalog.js",
 "scraper/stanplus/nativeInventory.js",
 "scraper/stanplus/script.js",
 "scraper/uhptechnologiespvtltd/script.js",
 "scraper/uniqus/currentNative.js",
 "scraper/uniqus/currentPublicTransport.js",
 "src/constants/jobFilterTaxonomy.js",
 "src/constants/preferredJobTypes.js",
 "src/services/classificationDescription.js",
 "src/services/classificationSourceQuality.js",
 "src/services/jobClassificationPolicy.js",
 "src/services/jobDescriptionPolicy.js",
 "src/services/jobRecruitmentPolicy.js",
 "src/utils/employerDisclosures.js",
 "src/utils/employerPostingDate.js",
 "src/utils/jobClassificationVersion.js",
 "src/utils/jobDescriptionDisplay.js",
 "src/utils/jobFilterSignals.js",
 "src/utils/jobLifecycle.js",
 "src/utils/jobPublicationDate.js",
 "src/utils/jobSourceContent.js",
 "src/utils/mainExperienceRequirement.js",
 "src/utils/publicJobTypeLabel.js",
 "src/utils/publicWorkArrangement.js"
])
const DATA_FILES=Object.freeze([
 "package.json",
 "node_modules/acorn/package.json",
 "node_modules/entities/package.json",
 "scraper-support/scraper.config.json",
 "classification/policy.json",
 "classification/gliclass/model.json",
 "classification/gliclass/requirements.txt",
 "classification/gliclass/worker.py",
 "classification/gliclass/runtime.py",
 "rewriting/model.json",
 "scraper/darwinbox/reviewedCandidateReleases.json",
 "scraper/stanplus/reviewedNativeScope.json",
 "scraper/perfios/reviewedNativeScope.json",
 "scraper/precisionprecastsolutions/test-data/2026-10-31-native-packets.json.gz",
 "scraper/samcosecuritieslimited/test-data/2026-10-31-native-packets.json.gz",
 "scraper/samco/test-data/2026-10-31-native-packets.json.gz",
 "scraper/saginfotech/test-data/2026-10-31-native-packets.json.gz",
 "scraper/uhptechnologiespvtltd/test-data/2026-10-31-native-packets.json.gz",
 "scraper/sedintechnologies/test-data/hard-failures-20261107.json.gz",
 "scraper/sedintechnologies/test-data/2026-10-31-native-packets.json.gz",
 "scraper/uniqus/test-data/current-native-20261107.json.gz",
 "scraper/wissentechnology/test-data/current-native-20261107.json.gz",
 "scraper/scaleflex/test-data/current-native-20261107.json.gz",
 "scraper/lakshya/test-data/current-native-20261107.json.gz",
 "scraper/loginext/test-data/current-native-20261107.json.gz",
 "test/test-data/recruitmentGoal20261106/rave-current-detail.json",
 "test/test-data/darwinbox-current-client-20261105.json.gz"
])
const OPTIONAL_READS=Object.freeze(["scraper/darwinbox/config.json", "scraper/uhptechnologiespvtltd/config.json"])
const PACKAGE_RESOLUTION=Object.freeze({"acorn": "node_modules/acorn/dist/acorn.mjs", "entities": "node_modules/entities/dist/index.js"})
export const backendReadNames=()=>[...new Set([...SOURCE_MODULES,...DATA_FILES,...OPTIONAL_READS])].sort()

export function installGuard() {
 assert.ok(process.permission, 'Only the explicitly approved restricted child may execute source')
 const backend=path.resolve(process.env.HTTP_DISPOSAL_BACKEND||fileURLToPath(new URL('../../',import.meta.url)))
 const here=path.dirname(fileURLToPath(import.meta.url))
 const hash=raw=>createHash('sha256').update(raw).digest('hex')
 const rawRead=fs.readFileSync.bind(fs)
 const bind=name=>{const raw=rawRead(path.join(backend,name));return{path:name,sha256:hash(raw),bytes:raw.length}}
 // Bind current exact bytes at child startup; verify them again at exit.
 // Fixed paths remain closed while intentional future source edits can run causal tests.
 const closure={modules:SOURCE_MODULES.map(bind),data:DATA_FILES.map(bind),optional_read_paths:OPTIONAL_READS,package_resolution:PACKAGE_RESOLUTION}
 const moduleRecords=new Map(closure.modules.map(r=>[path.resolve(backend,r.path),r]))
 const dataRecords=new Map(closure.data.map(r=>[path.resolve(backend,r.path),r]))
 const harness=[path.resolve(here,'../responseBodyDisposalGroupC20261112.test.js'),fileURLToPath(import.meta.url)]
 const allowedReads=new Set([...moduleRecords.keys(),...dataRecords.keys(),...harness,
  ...closure.optional_read_paths.map(name=>path.resolve(backend,name))])
 const imported=new Map(),reads=new Map()
 const attempts={network:0,database:0,browser:0,environment:0,child:0,worker:0,addon:0,fsWrite:0,unexpectedModule:0,unexpectedRead:0,unexpectedRequest:0}
 const deny=kind=>()=>{attempts[kind]++;throw Error('Group C guard denies '+kind)}
 const checkRead=filename=>{
  const value=filename instanceof URL?fileURLToPath(filename):filename
  if(typeof value!=='string'||!allowedReads.has(path.resolve(value)))return deny('unexpectedRead')()
  return path.resolve(value)
 }
 globalThis.fetch=deny('network')
 for(const module of[http,https]){module.request=deny('network');module.get=deny('network')}
 http2.connect=deny('network');net.connect=deny('network');net.createConnection=deny('network')
 net.createServer=deny('network');net.Socket.prototype.connect=deny('network')
 tls.connect=deny('network');tls.createServer=deny('network');dgram.createSocket=deny('network')
 for(const module of[dns,dns.promises])for(const key of Object.keys(module))if(/^(?:lookup|resolve|reverse)/.test(key)&&typeof module[key]==='function')module[key]=deny('network')
 for(const key of['exec','execFile','spawn','fork','execSync','execFileSync','spawnSync'])childProcess[key]=deny('child')
 workerThreads.Worker=class{constructor(){deny('worker')()}}
 process.dlopen=deny('addon')
 for(const module of[fs,fs.promises])for(const key of Object.keys(module))if(/^(?:write|append|truncate|ftruncate|unlink|rm|rmdir|mkdir|mkdtemp|rename|copyFile|cp|link|symlink|chmod|chown|lchown|fchown|utimes|lutimes|futimes)/.test(key)&&typeof module[key]==='function')module[key]=deny('fsWrite')
 fs.createWriteStream=deny('fsWrite')
 const open=fs.open,openSync=fs.openSync,promiseOpen=fs.promises.open,readOnly=flags=>flags==='r'||flags==='rs'||flags===0
 fs.open=(filename,flags,...rest)=>{checkRead(filename);return readOnly(flags)?open(filename,flags,...rest):deny('fsWrite')()}
 fs.openSync=(filename,flags,...rest)=>{checkRead(filename);return readOnly(flags)?openSync(filename,flags,...rest):deny('fsWrite')()}
 fs.promises.open=(filename,flags,...rest)=>{checkRead(filename);return readOnly(flags)?promiseOpen(filename,flags,...rest):deny('fsWrite')()}
 fs.readFileSync=(filename,...rest)=>{
  const normalized=checkRead(filename),result=rawRead(filename,...rest)
  reads.set(normalized,(reads.get(normalized)||0)+1);return result
 }
 const readFile=fs.readFile,promiseRead=fs.promises.readFile
 fs.readFile=(filename,...rest)=>{checkRead(filename);return readFile(filename,...rest)}
 fs.promises.readFile=(filename,...rest)=>{checkRead(filename);return promiseRead(filename,...rest)}
 syncBuiltinESMExports()
 const permissions=Object.fromEntries(['addons','worker','child','fs.write'].map(kind=>[kind,process.permission.has(kind)]))
 assert.deepEqual(permissions,{addons:false,worker:false,child:false,'fs.write':false})
 assert.equal(typeof globalThis.DOMMatrix,'undefined')
 for(const [filename,record]of[...moduleRecords,...dataRecords])assert.equal(hash(rawRead(filename)),record.sha256,'Approved bytes changed before import: '+record.path)
 const harnessHashes=harness.map(filename=>({filename,sha256:hash(rawRead(filename))}))
 registerHooks({resolve(specifier,context,next){
  if(/^(?:mongoose|mongodb)(?:\/|$)/.test(specifier)||/saveToDB\.js(?:$|\?)/.test(specifier))return deny('database')()
  if(/^(?:puppeteer|playwright)(?:\/|$)/.test(specifier))return deny('browser')()
  if(/^(?:dotenv)(?:\/|$)/.test(specifier)||/loadEnv\.js(?:$|\?)/.test(specifier))return deny('environment')()
  const packagePath=closure.package_resolution[specifier]
  const result=packagePath?{url:pathToFileURL(path.join(backend,packagePath)).href,shortCircuit:true}:next(specifier,context)
  if(!isBuiltin(result.url)&&(!result.url.startsWith('file:')||!moduleRecords.has(fileURLToPath(result.url))))return deny('unexpectedModule')()
  return result
 },load(url,context,next){
  if(url.startsWith('file:')){
   const filename=fileURLToPath(url),record=moduleRecords.get(filename)
   if(!record)return deny('unexpectedModule')()
   const raw=rawRead(filename);assert.equal(hash(raw),record.sha256,'Approved module drift')
   imported.set(filename,record)
  }
  return next(url,context)
 }})
 return {backend,hash,attempts,deny,read:name=>fs.readFileSync(path.join(backend,name)),
  load:name=>import(pathToFileURL(path.join(backend,name))),
  finish(){
   const files=[...imported].map(([filename,record])=>({...record,unchangedAtExit:hash(rawRead(filename))===record.sha256}))
   const dataUnchanged=[...dataRecords].every(([filename,record])=>hash(rawRead(filename))===record.sha256)
   return{permissions,attempts,files,dataUnchanged,harnessUnchanged:harnessHashes.every(r=>hash(rawRead(r.filename))===r.sha256),
    reads:[...reads].map(([filename,count])=>({path:path.relative(backend,filename).replaceAll('\\','/'),count})),substitutions:[],externalRequests:0}
  }}
}
