import{createHash}from'node:crypto'
import{activeHead,extractActiveDescription,readNativeDocument}from'../../scraper-support/utils/activeNativeHtml.js'
import{attachInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{validateBikClient}from'../bounteous/nativeScriptContract.js'
export const HOME='https://bik.ai/',TERMS='https://bik.ai/bik-terms',CAREERS='https://bik.ai/careers'
const ORIGIN='https://comida.keka.com',ACTIVE=ORIGIN+'/careers/api/embedjobs/default/active/a4f89fc2-d9b6-49a1-b6c7-66522d4c7956'
const check=(ok,message)=>{if(!ok)throw Error('Bikayi current BIK/Keka: '+message)}
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const model=row=>{const{publishedSinceDays,...data}=row;return JSON.stringify(data)}
const scripts=html=>[...new Set(readNativeDocument(html).nodes(node=>node.tag==='script'&&node.attrs.src&&/^\/_next\/static\/chunks\/[a-z0-9-]+\.js$/.test(node.attrs.src)).map(node=>new URL(node.attrs.src,HOME).href))]
const visible=html=>{const doc=readNativeDocument(html);return doc.nodes(node=>node.tag==='body').map(doc.text).join(' ')}
function corporate(home,terms,careers){
 check(activeHead(home).titles.includes('BIK'),'current BIK company identity changed')
 check(activeHead(terms).titles.includes('BIK TERMS')&&visible(terms).includes('owned and operated by Bikayi, Inc.'),'current BIK/Bikayi brand-owner continuity changed')
 check(activeHead(careers).titles.includes('Careers')&&activeHead(careers).metas.some(meta=>meta.name==='description'&&meta.content==='Join our team at Bik.ai and help us build the future of AI.'),'current employer careers identity changed')
 const doc=readNativeDocument(careers),state=doc.nodes(node=>node.tag==='script'&&node.attrs.id==='__NEXT_DATA__')
 check(state.length===1,'current native careers page model missing');let parsed;try{parsed=JSON.parse(state[0].raw)}catch{throw Error('Bikayi current native page JSON invalid')}
 check(parsed.page==='/careers'&&parsed.nextExport===true&&doc.nodes(node=>node.attrs.id==='keka-jobs-section').length===1,'current native careers route/hiring section changed')
 const common=new Set([...scripts(home),...scripts(terms)]),unique=scripts(careers).filter(url=>!common.has(url))
 check(unique.length>0&&unique.length<=8,'native careers client inventory changed');return unique
}
function client(bodies){
 const candidates=bodies.filter(body=>body.includes('/careers/api/embedjobs/default/active/'))
 check(candidates.length===1,'expected one current native Keka handoff client')
 const body=candidates[0],urls=[...new Set([...body.matchAll(/https:\/\/[a-z0-9.-]+\/careers\/api\/embedjobs\/default\/active\/[a-f0-9-]+/g)].map(m=>m[0]))]
 validateBikClient(body)
 check(urls.length===1&&urls[0]===ACTIVE&&body.includes(ORIGIN+'/careers/jobdetails/${e.id}')&&body.includes('.data.map(')&&body.includes('Math.ceil(i.length/15)'),'current Keka client tenant/full-array/local-pagination contract changed')
 return ACTIVE
}
function listing(value){check(Array.isArray(value)&&value.length<=1000&&value.every(row=>Number.isSafeInteger(row?.id)&&row.id>0&&clean(row.title)),'native complete active array invalid');check(new Set(value.map(row=>row.id)).size===value.length,'duplicate native posting identity');return value}
const names=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'}),countryNames=[]
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b);if(['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code))continue;const name=names.of(code);if(name)countryNames.push(name)}
const labelledCountry=value=>countryNames.filter(name=>value===name||value.startsWith(name+' (')||value.startsWith(name+',')||value.startsWith(name+';')).sort((a,b)=>b.length-a.length)[0]||null
function geography(row){
 const doc=readNativeDocument(row.description),labels=[...new Set(doc.nodes(node=>['div','p','li'].includes(node.tag)&&/^Location\s*[:-]/i.test(doc.text(node))&&doc.text(node).length<=400).map(node=>doc.text(node)))]
 check(Array.isArray(row.jobLocations),'native role worksite array missing')
 const typed=row.jobLocations.map(location=>{const code=clean(location.countryCode);return/^[A-Z]{2}$/.test(code)&&!['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code)&&names.of(code)===location.countryName?location.countryName:null})
 const literal=labels.map(label=>labelledCountry(label.replace(/^Location\s*[:-]\s*/i,''))).filter(Boolean),values=[...new Set([...typed,...literal].filter(Boolean))]
 const country=typed.every(Boolean)&&values.length===1?values[0]:null
 return{country,labels,conflict:values.length>1||typed.some(country=>!country),kind:row.jobLocations.length?'typed-native-worksites':literal.length?'labelled-native-role-location':'unknown',nativeCountries:values}
}
function publication(raw){
 if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(raw)||!Number.isFinite(Date.parse(raw)))return null
 const [year,month,day]=raw.slice(0,10).split('-').map(Number),calendar=new Date(Date.UTC(year,month-1,day));return calendar.getUTCFullYear()===year&&calendar.getUTCMonth()===month-1&&calendar.getUTCDate()===day?raw:null
}
function full(row,page){
 const url=ORIGIN+'/careers/jobdetails/'+row.id,doc=readNativeDocument(page),headings=doc.nodes(node=>node.tag==='h1'),bodies=doc.nodes(node=>doc.hasClass(node,'job-description-container'))
 check(headings.length===1&&doc.text(headings[0])===row.title&&bodies.length===1,'native public role title/description identity mismatch')
 const criteria=extractActiveDescription(row.description),published=publication(row.publishedOn)
 check(criteria&&criteria.length>=400&&criteria===doc.text(bodies[0]),'same-ID full public criteria conflict or missing native criteria')
 check(published,'original native publication date malformed or unavailable')
 const geo=geography(row),single=row.jobLocations.length===1?row.jobLocations[0]:null
 const locations=row.jobLocations.map(location=>[clean(location.name)||clean(location.city),clean(location.state),location.countryName].filter(Boolean).join(', '))
 const location=locations.length?locations.join('; '):geo.labels.map(label=>label.replace(/^Location\s*[:-]\s*/i,'')).join('; ')||null
 return{source:'bikayi',company:'BIK',jobId:String(row.id),requisitionId:clean(row.jobNumber)||null,title:row.title,department:clean(row.departmentName)||null,
  country:geo.country,city:single&&geo.country?clean(single.city)||null:null,location,
  sourceUrl:url,applyUrl:url,link:url,employmentType:null,sourceNativeEmploymentType:row.jobType??null,experienceRequired:clean(row.experience)||null,
  minimumQualification:null,preferredQualification:null,requiredSkills:Array.isArray(row.skillNames)?[...row.skillNames]:[],postingDate:published,closingDate:null,remoteStatus:null,
  jobDescription:row.description,sourceDescription:row.description,sourceNativeRecord:structuredClone(row),sourceNativePublicDetailHTML:page,
  sourceNativePostingDate:row.publishedOn,sourceNativeWorkplaceLabels:geo.labels,sourceNativeWorksiteCountries:geo.nativeCountries,
  sourceNativeCountryEvidenceKind:geo.kind,sourceNativeCountryConflict:geo.conflict,sourceCountryEvidence:geo.country?'Same-role public full criteria and explicit native worksite country.':null,
  sourceDetailComplete:true,sourceListingComplete:false,sourceCompanyWideScopeComplete:false,sourceLifecycleCleanupVerified:false}
}
export async function runCurrentBikayi(options={}){
 const signal=AbortSignal.any([AbortSignal.timeout(Number.isSafeInteger(options.timeoutMs)&&options.timeoutMs>0?options.timeoutMs:120000),...(options.signal?[options.signal]:[])])
 const wait=promise=>new Promise((resolve,reject)=>{let done=false;const finish=(fn,value)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);fn(value)},abort=()=>finish(reject,signal.reason);signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>finish(resolve,value),error=>finish(reject,error));if(signal.aborted)abort()})
 check(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0,'invalid result cap')
 const responses=[]
 const read=async(url,json=false)=>{
  signal.throwIfAborted();const headers={'User-Agent':'Mozilla/5.0',Accept:json?'application/json':'text/html,application/javascript;q=0.9,*/*;q=0.8'}
  const packet=await wait(Promise.resolve().then(async()=>{if(options.fetchPage)return options.fetchPage(url,{signal,headers});const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(25000)]),response=await fetch(url,{signal:requestSignal,headers,redirect:'manual'}),body=await response.text();requestSignal.throwIfAborted();return{status:response.status,url:response.url,body,capturedAt:new Date().toISOString()}}));signal.throwIfAborted()
  check(packet?.status===200&&packet.url===url,'current native HTTP status/final URL identity changed at '+url)
  check(typeof packet.body==='string'&&Buffer.byteLength(packet.body)<=3000000,'native body invalid or oversized')
  const observed={url,finalUrl:packet.url,status:packet.status,sha256:createHash('sha256').update(packet.body).digest('hex'),capturedAt:Object.getOwnPropertyDescriptor(packet,'capturedAt')?.value||null};responses.push(observed)
  if(options.onResponse)await wait(Promise.resolve().then(()=>options.onResponse({...observed,body:packet.body})));signal.throwIfAborted()
  if(!json)return packet.body
  try{return JSON.parse(packet.body)}catch{throw Error('Bikayi current native JSON invalid')}
 }
 const binding=async()=>{const assets=corporate(await read(HOME),await read(TERMS),await read(CAREERS));const bodies=[];for(const asset of assets)bodies.push(await read(asset));client(bodies);return assets}
 const openingAssets=await binding(),opening=listing(await read(ACTIVE,true)),observedDetails=[],failures=[]
 for(const row of opening){try{observedDetails.push(full(row,await read(ORIGIN+'/careers/jobdetails/'+row.id)))}catch(error){signal.throwIfAborted();failures.push({stage:'native-detail',nativeJobId:String(row.id),message:error.message})}}
 const closing=listing(await read(ACTIVE,true)),closingAssets=await binding(),closingByID=new Map(closing.map(row=>[String(row.id),row]))
 const qualified=[]
 for(const job of observedDetails){
  try{const row=closingByID.get(job.jobId);check(row&&model(row)===model(job.sourceNativeRecord),'native role removed or full model changed at closing')
   const closingJob=full(row,await read(job.sourceUrl));check(closingJob.jobDescription===job.jobDescription&&closingJob.country===job.country,'full public criteria/country changed at closing');qualified.push(job)
  }catch(error){signal.throwIfAborted();failures.push({stage:'closing-detail',nativeJobId:job.jobId,message:error.message})}
 }
 const final=listing(await read(ACTIVE,true)),finalByID=new Map(final.map(row=>[String(row.id),row]))
 const stable=opening.length===closing.length&&closing.length===final.length&&opening.every(row=>model(row)===model(closingByID.get(String(row.id))||{})&&model(row)===model(finalByID.get(String(row.id))||{}))&&JSON.stringify(openingAssets)===JSON.stringify(closingAssets)
 const current=qualified.filter(job=>{if(model(finalByID.get(job.jobId)||{})===model(job.sourceNativeRecord))return true;failures.push({stage:'closing-membership',nativeJobId:job.jobId,message:'native role removed or full model changed during the closing full-detail pass'});return false})
 const unknown=observedDetails.filter(job=>!job.country),exclusions=current.filter(job=>job.country&&job.country!=='India').map(job=>({id:job.jobId,country:job.country,reason:'explicit native non-India worksite'})),india=current.filter(job=>job.country==='India'),jobs=options.maxJobs==null||options.maxJobs===0?india:india.slice(0,options.maxJobs)
 const complete=stable&&!failures.length&&!unknown.length&&jobs.length===india.length
 const audit={source:'bikayi',currentEmployer:'BIK',historicalBrandOwner:'Bikayi, Inc.',observedListingCount:opening.length,observedIndiaListingCount:india.length,unknownCountryListingCount:unknown.length,
  candidateDetails:opening.length,extractedDetailJobs:jobs.length,extractedFullDetailCount:observedDetails.length,nonIndiaListingCount:exclusions.length,exclusions,failures,
  observedDetails,unknownCountries:unknown.map(job=>({id:job.jobId,typed:job.sourceNativeRecord.jobLocations,labels:job.sourceNativeWorkplaceLabels,conflict:job.sourceNativeCountryConflict})),
  opening:opening.map(row=>({id:String(row.id),title:row.title})),closingBeforeDetails:closing.map(row=>({id:String(row.id),title:row.title})),closing:final.map(row=>({id:String(row.id),title:row.title})),finalInventoryReadAfterDetails:true,closingInventoryMatches:stable,listingPaginationComplete:true,
  sourceScopeComplete:complete,sourceDeclaredBoardScopeComplete:complete,sourceCompanyWideScopeComplete:false,sourceLifecycleCleanupVerified:false,responses,jobs:jobs.map(job=>({id:job.jobId}))}
 for(const job of jobs)Object.assign(job,{scrapedAt:new Date().toISOString(),sourceListingComplete:complete})
 if(jobs.length)jobs[0].nativeCollectionEvidence={...audit,observedDetails:observedDetails.map(job=>({id:job.jobId,country:job.country,sourceUrl:job.sourceUrl}))}
 attachInventoryEvidence(jobs,{firstParty:true,surface:CAREERS,status:complete?(opening.length?'complete-inventory':'verified-empty'):'coverage-gap',listingComplete:complete,pagesFetched:responses.length,
  reportedTotal:opening.length,indiaFacetCount:unknown.length?null:india.length,verifiedAt:new Date().toISOString(),reason:`Current BIK careers client declares complete anonymous Keka active array; original full public criteria/date proof=${observedDetails.length}/${opening.length}; closing=${stable}; unknown native worksite countries=${unknown.length}; failures=${failures.length}; no company-wide/lifecycle claim`})
 if(options.onAudit)await wait(Promise.resolve().then(()=>options.onAudit(audit)))
 signal.throwIfAborted();return jobs
}
