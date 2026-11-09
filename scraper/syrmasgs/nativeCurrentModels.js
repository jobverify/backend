import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {document as sourceDocument} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {extractJobCards,extractJobDetail,hasOfficialLifeAtSignal} from './native.js'
export const SOURCE='syrmasgs',COMPANY='Syrma SGS',LIFE='https://syrmasgs.com/life-at-syrmasgs/',BOARD='https://syrmasgs.com/job-listing/',FACILITIES='https://syrmasgs.com/career-locations/',OFFICES='https://syrmasgs.com/contact-us/'
export const sha=b=>createHash('sha256').update(b).digest('hex'),norm=v=>decodeNativeEntities(String(v??'')).replace(/\s+/g,' ').trim(),cls=(n,c)=>(n.attrs?.class||'').split(/\s+/).includes(c)
export const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Syrma native: '+message),{abortRetries:true,incompleteScope:true})}
export const walk=(n,p=()=>true)=>typeof n==='string'?[]:[...(p(n)?[n]:[]),...(n.children||[]).flatMap(c=>walk(c,p))]
const one=(rows,label)=>{need(rows.length===1,'missing or ambiguous '+label);return rows[0]},children=n=>(n.children||[]).filter(c=>typeof c!=='string')
export const model=n=>typeof n==='string'?n:{tag:n.tag,attrs:Object.fromEntries(Object.entries(n.attrs||{}).sort(([a],[b])=>a.localeCompare(b))),...(n.raw!==undefined?{raw:n.raw}:{}),children:(n.children||[]).map(model)}
export const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x)
const plain=n=>typeof n==='string'?decodeNativeEntities(n):['script','style','form'].includes(n.tag)?'':n.raw!==undefined?decodeNativeEntities(n.raw):(n.children||[]).map(plain).join(' ')
const parents=root=>{const m=new Map();for(const n of walk(root))for(const c of children(n))m.set(c,n);return m}
const fieldPattern=/^(?:country|work(?:site|place)?(?:\s+country|\s+location)?|job\s+location|location|mandatory\s+(?:work\s+)?assignment|(?:hiring\s+)?employer)\s*:/i
function fields(root){
 const up=parents(root),excluded=n=>{for(let at=n;at;at=up.get(at))if(['form','nav','footer','header','script','style'].includes(at.tag))return true;return false}
 const result=walk(root,n=>!excluded(n)&&!['script','style'].includes(n.tag)).flatMap(n=>{let text=norm(plain(n));if(!fieldPattern.test(text))return[];const key=text.slice(0,text.indexOf(':')).toLowerCase();if(children(n).some(c=>{const t=norm(plain(c));return fieldPattern.test(t)&&t.slice(0,t.indexOf(':')).toLowerCase()===key}))return[];if(!norm(text.slice(text.indexOf(':')+1)))for(let holder=up.get(n);holder&&!excluded(holder);holder=up.get(holder)){const whole=norm(plain(holder));if(whole.length>=160||!fieldPattern.test(whole))break;text=whole;if(norm(whole.slice(whole.indexOf(':')+1)))break}return[text]})
 for(const row of walk(root,n=>n.tag==='tr'&&!excluded(n))){const cells=children(row).filter(n=>['th','td'].includes(n.tag));if(cells.length>=2)result.push(norm(plain(cells[0]))+': '+cells.slice(1).map(c=>norm(plain(c))).filter(Boolean).join(' '))}
 for(const list of walk(root,n=>n.tag==='dl'&&!excluded(n))){const items=children(list);for(let i=0;i<items.length-1;i++)if(items[i].tag==='dt'&&items[i+1].tag==='dd')result.push(norm(plain(items[i]))+': '+norm(plain(items[i+1])))}
 return [...new Set(result)]
}
const schemaJSON=text=>{let value,ast;try{value=JSON.parse(text);ast=parse('('+text+')',{ecmaVersion:'latest'})}catch{need(false,'invalid native structured JSON')};const scan=n=>{if(!n||typeof n!=='object')return;if(n.type==='ObjectExpression'){const keys=n.properties.map(p=>p.key.value??p.key.name);need(new Set(keys).size===keys.length,'duplicate native structured fields')}for(const v of Object.values(n))if(Array.isArray(v))v.forEach(scan);else if(v&&typeof v==='object')scan(v)};scan(ast);return value}
const schemas=doc=>walk(doc.root,n=>n.tag==='script'&&/application\/ld\+json/i.test(n.attrs.type||'')).map(n=>({inactive:n.inactive===true,value:schemaJSON(n.raw)}))
const jobSchemas=v=>!v||typeof v!=='object'?[]:[...((Array.isArray(v['@type'])?v['@type']:[v['@type']]).includes('JobPosting')?[v]:[]),...Object.values(v).flatMap(jobSchemas)]
function page(html,url,title){
 need(typeof html==='string'&&!/<title\b[^>]*>\s*(?:Access Denied|Forbidden|Just a moment)|cf-chl-/i.test(html),'unavailable or challenged publisher')
 const doc=sourceDocument(html),active=readNativeDocument(html),head=activeHead(html),links=active.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical'))
 need(head.titles.length===1&&(!title||head.titles[0]===title),'publisher title differs');need(links.length===1&&links[0].attrs.href===url,'publisher canonical identity differs')
 return{doc,active,head,headModel:model(one(doc.nodes(n=>n.tag==='head'),'publisher head')),originalHTML:html,bodySHA256:sha(html)}
}
const linksTo=(doc,url)=>doc.nodes(n=>n.tag==='a'&&n.attrs.href===url)
export function readLife(html){need(hasOfficialLifeAtSignal(html),'current careers handoff differs');const p=page(html,LIFE,'Life at SyrmaSGS - Syrma SGS');for(const url of [BOARD,FACILITIES,OFFICES])need(linksTo(p.doc,url).length>0,'missing declared careers/context URL');return{head:p.headModel,handoffs:[BOARD,FACILITIES,OFFICES].map(url=>({url,anchors:linksTo(p.doc,url).map(model)}))}}
export function readBoard(html){
 const p=page(html,BOARD,'Job Listing - Syrma SGS'),rows=extractJobCards(html),container=one(p.doc.nodes(n=>cls(n,'awsm-job-listings')),'whole native job listing'),filters=p.doc.nodes(n=>n.tag==='select'&&(n.attrs.name||'').startsWith('awsm_job_spec['))
 need(rows.length<=40,'published role bound exceeded');for(const url of [FACILITIES,OFFICES])need(linksTo(p.doc,url).length>0,'missing own country context declaration')
 return{rows,model:{head:p.headModel,listing:model(container),filters:filters.map(model),declaredContext:[FACILITIES,OFFICES]}}
}
export function readFacilities(html){const p=page(html,FACILITIES,'Career Locations - Syrma SGS');need(linksTo(p.doc,BOARD).length>0,'facility-to-jobs handoff missing');const root=one(p.doc.nodes(n=>n.tag==='body'),'facility body');return{head:p.headModel,body:model(root)}}
export function readOffices(html){
 const p=page(html,OFFICES,'Contact Us - Syrma SGS'),up=parents(p.doc.root),headings=p.doc.nodes(n=>n.tag==='h4'),cards=[]
 for(const h of headings){let card=h;while(card&&!cls(card,'elementor-column'))card=up.get(card);need(card,'missing whole office card');need(walk(card,n=>n.tag==='h4').length===1,'ambiguous office heading');const heading=norm(p.doc.text(h)),text=norm(p.doc.text(card));let country=/,\s*India\s*$/i.test(text)?'India':heading==='GERMANY'?'Germany':heading==='USA'?'United States':null;for(const declaration of fields(card)){const at=declaration.indexOf(':'),key=norm(declaration.slice(0,at)),value=norm(declaration.slice(at+1)).replace(/^-\s*/,'');if(/^(?:country|work(?:site|place)?\s+country)$/i.test(key)&&(!countryLabel(value)||countryLabel(value)!==country))country=null}cards.push({heading,text,country,model:model(card)})}
 need(cards.length>=7&&new Set(cards.map(c=>c.heading)).size===cards.length,'office inventory differs');need(cards.some(c=>c.heading==='CHENNAI')&&cards.some(c=>c.heading==='MANESAR'),'missing own worksite office cards')
 return{head:p.headModel,cards}
}
const countryLabel=v=>v==='USA'?'United States':v==='UK'?'United Kingdom':nativeCountryName(v)
const countryNames=new Set(['USA','UK']);for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const c=nativeCountryName(String.fromCharCode(a,b));if(c)countryNames.add(c)}
const countryPatterns=[...countryNames].map(c=>({country:countryLabel(c),pattern:new RegExp('(?:^|[\\s,;/()])'+c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replaceAll(' ','\\s+')+'(?=$|[\\s,;/()])','i')}))
const mentions=value=>countryPatterns.filter(c=>c.pattern.test(value)).map(c=>c.country)
const usableTags=new Set(['root','div','section','article','p','br','strong','b','em','i','u','s','span','a','ul','ol','li','h1','h2','h3','h4','h5','h6','table','thead','tbody','tfoot','tr','td','th','dl','dt','dd','blockquote','hr','sup','sub'])
function countryBinding(job,schema,offices,article){
 const labels=job.rawNativeRoleEvidence.nativeGeography.nativeWorkplaceStatements,typed=[]
 if(schema.jobLocation){need(!Array.isArray(schema.jobLocation)&&schema.jobLocation['@type']==='Place','unsupported native placement array/type');need(Object.keys(schema.jobLocation).every(k=>['@type','address'].includes(k)),'unreviewed native placement fields');const a=schema.jobLocation.address;if(typeof a==='string')typed.push(a);else{need(a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).every(k=>['@type','streetAddress','addressLocality','addressRegion','postalCode','addressCountry'].includes(k)),'unreviewed native placement address fields');if(a.addressLocality)typed.push(a.addressLocality)}}
 const candidates=(typed.length?typed:labels).map(norm),matched=candidates.map(label=>offices.cards.filter(c=>c.heading.toLowerCase()===label.toLowerCase()&&c.country)),allCountries=[...new Set(matched.flat().map(c=>c.country))],declared=job.rawNativeRoleEvidence.nativeGeography.nativeCountryStatements.flatMap(mentions),foreign=labels.flatMap(mentions)
 const country=candidates.length&&matched.every(rows=>rows.length===1)&&allCountries.length===1?allCountries[0]:null
 const explicit=[...job.rawNativeRoleEvidence.nativeGeography.nativeCountryStatements,...(job.country?[job.country]:[])].map(v=>countryLabel(v)||norm(v)),conflict=country&&[...declared,...foreign,...explicit].some(c=>c!==country)
 return{country:country&&!conflict?country:null,unresolved:!country||Boolean(conflict),conflict:Boolean(conflict),nativeLabels:labels,typedPlacementLabels:typed,proof:country&&!conflict?{country,officeHeading:matched[0][0].heading,officeHeadings:matched.map(c=>c[0].heading),literalWorkplace:candidates,officeCountryText:matched.map(c=>c[0].text),sourceUrl:OFFICES,cityDictionaryUsed:false,headquartersDefaultUsed:false,exactCampusQualified:false}:null}
}
export function readRole(html,listing,offices,observedAt){
 const p=page(html,listing.sourceUrl),job=extractJobDetail(html,listing),article=one(p.doc.nodes(n=>n.tag==='article'&&n.attrs.id==='post-'+job.jobId),'whole published role article'),body=one(p.doc.nodes(n=>n.tag==='body'),'native role body'),main=one(p.doc.nodes(n=>n.tag==='main'&&walk(n,c=>c===article).length===1),'whole native role main'),description=one(p.doc.nodes(n=>cls(n,'awsm-job-entry-content')),'whole native criteria'),json=schemas(p.doc),postings=json.flatMap(s=>jobSchemas(s.value).map(v=>({value:v,inactive:s.inactive})))
 need(postings.length===1&&!postings[0].inactive,'hidden, duplicate or ambiguous native JobPosting');const schema=postings[0].value
 need(Object.keys(schema).every(k=>['@context','@type','title','description','datePosted','employmentType','jobLocation','validThrough','hiringOrganization'].includes(k)),'unreviewed native JobPosting fields')
 const schemaDoc=sourceDocument(schema.description),nodes=[...walk(description),...walk(schemaDoc.root)],readable=nodes.every(n=>!n.inactive&&usableTags.has(n.tag)),geo=countryBinding(job,schema,offices,article),declarations=fields(body)
 const employerConflict=declarations.some(t=>/^(?:hiring\s+)?employer\s*:/i.test(t)&&!/^Syrma\s+SGS$/i.test(t.split(':').slice(1).join(':').trim()))||schema.hiringOrganization&&norm(schema.hiringOrganization.name)!==COMPANY
 const allowedPlaces=new Set([...geo.nativeLabels,...geo.typedPlacementLabels].map(v=>norm(v).toLowerCase()))
 const countryConflict=declarations.some(t=>{const at=t.indexOf(':'),key=norm(t.slice(0,at)),value=norm(t.slice(at+1)).replace(/^-\s*/,'');if(/^(?:country|work(?:site|place)?\s+country)$/i.test(key))return !countryLabel(value)||countryLabel(value)!==geo.country;if(/^(?:work(?:site|place)?(?:\s+location)?|job\s+location|location|mandatory\s+(?:work\s+)?assignment)$/i.test(key))return !allowedPlaces.has(value.toLowerCase())&&countryLabel(value)!==geo.country;return false})
 const closed=/no longer accepting applications|position (?:is |has been )?closed|applications (?:are |have been )?closed|vacancy (?:is )?closed/i.test(norm(plain(body))),future=Date.parse(schema.datePosted)>Date.parse(observedAt),expired=schema.validThrough!=null&&Date.parse(schema.validThrough)<Date.parse(observedAt)
 const qualified=readable&&!employerConflict&&!countryConflict&&!closed&&!future&&!expired&&!geo.unresolved
 const roleModel={head:p.headModel,main:model(main),article:model(article),allStructuredModels:json.map(s=>s.value)},sourceDescription=job.jobDescription
 return{...job,requisitionId:null,nativePostingId:null,nativeContentId:job.jobId,legalEmployer:null,city:null,state:null,country:countryConflict?null:geo.country,locations:[],sourceDescription,jobDescription:sourceDescription,nativeWholeCriteriaText:sourceDescription,nativeCriteriaHTML:p.doc.outer(description),nativeJobPosting:schema,nativeCanonicalRoleURL:listing.sourceUrl,nativeHiringOrganization:null,nativeEmployerReconciled:!employerConflict,nativeRoleCriteriaReconciled:readable,nativeRoleCountryReconciled:!geo.unresolved&&!countryConflict,nativePublishedClosedNotice:closed,nativePublicationDateFuture:future,nativePublicationExpired:expired,nativeRoleQualified:qualified,sourceCountryScopeUnresolved:geo.unresolved||countryConflict,sourceWorksiteCountryProof:countryConflict?null:geo.proof,nativeWorkplaceCountryModel:geo,nativeRoleModel:roleModel,nativeListingModel:listing,sourceRawNativeRole:html,sourceRawNativeRoleSHA256:sha(html),sourceDetailComplete:qualified,sourceDetailFailureKind:qualified?null:geo.unresolved||countryConflict?'native-country-unproven':'native-role-eligibility-unqualified',applicationAvailabilityQualified:false,applicationVisited:false,applicationFormSubmitted:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeMetadata:{unreadExternalCSSRenderingQualified:false,initialBrowserVisibilityClaimed:false,formalRequisitionPublished:false,exactLegalEmployerPublished:false}}
}
