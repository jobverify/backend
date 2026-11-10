import {registerHooks} from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jobverify-sequential-cancel-'))
const controller=new AbortController()
const reason=Object.assign(new Error('Stop requested'),{signalName:'SIGTERM'})
const started=[],snapshots=[]
let first=true
const phase=process.argv[2]
globalThis.sequentialCancellation={
  sources:['first','queued'].map(name=>({name,dryRunFile:path.join(dir,name+'.json'),provider:{adapter:'script',dryRunEnrichPublicExperience:false},run:async({signal})=>{started.push(name);if(first&&phase==='scrape'){first=false;controller.abort(reason);signal.throwIfAborted()}return []}})),
  save:async(_jobs,file,{signal})=>{if(first){first=false;controller.abort(reason)}signal?.throwIfAborted();snapshots.push(path.basename(file))}
}
const stubs=new Map([
 [new URL('../../providers/index.js',import.meta.url).href,'export const buildScrapers=()=>globalThis.sequentialCancellation.sources'],
 [new URL('../../utils/saveToDB.js',import.meta.url).href,'export const saveToDB=()=>{throw Error("Unexpected live write")};export const purgeExpiredJobsForQuotaRecovery=async()=>({deletedCount:0});export const saveDryRunSnapshot=(...args)=>globalThis.sequentialCancellation.save(...args)']
])
registerHooks({resolve(specifier,context,next){if(specifier==='dotenv')return {url:'data:text/javascript,export default {config(){}}',shortCircuit:true};return next(specifier,context)},load(url,context,next){return stubs.has(url)?{format:'module',source:stubs.get(url),shortCircuit:true}:next(url,context)}})
for(const key of ['SCRAPER_ONLY','SCRAPER_START_AT','SCRAPER_START_AFTER','SCRAPER_FAILURE_ABORT_THRESHOLD'])delete process.env[key]
process.env.SCRAPER_CHECKPOINT_FILE=path.join(dir,'run-state.json')
process.argv.push('--dry-run')
console.log=console.warn=console.error=()=>{}
try{
 const {runAll}=await import('../../runner.js')
 const interruptedSummary=await runAll({stopSignal:controller.signal})
 const interrupted=JSON.parse(fs.readFileSync(process.env.SCRAPER_CHECKPOINT_FILE,'utf8'))
 const resumedSummary=await runAll()
 const resumed=JSON.parse(fs.readFileSync(process.env.SCRAPER_CHECKPOINT_FILE,'utf8'))
 process.stdout.write(JSON.stringify({started,snapshots,interruptedSummary,interrupted,resumedSummary,resumed}))
}finally{fs.rmSync(dir,{recursive:true,force:true})}
