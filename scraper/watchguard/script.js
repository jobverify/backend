import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {decodeHTML} from 'entities'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {createPublishingGapAtsScraper} from '../../scraper-support/utils/publishingGapAts.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createWatchguardTransport} from './transport20261111.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

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
const quoted=new Set(['blockquote','q','pre','code','aside'])
function activeDocument(html){
 const original=readNativeDocument(html),root=original.nodes(node=>node.tag==='root')[0]
 const nodes=(predicate,subtree=root)=>{
  const found=[],visit=node=>{if(node.inert||quoted.has(node.tag))return;if(predicate(node))found.push(node);for(const child of node.children)if(typeof child!=='string')visit(child)}
  visit(subtree);return found
 }
 const text=node=>{const value=node=>typeof node==='string'?valueText(node):node.inert||quoted.has(node.tag)||node.tag==='script'?'':node.children.map(value).join(' ');return norm(value(node))}
 const valueText=value=>decodeHTML(value)
 return{...original,nodes,text}
}
const contentKey=html=>{const doc=activeDocument(html);return doc.text(doc.nodes(node=>node.tag==='root')[0]).replace(/\s/g,'')}
const countryPatterns=(()=>{
 const names=new Set();for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const name=nativeCountryName(String.fromCharCode(a,b));if(name&&name.length>2)names.add(name)}
 return [...names].map(name=>[name,new RegExp('(?<![\\p{L}\\p{N}])'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}\\p{N}])','iu')])
})()
const writtenCountries=value=>countryPatterns.filter(([,pattern])=>pattern.test(value)).map(([name])=>name)
function criteriaBlocks(root){
 const ignored=new Set(['blockquote','q','pre','code','template','script','style','title'])
 const boundary=new Set(['address','article','aside','body','br','caption','dd','details','div','dl','dt','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header','hr','li','main','nav','ol','p','section','summary','table','tbody','td','th','thead','tr','ul'])
 const blocks=[];let current=''
 const flush=()=>{const value=norm(decodeHTML(current));if(value)blocks.push(value);current=''}
 const visit=node=>{
  if(typeof node==='string'){current+=node+' ';return}
  if(node.inert||ignored.has(node.tag)){flush();blocks.push(null);return}
  const block=boundary.has(node.tag);if(block)flush();for(const child of node.children)visit(child);if(block)flush();else current+=' '
 }
 visit(root);flush();return blocks
}
const fieldValues=(blocks,pattern)=>{
 const result=[]
 for(let index=0;index<blocks.length;index++){
  if(!blocks[index])continue;const match=pattern.exec(blocks[index]);if(!match)continue
  if(match[1]?.trim()){result.push(match[1].trim());continue}
  const next=blocks[index+1]===':'?blocks[index+2]:blocks[index+1]
  if(next&&!/^(?:(?:Job|Work|Role|Legal)\s+)?(?:Employer|Hiring Organization|Organization Name|Company Name|Company|Location|Country|Workplace|Title|Department|Responsibilities|Qualifications)\s*:?$/i.test(next)&&!/^[\p{L}][\p{L} /-]{0,60}\s*:/u.test(next))result.push(next)
 }
 return result
}
function validateCriteriaDeclarations(root,country){
 const blocks=criteriaBlocks(root),key=value=>norm(value).replace(/[^\p{L}\p{N}]/gu,'').toLowerCase(),own=value=>['watchguard','watchguardtechnologies','watchguardtechnologiesinc'].includes(key(value))
 const employers=fieldValues(blocks,/^(?:(?:Legal|Hiring)\s+)?(?:Employer|Organization Name|Company Name|Company|Organization)\s*(?::\s*(.*))?$/i)
 for(const line of blocks.filter(Boolean)){
  for(const match of line.matchAll(/\b(?:you (?:will be|are) employed by|your employer (?:is|will be))\s+([^.!?]+)(?:[.!?]|$)/gi))employers.push(match[1])
  for(const match of line.matchAll(/(?:^|[.!?]\s+)([^.!?]+?)\s+is your employer\b/gi))employers.push(match[1])
 }
 requireNative(employers.every(own),'active own criteria employer conflict')
 const segments=[''];for(const line of blocks){if(line===null)segments.push('');else segments[segments.length-1]+=' '+line}
 requireNative(!segments.some(value=>/\bWatchGuard(?:\s+Technologies)?(?:[,\s]*Inc\.?)?(?![\p{L}\p{N}]).{0,60}(?:is not|isn['\u2019]t|will not be|won['\u2019]t be).{0,40}employer\b|\b(?:not|won['\u2019]t|aren['\u2019]t|isn['\u2019]t)\s+(?:be\s+)?(?:employed by|(?:an?\s+)?employee of)\s+WatchGuard(?:\s+Technologies)?(?:[,\s]*Inc\.?)?(?![\p{L}\p{N}])/iu.test(value)),'active own criteria employer denial')
 const workplaces=fieldValues(blocks,/^(?:(?:Job|Work|Role)\s+)?(?:Location|Country|Workplace)\s*(?::\s*(.*))?$/i)
 for(const line of blocks){const match=/^(?:This|The) (?:role|position|job) (?:is|will be) (?:based|located) in\s+(.+)$/i.exec(line);if(match)workplaces.push(match[1])}
 const observations=workplaces.map(raw=>({raw,writtenCountries:writtenCountries(raw)}))
 return{observations,issues:observations.filter(value=>value.writtenCountries.some(name=>name!==country)||new RegExp('\\b(?:not|non)[-\\s]*'+(country||'India')+'\\b','i').test(value.raw)).map(value=>({kind:'own-native-workplace-alternatives-unreconciled',...value,nativePrimaryCountry:country}))}
}

function nativeRoleURL(record){
 requireNative(plain(record)&&typeof record.id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(record.id)&&typeof record.text==='string'&&!!record.text.trim(),'native role identity unavailable')
 const expected=`https://jobs.lever.co/watchguard/${record.id}`
 requireNative(record.hostedUrl===expected&&record.applyUrl===expected+'/apply','native role URL/ID mismatch')
 return expected
}
export function inspectNativeRole(record,page){
 const expected=nativeRoleURL(record)
 const criteriaFields=['opening','description','descriptionBody','salaryDescription','additional','openingPlain','descriptionPlain','descriptionBodyPlain','salaryDescriptionPlain','additionalPlain']
 requireNative(criteriaFields.every(field=>record[field]==null||typeof record[field]==='string'),'unsupported native criteria field shape')
 requireNative(record.lists==null||Array.isArray(record.lists)&&record.lists.every(section=>keys(section,['text','content'])&&['text','content'].every(field=>section[field]==null||typeof section[field]==='string')),'unsupported native list criteria shape')
 requireNative(page?.status===200&&page.url===expected&&/^text\/html\b/i.test(page.contentType||'')&&typeof page.html==='string'&&!!page.html.trim(),'native role HTTP identity or HTML MIME unavailable')
 const doc=activeDocument(page.html),head={titles:doc.nodes(node=>node.tag==='title').map(node=>decodeHTML(node.raw)),metas:doc.nodes(node=>node.tag==='meta').map(node=>node.attrs)},schemas=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json')
 requireNative(schemas.length===1&&!schemas[0].attrs.src&&!Object.hasOwn(schemas[0].attrs,'nomodule'),'native role schema is not unique inline public JSON')
 let schema;try{schema=JSON.parse(schemas[0].raw)}catch{requireNative(false,'native role JSON schema malformed')}
 requireNative(keys(schema,['@context','@type','title','hiringOrganization','jobLocation','employmentType','datePosted','description'])&&schema['@context']==='http://schema.org'&&schema['@type']==='JobPosting','unsupported native role schema/criteria')
 requireNative(keys(schema.hiringOrganization,['@type','name','logo'])&&schema.hiringOrganization['@type']==='Organization'&&schema.hiringOrganization.name===schemaEmployer&&typeof schema.hiringOrganization.logo==='string','native schema hiring employer unverified')
 const ogURLs=head.metas.filter(meta=>meta.property==='og:url'),headlines=doc.nodes(node=>node.tag==='div'&&doc.hasClass(node,'posting-headline'))
 const titles=headlines.flatMap(node=>node.children.filter(child=>typeof child!=='string'&&child.tag==='h2').map(child=>doc.text(child)))
 requireNative(ogURLs.length===1&&ogURLs[0].content===expected&&head.titles.length===1&&norm(head.titles[0])===norm(schemaEmployer+' - '+record.text)&&titles.length===1&&norm(titles[0])===norm(record.text)&&typeof schema.title==='string'&&norm(decodeHTML(schema.title))===norm(record.text),'native schema title/URL/ID publisher binding mismatch')
 requireNative(doc.nodes(node=>node.tag==='a'&&node.attrs.href===record.applyUrl).length>0,'native active role application identity missing')
 requireNative(schema.employmentType===record.categories?.commitment&&typeof schema.employmentType==='string','native employment label conflict')
 const places=Array.isArray(schema.jobLocation)?schema.jobLocation:[schema.jobLocation],labels=[]
 for(const place of places){requireNative(keys(place,['@type','address'])&&place['@type']==='Place'&&keys(place.address,['@type','addressLocality','addressRegion','addressCountry','postalCode'])&&place.address['@type']==='PostalAddress'&&typeof place.address.addressLocality==='string'&&Object.values(place.address).every(value=>value===null||typeof value==='string'),'native schema location/criteria shape unreviewed');labels.push(place.address.addressLocality)
  if(place.address.addressCountry?.trim())requireNative(nativeCountryName(place.address.addressCountry)&&nativeCountryName(place.address.addressCountry)===nativeCountryName(record.country),'native explicit country conflict')
 }
 const nativeLabels=record.categories?.allLocations
 requireNative(Array.isArray(nativeLabels)&&nativeLabels.every(value=>typeof value==='string')&&nativeLabels.includes(record.categories.location)&&isDeepStrictEqual([...labels].map(norm).sort(),[...nativeLabels].map(norm).sort()),'native role location alternatives not reconciled')
 requireNative(typeof schema.description==='string'&&schema.description.trim().length>0,'native schema full criteria unavailable')
 // The publisher may put role criteria in its salary-description section.
 // Retain the complete original own schema, and require every original feed
 // criteria section to remain visible on that same own page and in its schema.
 const visibleSections=doc.nodes(node=>['job-description','salary-range','closing-description'].includes(node.attrs['data-qa'])
  ||node.tag==='div'&&doc.hasClass(node,'section')&&doc.hasClass(node,'page-centered')&&!node.attrs['data-qa']&&doc.nodes(child=>doc.hasClass(child,'posting-requirements'),node).length>0)
 const visibleKey=visibleSections.map(node=>doc.text(node).replace(/\s/g,'')).join(''),schemaKey=contentKey(schema.description)
 const sections=[record.opening,record.description,record.descriptionBody,...(Array.isArray(record.lists)?record.lists.flatMap(section=>[section.text,section.content]):[]),record.salaryDescription,record.additional]
 const criteria=sections.filter(value=>typeof value==='string'&&value.trim()).map(contentKey).filter(Boolean)
 requireNative(criteria.length>0&&criteria.join('').length>=100&&criteria.every(value=>schemaKey.includes(value)&&visibleKey.includes(value)),'native full criteria sections missing from own schema/visible description')
 const plainCriteria=['openingPlain','descriptionPlain','descriptionBodyPlain','salaryDescriptionPlain','additionalPlain'].map(field=>record[field]).filter(value=>typeof value==='string'&&value.trim()).map(value=>norm(value).replace(/\s/g,''))
 requireNative(plainCriteria.every(value=>schemaKey.includes(value)&&visibleKey.includes(value)),'native plain criteria sections missing from own schema/visible description')
 const schemaDoc=readNativeDocument(schema.description),schemaRoot=schemaDoc.nodes(node=>node.tag==='root')[0]
 const workplaceProofs=[{field:'original-schema-description',...validateCriteriaDeclarations(schemaRoot,nativeCountryName(record.country))},
  ...visibleSections.map((section,index)=>({field:'own-visible-criteria-section-'+index,...validateCriteriaDeclarations(section,nativeCountryName(record.country))}))]
 requireNative(record.createdAt==null||Number.isSafeInteger(record.createdAt),'native creation metadata is not milliseconds')
 // Read publication only after exact role URL/ID/title/employer binding. This
 // publisher supplies a calendar day, not a publication time or timezone.
 requireNative(schema.datePosted==null||exactDay(schema.datePosted),'native datePosted calendar/precision unsupported')
 return {jobId:record.id,title:record.text,company:COMPANY,source:SOURCE,country:null,location:record.categories.location,
  postingDate:schema.datePosted??null,sourcePublicationPrecision:schema.datePosted==null?null:'date-only',nativeCreatedAt:record.createdAt??null,
  sourceNativeRecord:structuredClone(record),sourceNativeSchema:structuredClone(schema),sourceNativeSchemaJSON:schemas[0].raw,sourceNativeHiringOrganization:structuredClone(schema.hiringOrganization),
  sourceNativeEmploymentType:schema.employmentType,sourceNativeLocationAlternatives:structuredClone(record.categories.allLocations),sourceNativeSchemaLocations:structuredClone(schema.jobLocation),
  sourceNativeCriteriaWorkplaces:workplaceProofs,sourceNativeCriteriaCountryIssues:workplaceProofs.flatMap(proof=>proof.issues.map(issue=>({field:proof.field,...issue}))),
  jobDescription:schema.description,sourceUrl:record.hostedUrl,applyUrl:record.applyUrl,
  publicationProof:{jobId:record.id,url:expected,status:page.status,title:schema.title,hiringOrganization:structuredClone(schema.hiringOrganization),datePosted:schema.datePosted??null,precision:schema.datePosted==null?null:'date-only',nativeTextSha256:sha(page.html)},
  fullSourceDetailQualified:false}
}

export async function run(options={}){
 requireNative(!options.fetchJson&&!options.fetchText&&!options.fetchPage&&options.maxJobs==null&&options.maxPages==null,'native HTTP metadata required; body-only overrides/caps unsupported')
 const {signal,onAudit}=options,receipts=[],session=createWatchguardTransport(options,receipts),request=session.read
 try{
 const openingResponse=await request(NATIVE_API_URL,'json');let originalOpening;try{originalOpening=JSON.parse(openingResponse.text)}catch{requireNative(false,'native opening JSON malformed')}
 requireNative(Array.isArray(originalOpening),'native opening array unavailable')
 requireNative(new Set(originalOpening.map(record=>record?.id)).size===originalOpening.length,'duplicate native opening UUIDs')
 // The CURRENT strongest Lever engine consumes the ORIGINAL full array. The
 // source neither prepares/rebuilds its feed nor resolves country alternatives.
 const strong=await session.race(()=>createPublishingGapAtsScraper(provider).run({fetchJson:async url=>{requireNative(url===NATIVE_API_URL,'unexpected Lever engine endpoint');return originalOpening},signal:session.signal})),strongestEngineEvidence=readInventoryEvidence(strong)
 const nativeRecords=[],roleSchemas=[]
 for(const record of originalOpening){signal?.throwIfAborted();const url=nativeRoleURL(record),result=await request(url,'html'),role=inspectNativeRole(record,{url:result.receipt.finalUrl,status:result.receipt.status,contentType:result.receipt.contentType,html:result.text});nativeRecords.push(role);roleSchemas.push({jobId:record.id,response:result.receipt,schema:role.sourceNativeSchema,rawSchemaJSON:role.sourceNativeSchemaJSON,publicationProof:role.publicationProof})}
 const closingResponse=await request(NATIVE_API_URL,'json');let originalClosing;try{originalClosing=JSON.parse(closingResponse.text)}catch{requireNative(false,'native closing JSON malformed')}
 requireNative(Array.isArray(originalClosing)&&new Set(originalClosing.map(record=>record?.id)).size===originalClosing.length,'duplicate native closing UUIDs or invalid array')
 requireNative(Array.isArray(originalClosing)&&originalClosing.length===originalOpening.length&&isDeepStrictEqual(new Map(originalOpening.map(row=>[row.id,row])),new Map(originalClosing.map(row=>[row?.id,row]))),'closing original native identity/schema/criteria cohort changed')
 signal?.throwIfAborted();const byId=new Map(nativeRecords.map(row=>[row.jobId,row]))
 const jobs=strong.map(job=>{const role=byId.get(job.jobId);requireNative(!!role,'strong engine role missing validated native provenance');requireNative(role.sourceNativeCriteriaCountryIssues.length===0,'own native candidate country alternatives unresolved');return {...job,jobDescription:role.jobDescription,postingDate:role.postingDate,sourcePublicationPrecision:role.sourcePublicationPrecision,nativeCreatedAt:role.nativeCreatedAt,sourceStrongEngineMappedDate:job.postingDate??null,sourceNativeRecord:role.sourceNativeRecord,sourceNativeSchema:role.sourceNativeSchema,sourceNativeSchemaJSON:role.sourceNativeSchemaJSON,sourceNativeHiringOrganization:role.sourceNativeHiringOrganization,sourceNativeEmploymentType:role.sourceNativeEmploymentType,sourceNativeLocationAlternatives:role.sourceNativeLocationAlternatives,sourceNativeSchemaLocations:role.sourceNativeSchemaLocations,sourceNativeCriteriaWorkplaces:role.sourceNativeCriteriaWorkplaces,sourcePublicationProof:role.publicationProof,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false}})
 const audit={source:SOURCE,productionWrites:false,currentLiveQualification:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,authoritativeSourceTotal:null,authoritativeIndiaFacetCount:null,observedNativeCount:originalOpening.length,originalOpening:structuredClone(originalOpening),originalClosing:structuredClone(originalClosing),nativeArraysReconciled:true,nativeRecords,roleSchemas,detailPassCount:1,noSecondDetailCohortClaimed:true,strongestEngineEvidence,receipts,remainingProofs:['current corporate activation/all hiring channels and native programs/styles','all role-owned country alternatives','second/current native full-detail cohort and current global scope']}
 Object.defineProperty(jobs,'sourceAudit',{value:audit});await session.race(()=>onAudit?.(structuredClone(audit)));session.check()
 attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:nativeRecords.length,observedVacancyCount:nativeRecords.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 return attachInventoryEvidence(jobs,{...strongestEngineEvidence,status:'discovery-only',listingComplete:false,reportedTotal:null,indiaFacetCount:null,reason:'watchguard-publication-provenance-source-scope-unresolved:'+strongestEngineEvidence.reason})
 }finally{session.close()}
}
