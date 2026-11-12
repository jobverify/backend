import {createHash} from 'node:crypto'
import {certifyLeverRequestMetadata,IMMUTA_INTAKE_SERVER_PUBLICATION_PROFILE} from '../../scraper-support/utils/leverRequestMetadataCertificate.js'
import {isDeepStrictEqual,types} from 'node:util'
import {decodeHTML} from 'entities'
import {readNativeDocument,readNativeAttributeTokens,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {NATIVE_INDIA_LOCATION} from '../../scraper-support/utils/greenhouseLocations.js'
import {validatePublicPostingScope} from '../../scraper-support/utils/publishingGapAts.js'
export {IMMUTA_INTAKE_SERVER_PUBLICATION_PROFILE}

export const CORPORATE='https://www.immuta.com/careers'
export const GROUPED='https://api.lever.co/v0/postings/immuta?mode=json&group=department'
export const FLAT='https://api.lever.co/v0/postings/immuta?mode=json'
export const INTAKE='https://jobs.lever.co/immuta/4372d3ba-00d6-4ae0-986c-e65d8dbf9def'
export const CLIENT_SHA256='a5cf2c980382bf14ba3b92676e80ce444c4cd491832092644ddd6d2737ef9aa4'
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const failure=message=>Object.assign(new Error('Immuta programme: '+message),{softFailure:true,abortRetries:true,upstreamOutage:false,failureKind:'coverage_gap'})
const need=(value,message)=>{if(!value)throw failure(message)}
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const entriesOf=document=>{const entries=[];const visit=(node,ancestors=[])=>{if(typeof node==='string')return;entries.push({node,ancestors});for(const child of node.children)visit(child,[...ancestors,node])};for(const root of document.nodes(n=>n.tag==='root'))visit(root);return entries}
const active=entry=>!entry.node.inert&&!['svg','math'].includes(entry.node.tag)&&!entry.ancestors.some(n=>n.inert||['svg','math','template','noscript','object','iframe'].includes(n.tag))

export function readImmutaCorporate(html){
 // Complete current native corporate declaration, not a guessed account or a
 // generic hidden-mount exception. Any changed byte is an unreviewed profile.
 need(sha(html)==='3f765489b1b181bb5e7cf75f59cad31cbcfd230f7f28b36ada1fbd41d45a62fa','Current corporate/consumer whole profile changed')
 const document=readNativeDocument(html),entries=entriesOf(document),head=activeHead(html)
 need(isDeepStrictEqual(head.titles,['Start Building Your Career | Immuta']),'Current corporate publisher/title changed')
 const clients=entries.filter(e=>e.node.tag==='script'&&e.node.raw?.includes('api.lever.co/v0/postings/'))
 need(clients.length===1&&active(clients[0])&&!Object.hasOwn(clients[0].node.attrs,'src')&&sha(clients[0].node.raw)===CLIENT_SHA256,'Exact active grouped consumer changed')
 for(const id of['open-positions-list','no-open-positions','positions-location-filter','positions-department-filter']){
  const found=entries.filter(e=>e.node.attrs.id===id);need(found.length===1&&active(found[0]),'Unique current consumer mount/control changed: '+id)
 }
 for(const id of['positions-location-filter','positions-department-filter']){
  const select=entries.find(e=>e.node.attrs.id===id).node,options=select.children.filter(c=>typeof c!=='string'&&c.tag==='option')
  need(select.tag==='select'&&options.length===4&&options[0].attrs.value==='all'&&!options.some(n=>Object.hasOwn(n.attrs,'selected')),'Current default unfiltered control changed')
 }
 const links=entries.filter(e=>active(e)&&e.node.tag==='a'&&e.node.attrs.href===INTAKE)
 need(links.length===1,'Current separately advertised intake declaration changed')
 return{publisherBrand:'Immuta',publisherTitle:head.titles[0],corporateBodySHA256:sha(html),inlineClientSHA256:CLIENT_SHA256,declaredGroupedAPI:GROUPED,advertisedIntake:INTAKE,initialFilter:'all',initialRender:'Every flattened grouped posting',loadingDeclaration:'The exact inline client removes .loading on both success and error; no browser/CSS execution or visible-row proof is claimed.',fullHTML:html}
}

const allowed=new Set(['additional','additionalPlain','applyUrl','categories','country','createdAt','description','descriptionBody','descriptionBodyPlain','descriptionPlain','hostedUrl','id','lists','opening','openingPlain','salaryDescription','salaryDescriptionPlain','salaryRange','text','workplaceType'])
const htmlFields=['opening','description','descriptionBody','additional'],plainFields=htmlFields.map(k=>k+'Plain')
const locationCountry=new Map([['London','GB'],['New York, NY','US'],['California','US'],['Remote USA','US'],['College Park, MD | Columbus, OH | Boston, MA','US']])
const authoredTags=new Set(['div','p','ul','li','strong','br','em','span','h2'])
const blocks=new Set(['div','p','ul','li','br','h2'])
const attributeValues=new Map([
 ['div@data-qa',new Set(['closing-description','ai-disclaimer'])],['p@data-start',new Set(['725','1038'])],['p@data-end',new Set(['1036','1308'])],
 ['strong@data-start',new Set(['725','972'])],['strong@data-end',new Set(['743','985'])],['strong@style',new Set(['font-size: 18px;'])],
 ['br@aria-hidden',new Set(['true'])],['span@style',new Set(['font-size: 10px;','font-size: 15px;','font-size: 16px;'])],['ul@style',new Set(['list-style-type: disc;'])],['em@style',new Set(['font-size: 15px;'])]
])
const authoredText=html=>{
 need(typeof html==='string','Native authored HTML must be a string')
 const tags=/<\/?([A-Za-z][A-Za-z0-9:-]*)([^<>]*)>/g
 need(!html.replace(tags,'').includes('<'),'Unreviewed authored markup/carrier')
 for(const match of html.matchAll(tags)){
  const tag=match[1].toLowerCase();need(authoredTags.has(tag),'Unreviewed authored HTML tag/criteria carrier')
  if(match[0].startsWith('</')){need(!match[2].trim(),'Malformed authored closing tag');continue}
  const seen=new Set()
  for(const[key,value]of readNativeAttributeTokens(match[2])){need(!seen.has(key)&&attributeValues.get(tag+'@'+key)?.has(value),'Unreviewed/duplicate authored attribute/style/visibility');seen.add(key)}
 }
 const document=readNativeDocument(html),root=document.nodes(n=>n.tag==='root')[0]
 const text=node=>{if(node.tag==='br'&&Object.keys(node.attrs).length===1&&node.attrs['aria-hidden']==='true'&&node.children.length===0)return ' ';need(!node.inert&&(node.tag==='root'||authoredTags.has(node.tag)),'Unreviewed authored visibility model');const s=node.children.map(child=>typeof child==='string'?decodeHTML(child):text(child)).join('');return blocks.has(node.tag)?' '+s+' ':s}
 return text(root)
}
const checkAuthored=(row)=>{
 const strings=[decodeHTML(row.text),...plainFields.map(k=>decodeHTML(row[k])),...htmlFields.map(k=>authoredText(row[k])),...row.lists.flatMap(l=>[decodeHTML(l.text),authoredText(l.content)])]
 if(Object.hasOwn(row,'salaryDescription'))strings.push(authoredText(row.salaryDescription),decodeHTML(row.salaryDescriptionPlain))
 need(strings.some(s=>s.trim().length>100),'Complete original published native criteria missing')
 need([authoredText(row.descriptionBody),...row.lists.map(list=>authoredText(list.content))].some(text=>text.trim().length>=100),'Published role-specific criteria unavailable; company overview alone is insufficient')
 // This is a zero-only uncertainty signal. No city, employer, country or
 // applicant eligibility is inferred from these authored words.
 need(!strings.some(s=>NATIVE_INDIA_LOCATION.test(s)||/\b(?:work(?:ing)?\s+(?:country|location)|applicant\s+(?:country|location))\s*:/i.test(s)),'Authored India/location or new explicit work-country criterion requires separate qualification')
}
export function readImmutaFlat(text){
 let rows;try{rows=parseEightfoldJson(text)}catch(error){throw failure('Native JSON: '+error.message)}
 need(Array.isArray(rows),'Native complete flat array/envelope changed');const IDs=new Set()
 for(const row of rows){
  need(object(row)&&Object.keys(row).every(k=>allowed.has(k)),'Unreviewed native field/criteria/applicant schema')
  need(typeof row.id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(row.id)&&!IDs.has(row.id),'Duplicate or invalid native role identity');IDs.add(row.id)
  need(row.id!=='4372d3ba-00d6-4ae0-986c-e65d8dbf9def','Advertised non-position intake unexpectedly entered vacancy API')
  need(typeof row.text==='string'&&row.text.trim()&&row.hostedUrl==='https://jobs.lever.co/immuta/'+row.id&&row.applyUrl===row.hostedUrl+'/apply','Native account/role/application URL identity changed')
  need(object(row.categories)&&Object.keys(row.categories).every(k=>['allLocations','commitment','department','location','team'].includes(k)),'Unreviewed native category/location schema')
  for(const key of['commitment','department','location','team'])need(typeof row.categories[key]==='string'&&row.categories[key].trim(),'Native category/location unavailable')
  need(['US','GB'].includes(row.country)&&locationCountry.get(row.categories.location)===row.country,'Native work-country/location contradictory, India or unreviewed')
  need(Array.isArray(row.categories.allLocations)&&row.categories.allLocations.length===1&&row.categories.allLocations[0]===row.categories.location,'Additional native location/country unqualified')
  need(Number.isSafeInteger(row.createdAt)&&row.createdAt>=0&&['remote','hybrid','onsite'].includes(row.workplaceType),'Native date/workplace model unreviewed')
  for(const field of[...htmlFields,...plainFields])need(typeof row[field]==='string','Full native criteria field missing: '+field)
  need(Array.isArray(row.lists)&&row.lists.every(l=>object(l)&&Object.keys(l).length===2&&Object.keys(l).every(k=>['text','content'].includes(k))&&typeof l.text==='string'&&typeof l.content==='string'),'Full native criteria list model changed')
  if(Object.hasOwn(row,'salaryRange')){const salary=row.salaryRange;need(object(salary)&&Object.keys(salary).length===4&&Object.keys(salary).every(k=>['min','max','currency','interval'].includes(k))&&Number.isFinite(salary.min)&&Number.isFinite(salary.max)&&salary.min>=0&&salary.max>=salary.min&&salary.currency===(row.country==='GB'?'GBP':'USD')&&['per-year-salary','per-hour-wage'].includes(salary.interval),'Native salary/criteria model changed')}
  need(Object.hasOwn(row,'salaryDescription')===Object.hasOwn(row,'salaryDescriptionPlain'),'Native salary criteria representation missing')
  if(Object.hasOwn(row,'salaryDescription'))need(typeof row.salaryDescription==='string'&&typeof row.salaryDescriptionPlain==='string','Native salary criteria changed')
  checkAuthored(row)
 }
 need(validatePublicPostingScope(rows,'lever',{source:'immuta',boardToken:'immuta',leverRegion:'global'}).length===0,'Native country/location scope unresolved')
 return rows // Original flat order and every field are deliberately untouched.
}
export function readImmutaGrouped(text,flat){
 let groups;try{groups=parseEightfoldJson(text)}catch(error){throw failure('Grouped native JSON: '+error.message)}
 need(Array.isArray(groups),'Grouped complete native envelope changed');const titles=new Set(),IDs=new Set(),rows=[]
 for(const group of groups){need(object(group)&&Object.keys(group).length===2&&Object.keys(group).every(k=>['title','postings'].includes(k))&&typeof group.title==='string'&&group.title.trim()&&!titles.has(group.title)&&Array.isArray(group.postings)&&group.postings.length>0,'Grouped department/envelope/schema changed');titles.add(group.title)
  for(const row of group.postings){need(row?.categories?.department===group.title&&!IDs.has(row?.id),'Duplicate grouped identity or department mismatch');IDs.add(row.id);rows.push(row)}
 }
 need(rows.length===flat.length&&flat.every(row=>isDeepStrictEqual(rows.find(r=>r.id===row.id),row)),'Complete grouped/flat native membership, fields or criteria disagree')
 return groups
}
const originalIntakeMetadata=metadata=>{
 need(object(metadata)&&!types.isProxy(metadata)&&[Object.prototype,null].includes(Object.getPrototypeOf(metadata)),'Original plain intake receipt metadata/provenance required')
 const suppliedProfile=Object.getOwnPropertyDescriptor(metadata,'profile')
 if(!suppliedProfile)return null // Existing pure classification uses the unchanged strict certificate.
 need(Object.hasOwn(suppliedProfile,'value')&&suppliedProfile.value===IMMUTA_INTAKE_SERVER_PUBLICATION_PROFILE,'Unreviewed original intake receipt profile')
 const original={profile:IMMUTA_INTAKE_SERVER_PUBLICATION_PROFILE}
 for(const key of['requestedURL','finalURL','headers','headerEntries']){
  const descriptor=Object.getOwnPropertyDescriptor(metadata,key)
  need(descriptor&&Object.hasOwn(descriptor,'value'),'Original intake receipt own data metadata unavailable: '+key)
  original[key]=descriptor.value
 }
 return original // Never fill a missing or redirected original transport URL.
}

export function readImmutaIntake(html,responseMetadata){
 // No UUID/title blacklist. This exact fully reviewed native body and its
 // actual JobPosting description explicitly declare a non-position intake.
 // Only two exact source rays bound to the original header and one opaque
 // canonical numeric literal may differ for comparison. No Date relationship
 // or time semantics are inferred. Complete raw originals remain separately
 // retained; no code executes and every other intake entity byte stays pinned.
 // Core explicitly selects that profile; pure no-profile classification keeps
 // the unchanged strict source-time binding instead.
 const originalMetadata=originalIntakeMetadata(responseMetadata),certificate=certifyLeverRequestMetadata(html,originalMetadata??responseMetadata)
 if(originalMetadata)need(certificate.comparisonProfile===IMMUTA_INTAKE_SERVER_PUBLICATION_PROFILE&&certificate.tDateBound===false&&certificate.sourceTimeSemanticsQualified===false,'Unqualified intake server-publication metadata comparison profile')
 need(certificate.comparisonFingerprint==='2a2ac2c9a60ac5ce727c119d8fe5c48ad143f60b398939e90400e63a01002ca2','Advertised intake complete original content/profile changed outside certified response metadata')
 const document=readNativeDocument(html),entries=entriesOf(document),head=activeHead(html),carriers=entries.filter(e=>e.node.tag==='script'&&e.node.attrs.type?.toLowerCase()==='application/ld+json')
 need(isDeepStrictEqual(head.titles,['Immuta - Join our Talent Community!'])&&carriers.length===1&&active(carriers[0])&&!Object.hasOwn(carriers[0].node.attrs,'src'),'Native intake identity/schema carrier changed')
 let schema;try{schema=parseEightfoldJson(carriers[0].node.raw)}catch(error){throw failure('Intake native JSON: '+error.message)}
 need(sha(carriers[0].node.raw)==='711819d967d52424e5c8e1a9b1f613ba71d368bd1c59b62e507f63494ae51058'&&schema['@type']==='JobPosting'&&schema.title==='Join our Talent Community!'&&schema.hiringOrganization?.name==='Immuta','Actual native intake full schema/brand changed')
 const ownText=document.text(document.nodes(n=>n.tag==='root')[0]),schemaText=document.text(readNativeDocument(schema.description).nodes(n=>n.tag==='root')[0])
 const disclaimer='This is a general interest posting and is not tied to a specific open position or work location.'
 for(const text of[ownText,schemaText])need(text.includes(disclaimer)&&text.includes('Please see all of our current openings on our careers page.'),'Native intake explicit non-position declaration unavailable')
 need(head.metas.filter(m=>m.property==='og:url'&&m.content===INTAKE).length===1,'Native intake current URL identity changed')
 return{URL:INTAKE,requestMetadataCertificate:certificate,classification:'explicit-native-general-interest-non-position',classificationNotFromAgeCountryOrTitle:true,nativeSchema:schema,nativeRawSchema:carriers[0].node.raw,fullOwnText:ownText,fullOwnHTML:html,bodySHA256:sha(html),nativeCountry:schema.jobLocation.address.addressCountry,nativeLocality:schema.jobLocation.address.addressLocality,nativeEmploymentType:schema.employmentType,nativeDatePosted:schema.datePosted,ownVacancyUIQualified:false,applicationVisited:false,screeningQualified:false}
}
const securityKeys=['content-security-policy','content-security-policy-report-only','x-content-security-policy','x-webkit-csp','cross-origin-embedder-policy','cross-origin-resource-policy','cross-origin-opener-policy','x-frame-options','permissions-policy','document-policy']
export function readImmutaSecurity(headers){
 const policy=Object.fromEntries(securityKeys.map(k=>[k,headers.get(k)]));for(const key of securityKeys)need(policy[key]===null,'Unreviewed enforced/report-only/security policy: '+key)
 need(headers.get('x-content-type-options')==='nosniff','Reviewed native nosniff security profile changed');policy['x-content-type-options']='nosniff'
 for(const[key]of headers)need(!key.startsWith('access-control-'),'Unreviewed native CORS policy; browser execution is not qualified')
 return policy
}
