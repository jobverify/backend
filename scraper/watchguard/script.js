import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {composeLeverDescription} from '../../scraper-support/utils/leverDescription.js'
import {createPublishingGapAtsScraper} from '../../scraper-support/utils/publishingGapAts.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const SOURCE='watchguard'
export const COMPANY='WatchGuard Technologies'
export const CAREERS_URL='https://www.watchguard.com/wgrd-careers'
export const NATIVE_API_URL='https://api.lever.co/v0/postings/watchguard?mode=json'
const schemaEmployer='WatchGuard Technologies, Inc.'
const provider={source:SOURCE,companyName:COMPANY,atsPlatform:'lever',boardToken:'watchguard',companyCareerPage:CAREERS_URL,countryFilter:'India',sourceScopeComplete:false,lifecycleCleanupAllowed:false}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),norm=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const keys=(object,allowed)=>plain(object)&&Object.keys(object).every(key=>allowed.includes(key))
const requireNative=(ok,message)=>{if(!ok){const error=Error('[watchguard] '+message);Object.assign(error,{abortRetries:true,failureKind:'native_contract_unverified'});throw error}}
const exactDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value

function nativeRoleURL(record){
 requireNative(plain(record)&&typeof record.id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(record.id)&&typeof record.text==='string'&&!!record.text.trim(),'native role identity unavailable')
 const expected=`https://jobs.lever.co/watchguard/${record.id}`
 requireNative(record.hostedUrl===expected&&record.applyUrl===expected+'/apply','native role URL/ID mismatch')
 return expected
}
export function inspectNativeRole(record,page){
 const expected=nativeRoleURL(record)
 requireNative(page?.status===200&&page.url===expected&&/^text\/html\b/i.test(page.contentType||'')&&typeof page.html==='string'&&!!page.html.trim(),'native role HTTP identity or HTML MIME unavailable')
 const doc=readNativeDocument(page.html),head=activeHead(page.html),schemas=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json')
 requireNative(schemas.length===1&&!schemas[0].attrs.src&&!Object.hasOwn(schemas[0].attrs,'nomodule'),'native role schema is not unique inline public JSON')
 let schema;try{schema=JSON.parse(schemas[0].raw)}catch{requireNative(false,'native role JSON schema malformed')}
 requireNative(keys(schema,['@context','@type','title','hiringOrganization','jobLocation','employmentType','datePosted','description'])&&schema['@context']==='http://schema.org'&&schema['@type']==='JobPosting','unsupported native role schema/criteria')
 requireNative(keys(schema.hiringOrganization,['@type','name','logo'])&&schema.hiringOrganization['@type']==='Organization'&&schema.hiringOrganization.name===schemaEmployer&&typeof schema.hiringOrganization.logo==='string','native schema hiring employer unverified')
 const ogURLs=head.metas.filter(meta=>meta.property==='og:url'),headlines=doc.nodes(node=>node.tag==='div'&&doc.hasClass(node,'posting-headline'))
 const titles=headlines.flatMap(node=>node.children.filter(child=>typeof child!=='string'&&child.tag==='h2').map(child=>doc.text(child)))
 requireNative(ogURLs.length===1&&ogURLs[0].content===expected&&head.titles.length===1&&norm(head.titles[0])===norm(schemaEmployer+' - '+record.text)&&titles.length===1&&norm(titles[0])===norm(record.text)&&norm(schema.title)===norm(record.text),'native schema title/URL/ID publisher binding mismatch')
 requireNative(doc.nodes(node=>node.tag==='a'&&node.attrs.href===record.applyUrl).length>0,'native active role application identity missing')
 requireNative(schema.employmentType===record.categories?.commitment&&typeof schema.employmentType==='string','native employment label conflict')
 const places=Array.isArray(schema.jobLocation)?schema.jobLocation:[schema.jobLocation],labels=[]
 for(const place of places){requireNative(keys(place,['@type','address'])&&place['@type']==='Place'&&keys(place.address,['@type','addressLocality','addressRegion','addressCountry','postalCode'])&&place.address['@type']==='PostalAddress'&&typeof place.address.addressLocality==='string'&&Object.values(place.address).every(value=>value===null||typeof value==='string'),'native schema location/criteria shape unreviewed');labels.push(place.address.addressLocality)}
 const nativeLabels=record.categories?.allLocations
 requireNative(Array.isArray(nativeLabels)&&nativeLabels.every(value=>typeof value==='string')&&nativeLabels.includes(record.categories.location)&&isDeepStrictEqual([...labels].map(norm).sort(),[...nativeLabels].map(norm).sort()),'native role location alternatives not reconciled')
 requireNative(typeof schema.description==='string'&&schema.description.trim().length>0,'native schema full criteria unavailable')
 requireNative(record.createdAt==null||Number.isSafeInteger(record.createdAt),'native creation metadata is not milliseconds')
 // Read publication only after exact role URL/ID/title/employer binding. This
 // publisher supplies a calendar day, not a publication time or timezone.
 requireNative(schema.datePosted==null||exactDay(schema.datePosted),'native datePosted calendar/precision unsupported')
 return {jobId:record.id,title:record.text,company:COMPANY,source:SOURCE,country:null,location:record.categories.location,
  postingDate:schema.datePosted??null,sourcePublicationPrecision:schema.datePosted==null?null:'date-only',nativeCreatedAt:record.createdAt??null,
  sourceNativeRecord:structuredClone(record),sourceNativeSchema:structuredClone(schema),sourceNativeSchemaJSON:schemas[0].raw,sourceNativeHiringOrganization:structuredClone(schema.hiringOrganization),
  sourceNativeEmploymentType:schema.employmentType,sourceNativeLocationAlternatives:structuredClone(record.categories.allLocations),sourceNativeSchemaLocations:structuredClone(schema.jobLocation),
  jobDescription:composeLeverDescription(record),sourceUrl:record.hostedUrl,applyUrl:record.applyUrl,
  publicationProof:{jobId:record.id,url:expected,status:page.status,title:schema.title,hiringOrganization:structuredClone(schema.hiringOrganization),datePosted:schema.datePosted??null,precision:schema.datePosted==null?null:'date-only',nativeTextSha256:sha(page.html)},
  fullSourceDetailQualified:false}
}

