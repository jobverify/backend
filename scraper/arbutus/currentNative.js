import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const CORPORATE='https://www.arbutusbio.com/culture-careers/'
const BOARD='https://recruiting.paylocity.com/recruiting/jobs/All/f2fda2c7-bfc6-4840-90d0-83d242cada87/Arbutus-Biopharma-Inc'
const TENANT='f2fda2c7-bfc6-4840-90d0-83d242cada87'
const check=(ok,message)=>{if(!ok)throw Error('Arbutus current native: '+message)}
const corporate=html=>{
 const doc=readNativeDocument(html),canonical=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 check(activeHead(html).titles.some(title=>title==='Culture & Careers - Arbutus Biopharma : Arbutus Biopharma')
   &&canonical.length===1&&canonical[0].attrs.href===CORPORATE,'corporate employer identity changed')
 check(doc.nodes(n=>n.tag==='a'&&n.attrs.href===BOARD).length>0,'current corporate native handoff missing')
}
const native=html=>{
 const doc=readNativeDocument(html),scripts=doc.nodes(n=>n.tag==='script'&&!n.attrs.src)
 check(activeHead(html).titles.some(title=>title==='Arbutus Biopharma Inc - Job Opportunities'),'native employer title changed')
 const assignments=scripts.map(n=>n.raw.match(/^\s*window\.pageData\s*=\s*([\s\S]*?);\s*$/)?.[1]).filter(Boolean)
 check(assignments.length===1,'native inventory assignment missing or ambiguous')
 let data
 try{data=JSON.parse(assignments[0])}catch{check(false,'native inventory JSON invalid')}
 check(data.ModuleTitle?.trim()==='Arbutus Biopharma Inc'&&data.ModuleId==='20053'
   &&data.LeadJoinUrl==='/Recruiting/PublicLeads/New/'+TENANT,'native employer/module identity changed')
 check(Array.isArray(data.Jobs)&&data.ShowInternal===false,'native public inventory missing or internally filtered')
 check(Array.isArray(data.Departments)&&data.Departments[0]==='All Departments'
   &&Array.isArray(data.Locations)&&data.Locations[0]==='All Locations','native all-department/all-location defaults changed')
 const clients=doc.nodes(n=>n.tag==='script'&&/^\/Recruiting\/dist\/public-site-react-list\/public-site-react-list-bundle\.js\?ver=\d+$/.test(n.attrs.src||''))
 check(clients.length===1,'native full public-list client missing or ambiguous')
 return{data,client:new URL(clients[0].attrs.src,BOARD).href}
}
const verifyClient=body=>check(body.includes('OriginalJobs:window.pageData.Jobs')&&body.includes('n.Jobs&&n.Jobs.length>0')
 &&body.includes('Sorry, there are currently no jobs matching this criteria.'),'native full-array and empty-render contract changed')

export const runCurrentArbutus=async(options={})=>{
 const signal=AbortSignal.any([AbortSignal.timeout(90000),...(options.signal?[options.signal]:[])])
 const wait=promise=>new Promise((resolve,reject)=>{
  const finish=(fn,value)=>{signal.removeEventListener('abort',abort);fn(value)},abort=()=>finish(reject,signal.reason)
  signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(v=>finish(resolve,v),e=>finish(reject,e));if(signal.aborted)abort()
 })
 let requests=0
 const read=async url=>{
  signal.throwIfAborted();requests++
  if(options.fetchText){const body=await wait(options.fetchText(url,{signal}));signal.throwIfAborted();check(typeof body==='string','native text response missing');return body}
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(20000)])
  const response=await fetch(url,{redirect:'manual',signal:requestSignal,headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html,application/javascript'}})
  check(response.status===200&&response.url===url,'native/corporate HTTP response unavailable or redirected')
  const body=await response.text();requestSignal.throwIfAborted();check(Buffer.byteLength(body)<4000000,'native response too large');return body
 }
 corporate(await read(CORPORATE))
 const opening=native(await read(BOARD)),client=await read(opening.client);verifyClient(client)
 check(opening.data.Jobs.length===0,'current nonempty native inventory requires full public role detail qualification')
 const closing=native(await read(BOARD)),closingClient=await read(closing.client);verifyClient(closingClient)
 corporate(await read(CORPORATE))
 check(JSON.stringify(opening.data)===JSON.stringify(closing.data)&&opening.client===closing.client&&client===closingClient,'closing complete native inventory/client models changed')
 const now=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString()
 return attachInventoryEvidence([],{status:'verified-empty',surface:BOARD,firstParty:true,listingComplete:true,pagesFetched:requests,
  reportedTotal:0,indiaFacetCount:0,verifiedAt:now,reason:'Current corporate handoff and exact native employer/module bind the declared board; published OriginalJobs full public array is empty under all-department/all-location defaults and ShowInternal=false; opening and closing complete native/client models reconcile; declared-board scope only'})
}
