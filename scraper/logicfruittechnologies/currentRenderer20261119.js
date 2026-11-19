import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'

const SOURCE='logicfruittechnologies',HOME='https://www.logic-fruit.com/'
const PROFILE=JSON.parse(readFileSync(new URL('./currentRendererProfile20261119.json',import.meta.url),'utf8'))
const sha=value=>createHash('sha256').update(value).digest('hex')
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,'Current renderer: '+message)}
const LOCATIONS=new Map([
 ['Gurugram',['Gurugram']],['Gurugram/Bengaluru',['Gurugram','Bengaluru']],
 ['Gurugram / Bengaluru',['Gurugram','Bengaluru']],['Gurugram / Bengaluru (Hybrid)',['Gurugram','Bengaluru']],
])
const KEYS=new Set(['entityType','overview','createdAt','metaKeywords','description','responsibilities','department','order','updatedAt','noIndex',
 'workSchedule','skills','metaDescription','images','slug','title','metaTitle','postedDate','canonicalUrl','status','ogImage','type','qualifications',
 '_id','experience','heroImage','id','location','thumb','workMode','reportingTo'])
const roleURL=row=>HOME+'jobs-current-opening/'+row.slug+'/'

// The exact reviewed im/am/rm/nm/Ki programs select the successful published
// API data and render these own fields. SEO fallback text grants no criteria.
export function qualifyCurrentLogicFruitRecord(row,status){
 need(Object.keys(row).every(key=>KEYS.has(key)),'unreviewed native role field')
 need(row.status==='published'&&row.entityType==='job'&&typeof row.id==='string'
  &&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)&&typeof row.title==='string'&&row.title.trim(),'native identity changed')
 need(LOCATIONS.has(row.location),'whole native location is unqualified')
 for(const key of ['description','overview','responsibilities','qualifications','experience','type','workMode','workSchedule','department'])
  need(typeof row[key]==='string','native '+key+' type changed')
 need(Array.isArray(row.skills)&&row.skills.every(value=>typeof value==='string'),'native skills type changed')
 need(row.overview.trim().length>=100&&row.responsibilities.trim().length>=200&&row.qualifications.trim().length>=150,'full native criteria are incomplete')
 const fields={description:row.description,overview:row.overview,workSchedule:row.workSchedule,
  responsibilities:row.responsibilities,qualifications:row.qualifications,skills:structuredClone(row.skills)}
 const description=[row.description,'Role Overview',row.overview,...(row.workSchedule?['Work Schedule & Flexibility',row.workSchedule]:[]),
  'Key Responsibilities',row.responsibilities,'Qualifications & Requirements',row.qualifications,
  ...(row.skills.length?['Required Skills & Domains',...row.skills]:[])].join('\n')
 need(description.length>=1000&&!/\b(?:full (?:job )?(?:description|criteria) (?:on request|available upon)|coming soon|description to follow)\b/i.test(description),'full native criteria are unavailable')
 const renderedCriteria=[row.title,description].join('\n').replace(/[*_`]/g,'')
 need(!/\b(?:(?:this\s+)?(?:position|role|job)\s+(?:(?:is|was|has\s+been)\s+)?(?:now\s+)?(?:closed|filled|no\s+longer\s+available)|no\s+longer\s+accepting\s+applications|applications\s+(?:(?:are|have\s+been)\s+)?closed)\b/i.test(renderedCriteria),'native role is explicitly closed')
 const employerKey=value=>value.toLowerCase().replace(/[^a-z0-9]/g,'')
 for(const line of renderedCriteria.split(/\r?\n/)){
  for(const match of line.matchAll(/\b(?:work(?:place)?\s+country|job\s+country|country)\s*:\s*([^.;]+)/gi))
   need(/^(?:India|IN)$/i.test(match[1].trim()),'criteria country contradicts native location')
  for(const match of line.matchAll(/\b(?:employer|hiring\s+(?:company|organization))\s*:\s*([^;]+)/gi))
   need(['logicfruittechnologies','logicfruittechnologiesprivatelimited','logicfruittechnologiespvtltd'].includes(employerKey(match[1])),'criteria employer contradicts native publisher')
 }
 const url=roleURL(row)
 need(row.canonicalUrl===''||row.canonicalUrl===new URL(url).pathname||row.canonicalUrl===url,'native own role canonical changed')
 const cities=LOCATIONS.get(row.location)
 return {jobId:row.id,requisitionId:null,title:row.title,company:'Logic Fruit Technologies',legalEmployer:null,source:SOURCE,
  department:row.department||null,location:row.location+', India',city:cities.length===1?cities[0]:null,country:'India',
  sourceCountryScopeUnresolved:false,sourceGeographyEvidence:{kind:'exact-whole-native-municipal-label',nativeLocation:row.location,
   cities:[...cities],country:'India',references:PROFILE.geographyReferences},
  sourceUrl:url,applyUrl:url,link:url,sourceURLHTTPStatus:status,applicationVisited:false,applicationSubmitted:false,
  sourceApplicationHandoff:{kind:'native-own-role-bound-form',url,nativeSlug:row.slug,backendSubmissionVerified:false},
  experienceRequired:row.experience,employmentType:row.type,workplaceType:row.workMode,minimumQualification:row.qualifications,
  preferredQualification:null,requiredSkills:[...row.skills],postingDate:null,closingDate:null,nativeDisplayDate:row.postedDate??null,
  jobDescription:description,sourceDescription:description,sourceNativeCriteriaFields:fields,sourceNativeJobRecord:structuredClone(row),
  sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  companyDomain:'logic-fruit.com',companyCareerPage:HOME+'jobs-current-opening/',atsPlatform:'first-party-declared-native-api'}
}

export function createCurrentLogicFruitRenderer(options){
 const receipts=[],styles=new Map(PROFILE.stylesheets.map(row=>[row.url,row])),roles=new Set(),snapshots=new Map()
 let bytes=0
 async function read(url,kind){
  options.signal?.throwIfAborted()
  need(receipts.length<32&&(kind==='stylesheet'?styles.has(url):url===HOME+'jobs-current-opening/'||roles.has(url)),'unbound or excessive renderer read')
  await delay(500,undefined,{signal:options.signal})
  const acquire=async(requested,init)=>{
   if(options.fetchImpl)return options.fetchImpl(requested,{...init,credentials:'omit',cache:'no-store'})
   if(options.fetchPage){
    const page=await options.fetchPage(requested,{...init,credentials:'omit',cache:'no-store',format:kind})
    need(page&&page.bodyUnavailable!==true&&Number.isInteger(page.status)&&page.headers&&typeof(page.finalUrl??page.url)==='string'&&typeof page.body==='string','original renderer HTTP metadata is required')
    const response=new Response(page.body,{status:page.status,headers:page.headers})
    Object.defineProperty(response,'url',{value:page.finalUrl??page.url})
    return response
   }
   return globalThis.fetch(requested,{...init,credentials:'omit',cache:'no-store'})
  }
  const response=await boundedDeclaredPublicGet(url,{fetchImpl:acquire,signal:options.signal,
   timeoutMs:options.requestTimeoutMs??15000,overflowError:firstPartyFailure(SOURCE,'Renderer response exceeds streaming ceiling')})
  options.signal?.throwIfAborted()
  const body=Buffer.from(response.bodyBase64,'base64');bytes+=body.length
  const receipt={requestedUrl:url,finalUrl:response.url,status:response.status,headers:response.headers,bytes:body.length,
   sha256:sha(body),bodyBase64:response.bodyBase64}
  receipts.push(receipt)
  need(body.length<=1024*1024&&bytes<=4*1024*1024,'renderer entity or aggregate byte budget exceeded')
  need(response.url===url,'renderer final URL identity changed')
  if(kind==='stylesheet'){
   const profile=styles.get(url)
   need(response.status===200&&/^text\/css(?:;|$)/i.test(response.headers['content-type']||''),'stylesheet original HTTP status or MIME changed')
   need(body.length===profile.bytes&&receipt.sha256===profile.sha256,'whole authored or font stylesheet changed')
  }else{
   // The publisher serves this exact working SPA shell with HTTP404 on its
   // declared public job routes. Preserve404; no response is rewritten to200.
   need([200,404].includes(response.status)&&/^text\/html(?:;|$)/i.test(response.headers['content-type']||''),'own route original HTTP status or MIME changed')
   need(receipt.sha256===PROFILE.homeSHA256,'own route is not the exact reviewed active SPA shell')
  }
  return receipt
 }
 return {
  async authority(authority){
   need(authority.homepageSHA256===PROFILE.homeSHA256&&authority.client.sha256===PROFILE.clientSHA256,'whole reviewed renderer authority changed')
   for(const style of PROFILE.stylesheets)await read(style.url,'stylesheet')
   await read(HOME+'jobs-current-opening/','shell')
  },
  async role(row,snapshot){
   qualifyCurrentLogicFruitRecord(row,null)
   const url=roleURL(row);roles.add(url)
   const page=await read(url,'shell'),model={url,status:page.status,sha256:page.sha256}
   if(snapshot==='opening')snapshots.set(row.id,model)
   else need(JSON.stringify(snapshots.get(row.id))===JSON.stringify(model),'own route changed at closing')
   return qualifyCurrentLogicFruitRecord(row,page.status)
  },
  stats:()=>({receipts:structuredClone(receipts),requests:receipts.length,decodedBytes:bytes,
   declaredRendererProfile:PROFILE,browserEquivalenceComplete:false,applicationSubmitted:false}),
 }
}