export async function run(options={}){
 requireNative(!options.fetchJson&&!options.fetchText&&!options.fetchPage&&options.maxJobs==null&&options.maxPages==null,'native HTTP metadata required; body-only overrides/caps unsupported')
 const {fetchImpl=fetch,signal,onAudit}=options,receipts=[]
 async function request(url,kind){
  signal?.throwIfAborted();const receipt={url,method:'GET',requestedAt:new Date().toISOString(),kind};receipts.push(receipt)
  const deadline=signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)
  try{const response=await fetchImpl(url,{method:'GET',redirect:'manual',headers:{Accept:kind==='json'?'application/json':'text/html','User-Agent':'Mozilla/5.0 (compatible; Jobverify native provenance)'},signal:deadline});deadline.throwIfAborted()
   const bytes=Buffer.from(await response.clone().arrayBuffer()),text=await response.text();deadline.throwIfAborted()
   Object.assign(receipt,{status:response.status,finalUrl:response.url,contentType:response.headers.get('content-type'),bytes:bytes.length,sha256:sha(bytes),nativeTextSha256:sha(text),observedAt:new Date().toISOString()})
   requireNative(response.status===200&&response.url===url&&bytes.length>0&&bytes.length<12000000,'native HTTP status/URL/body changed')
   requireNative((kind==='json'?/^application\/json\b/i:/^text\/html\b/i).test(receipt.contentType||''),'native HTTP content type changed')
   return {text,receipt}
  }catch(error){receipt.error=error.message;signal?.throwIfAborted();throw error}
 }
 const openingResponse=await request(NATIVE_API_URL,'json');let originalOpening;try{originalOpening=JSON.parse(openingResponse.text)}catch{requireNative(false,'native opening JSON malformed')}
 requireNative(Array.isArray(originalOpening),'native opening array unavailable')
 // The CURRENT strongest Lever engine consumes the ORIGINAL full array. The
 // source neither prepares/rebuilds its feed nor resolves country alternatives.
 const strong=await createPublishingGapAtsScraper(provider).run({fetchJson:async url=>{requireNative(url===NATIVE_API_URL,'unexpected Lever engine endpoint');return originalOpening},signal}),strongestEngineEvidence=readInventoryEvidence(strong)
 const nativeRecords=[],roleSchemas=[]
 for(const record of originalOpening){signal?.throwIfAborted();const url=nativeRoleURL(record),result=await request(url,'html'),role=inspectNativeRole(record,{url:result.receipt.finalUrl,status:result.receipt.status,contentType:result.receipt.contentType,html:result.text});nativeRecords.push(role);roleSchemas.push({jobId:record.id,response:result.receipt,schema:role.sourceNativeSchema,rawSchemaJSON:role.sourceNativeSchemaJSON,publicationProof:role.publicationProof})}
 const closingResponse=await request(NATIVE_API_URL,'json');let originalClosing;try{originalClosing=JSON.parse(closingResponse.text)}catch{requireNative(false,'native closing JSON malformed')}
 requireNative(Array.isArray(originalClosing)&&originalClosing.length===originalOpening.length&&isDeepStrictEqual(new Map(originalOpening.map(row=>[row.id,row])),new Map(originalClosing.map(row=>[row?.id,row]))),'closing original native identity/schema/criteria cohort changed')
 signal?.throwIfAborted();const byId=new Map(nativeRecords.map(row=>[row.jobId,row]))
 const jobs=strong.map(job=>{const role=byId.get(job.jobId);requireNative(!!role,'strong engine role missing validated native provenance');return {...job,postingDate:role.postingDate,sourcePublicationPrecision:role.sourcePublicationPrecision,nativeCreatedAt:role.nativeCreatedAt,sourceStrongEngineMappedDate:job.postingDate??null,sourceNativeRecord:role.sourceNativeRecord,sourceNativeSchema:role.sourceNativeSchema,sourceNativeSchemaJSON:role.sourceNativeSchemaJSON,sourceNativeHiringOrganization:role.sourceNativeHiringOrganization,sourceNativeEmploymentType:role.sourceNativeEmploymentType,sourceNativeLocationAlternatives:role.sourceNativeLocationAlternatives,sourceNativeSchemaLocations:role.sourceNativeSchemaLocations,sourcePublicationProof:role.publicationProof,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false}})
 const audit={source:SOURCE,productionWrites:false,currentLiveQualification:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,authoritativeSourceTotal:null,authoritativeIndiaFacetCount:null,observedNativeCount:originalOpening.length,originalOpening:structuredClone(originalOpening),originalClosing:structuredClone(originalClosing),nativeArraysReconciled:true,nativeRecords,roleSchemas,detailPassCount:1,noSecondDetailCohortClaimed:true,strongestEngineEvidence,receipts,remainingProofs:['current corporate activation/all hiring channels and native programs/styles','all role-owned country alternatives','second/current native full-detail cohort and current global scope']}
 Object.defineProperty(jobs,'sourceAudit',{value:audit});await onAudit?.(structuredClone(audit));signal?.throwIfAborted()
 return attachInventoryEvidence(jobs,{...strongestEngineEvidence,status:'discovery-only',listingComplete:false,reportedTotal:null,indiaFacetCount:null,reason:'watchguard-publication-provenance-source-scope-unresolved:'+strongestEngineEvidence.reason})
}
