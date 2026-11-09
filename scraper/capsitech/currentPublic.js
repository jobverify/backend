import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const PAGE='https://www.capsitech.com/career/',API='https://www.capsitech.com/wp-content/themes/capsitech/api/api-get-career-options.php'
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const check=(ok,message)=>{if(!ok)throw Error('Capsitech public careers: '+message)}
const page=html=>{
 const document=readNativeDocument(html)
 check(activeHead(html).titles.includes('CA | ACCA | Developer and IT Jobs in Jodhpur | Capsitech'),'official careers employer identity changed')
 const canonical=document.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical')
 check(canonical.length===1&&canonical[0].attrs.href===PAGE,'official careers canonical identity changed')
 check(document.nodes(node=>node.tag==='form'&&node.attrs.id==='Carrer_Form').length===1
  &&document.nodes(node=>node.tag==='select'&&node.attrs.id==='Job_Position').length===1,'public application categories contract changed')
 const scripts=document.nodes(node=>node.tag==='script'),key=scripts.filter(node=>!node.attrs.src).flatMap(node=>[...node.raw.matchAll(/window\.RESUME_KEY\s*=\s*['"]([^'"]+)['"]/g)].map(match=>match[1]))
 check(key.length===1,'current public position-options key missing or ambiguous')
 check(scripts.some(node=>node.attrs.src==='https://www.capsitech.com/wp-content/themes/capsitech/assets/js/career.js?v=1.4'),'published public category-loading client identity changed')
 check(!scripts.some(node=>node.attrs.type==='application/ld+json'&&/"@type"\s*:\s*"JobPosting"/.test(node.raw)),'new public role criteria need native qualification')
 return key[0]
}
const categories=payload=>{
 check(payload?.status===true&&Array.isArray(payload?.result?.domainsList)&&Array.isArray(payload.result.qualifications)&&Array.isArray(payload.result.experiences),'native application categories response changed')
 check(Object.keys(payload.result).every(key=>['domainsList','qualifications','experiences'].includes(key)),'new native public criteria contract requires qualification')
 const rows=[]
 for(const group of payload.result.domainsList){check(typeof group?.label==='string'&&Array.isArray(group.domains),'native application categories group invalid')
  for(const row of group.domains){check(typeof row?.id==='string'&&typeof row.name==='string'&&row.name.trim()&&Object.keys(row).every(key=>['id','name'].includes(key)),'native categories contain new public criteria or an invalid identity');rows.push({category:group.label,id:row.id,name:row.name})}}
 check(rows.length>0&&new Set(rows.map(row=>row.id)).size===rows.length,'native application categories missing or duplicated');return rows
}
export async function runCurrentPublicCapsitech(options={}){
 const timeout=Number.isSafeInteger(options.timeoutMs)&&options.timeoutMs>0?options.timeoutMs:90000
 const signal=AbortSignal.any([AbortSignal.timeout(timeout),...(options.signal?[options.signal]:[])])
 const wait=value=>new Promise((resolve,reject)=>{let done=false;const finish=(fn,result)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);fn(result)},abort=()=>finish(reject,signal.reason);signal.addEventListener('abort',abort,{once:true});Promise.resolve(value).then(value=>finish(resolve,value),error=>finish(reject,error));if(signal.aborted)abort()})
 let requests=0
 const read=async(url,json=false)=>{
  signal.throwIfAborted();requests++
  const result=await wait(Promise.resolve().then(async()=>{
   const override=json?options.fetchJson:options.fetchText;if(override)return override(url,{signal})
   const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(25000)]),response=await fetch(url,{signal:requestSignal,redirect:'manual',headers:{'User-Agent':UA,Accept:json?'application/json':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}})
   check(response.status===200&&(!response.url||response.url===url),'HTTP status or native response identity changed at '+url)
   const text=await response.text();requestSignal.throwIfAborted();check(Buffer.byteLength(text)<=2000000,'native response exceeds public page budget');return json?JSON.parse(text):text
  }));signal.throwIfAborted();return result
 }
 const key=page(await read(PAGE)),opening=categories(await read(API+'?resumeKey='+encodeURIComponent(key),true))
 const closingKey=page(await read(PAGE)),closing=categories(await read(API+'?resumeKey='+encodeURIComponent(closingKey),true))
 const stable=JSON.stringify(opening)===JSON.stringify(closing)
 const reason='The current first-party careers page and anonymous GET options publish general application categories and global qualification/experience choices, without vacancy IDs, role-specific country/date/full criteria or public detail URLs. Category stability does not prove an empty vacancy inventory. Application OTP/CAPTCHA/private sessions are outside the public-JD extraction path.'
 const audit={source:'capsitech',observedListingCount:null,observedIndiaListingCount:null,candidateDetails:null,extractedDetailJobs:0,
  observedApplicationCategoryCount:opening.length,observedApplicationCategories:opening,closingApplicationCategoryCount:closing.length,
  closingApplicationCategoriesMatch:stable,closingInventoryMatches:false,listingPaginationComplete:false,sourceScopeComplete:false,
  fullRoleCriteriaPublished:false,applicationCaptchaRequiredForPublicExtraction:false,failures:[{stage:'native-public-criteria',message:reason}],jobs:[]}
 const jobs=attachInventoryEvidence([],{firstParty:true,surface:PAGE,status:'coverage-gap',listingComplete:false,pagesFetched:requests,reportedTotal:null,indiaFacetCount:null,
  verifiedAt:new Date().toISOString(),reason})
 if(options.onAudit)await wait(Promise.resolve().then(()=>options.onAudit(audit)))
 signal.throwIfAborted();return jobs
}
