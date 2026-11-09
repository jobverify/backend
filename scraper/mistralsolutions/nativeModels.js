import {createHash} from 'node:crypto'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readMistralDeclarations} from './nativeDocx.js'

export const CAREERS='https://mistralsolutions.com/career/careers-job-listings/'
export const CONTACT='https://mistralsolutions.com/contact/'
export const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const need=(ok,message)=>{if(!ok)throw Error('Mistral native careers table: '+message)}
const cls=(n,name)=>(n.attrs.class||'').split(/\s+/).includes(name)
const walk=(n,p)=>[...(p(n)?[n]:[]),...n.children.filter(c=>typeof c!=='string').flatMap(c=>walk(c,p))]
const one=(nodes,label)=>{need(nodes.length===1,'one '+label+' required');return nodes[0]}
export const nativeTree=n=>typeof n==='string'?n:{tag:n.tag,attrs:{...n.attrs},children:n.children.map(nativeTree),...(n.raw===undefined?{}:{raw:n.raw})}
const rawText=n=>typeof n==='string'?decodeNativeEntities(n):n.children.map(rawText).join(' ')
const sha=s=>createHash('sha256').update(s).digest('hex')
const protectedEmailDigest=hex=>{need(/^(?:[a-f0-9]{2}){3,321}$/i.test(hex),'unreviewed protected-email encoding');const bytes=Buffer.from(hex,'hex'),decoded=Buffer.from(bytes.subarray(1).map(byte=>byte^bytes[0])),email=new TextDecoder('utf-8',{fatal:true}).decode(decoded);need(/^[^\s@]+@[a-z0-9.-]+$/i.test(email),'unreviewed protected-email value');return sha(decoded)}
// Whole originals remain unchanged. Only an encoding of the same native email
// may compare equal; all other attributes, content and structure still close.
const reconciledOfficeTree=model=>{if(typeof model==='string')return model;const attrs={...model.attrs};if(attrs['data-cfemail']!==undefined)attrs['data-cfemail']='decoded-byte-sha256:'+protectedEmailDigest(attrs['data-cfemail']);if(model.tag==='a'&&attrs.href?.startsWith('/cdn-cgi/l/email-protection#'))attrs.href='protected-email-byte-sha256:'+protectedEmailDigest(attrs.href.slice('/cdn-cgi/l/email-protection#'.length));return{...model,attrs,children:model.children.map(reconciledOfficeTree)}}
const parentsOf=root=>{const parents=new Map();const visit=n=>{for(const c of n.children.filter(c=>typeof c!=='string')){parents.set(c,n);visit(c)}};visit(root);return parents}
const ancestorsOf=(node,parents)=>{const result=[];for(let p=parents.get(node);p;p=parents.get(p))result.push(p);return result}
const textFlow=n=>typeof n==='string'?decodeNativeEntities(n):['script','style','iframe','title'].includes(n.tag)?'':n.tag==='br'?'\n':n.children.map(textFlow).join('')+(/^(?:p|div|li|section|article|td|tr|h[1-6])$/.test(n.tag)?'\n':'')
const declarations=nodes=>readMistralDeclarations(nodes.flatMap(n=>textFlow(n).split('\n')),{embedded:true})
const employerMetadata=(nodes,d)=>nodes.filter(n=>['itemprop','property','name'].some(key=>String(n.attrs[key]||'').split(/\s+/).some(token=>/(?:^|[:/#])(?:hiringOrganization|employer|company)$/i.test(token)))).map(n=>({tag:n.tag,attrs:{...n.attrs},value:clean(n.attrs.content??n.attrs.value??d.text(n))}))
const geographyMetadata=nodes=>nodes.flatMap(n=>Object.entries(n.attrs).filter(([key,value])=>/^(?:data-)?(?:country|work-country|job-country|address-country|location|work-location|workplace|city|address-locality|address-region|region)$/i.test(key)||['itemprop','property','name'].includes(key)&&String(value).split(/\s+/).some(token=>/(?:^|[:/#])(?:addressCountry|jobLocation|workLocation|addressLocality|addressRegion|country|city|workplace)$/i.test(token))).map(([attribute,value])=>({tag:n.tag,attribute,value})))
const ownURL=(value,kind)=>{const u=new URL(value,CAREERS);need(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&(kind==='form'?u.hostname==='docs.google.com'&&/^\/forms\/d\/e\/[^/]+\/viewform$/.test(u.pathname):u.hostname==='mistralsolutions.com'&&!u.search&&(kind!=='docx'||/^\/wp-content\/uploads\/\d{4}\/\d{2}\/[^/]+\.docx$/.test(u.pathname))),'unreviewed native '+kind+' URL');return u.href}
const noTypedPosting=d=>{for(const n of d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')){let model;try{model=JSON.parse(n.raw)}catch{throw Error('Mistral malformed native structured metadata')}need(!/"@type"\s*:\s*(?:\[[^\]]*)?"JobPosting"/.test(JSON.stringify(model)),'unreviewed parallel JobPosting metadata')}}
export function readMistralTable(html){
 need(typeof html==='string'&&Buffer.byteLength(html)<=4000000,'bounded original HTML required')
 const d=readNativeDocument(html),v=readVisibleNativeDocument(html,{strict:true}),root=one(d.nodes(n=>n.tag==='root'),'native document root'),head=activeHead(html)
 need(head.titles.length===1&&head.titles[0]==='Careers Job Listings - Mistral Solutions','publisher heading changed')
 noTypedPosting(d)
 const tables=walk(root,n=>n.tag==='table'&&cls(n,'career-table'));need(tables.length===1,'one whole original native table required')
 const table=one(d.nodes(n=>n.tag==='table'&&cls(n,'career-table')),'active native table'),visible=one(v.nodes(n=>n.tag==='table'&&cls(n,'career-table')),'visible native table')
 const parents=parentsOf(root),ancestors=ancestorsOf(table,parents),containingContext=ancestors.map(n=>({tag:n.tag,attrs:{...n.attrs}}))
 need(d.text(table)===v.text(visible),'unreadable native table criteria')
 const rawRows=walk(table,n=>n.tag==='tr'),rows=d.nodes(n=>n.tag==='tr',table);need(rows.length===rawRows.length&&rows.length>1&&rows.length<=101,'hidden or excessive native rows')
 const header=rows[0].children.filter(n=>typeof n!=='string');need(header.length===7&&header.map(n=>d.text(n)).join('|')==='Job ID|Position|Experience|Location|Required Skills|Job Description|Apply','native column contract changed')
 const seen=new Set(),jobs=rows.slice(1).map(row=>{
  const cells=row.children.filter(n=>typeof n!=='string');need(cells.length===7&&cells.every(n=>n.tag==='td'&&!n.inert),'whole native row cells required')
  need(!walk(row,n=>['script','iframe','object','embed','form','input','textarea','template','noscript'].includes(n.tag)).length,'unreadable or delegated native row criteria')
  for(const cell of cells)need(clean(rawText(cell))===d.text(cell),'hidden native row criteria')
  const [id,title,experience,location,skills]=cells.slice(0,5).map(n=>d.text(n)),doc=one(d.nodes(n=>n.tag==='a'&&n.attrs.href,cells[5]),'declared document link'),apply=one(d.nodes(n=>n.tag==='a'&&(n.attrs.href||n.attrs['data-form']),cells[6]),'published application link')
  need(/^JID-\d+$/.test(id)&&!seen.has(id)&&title&&location&&skills,'native role identity/workplace/criteria changed');seen.add(id)
  const sourceUrl=ownURL(doc.attrs.href,'docx'),applyUrl=ownURL(apply.attrs['data-form']||apply.attrs.href,'form')
  const criteriaNodes=walk(cells[4],()=>true),nativeTableDeclarations=declarations(criteriaNodes),nativeEmployerMetadata=employerMetadata([...ancestors,table,...walk(row,()=>true)],d)
  return{title,company:'Mistral Solutions',department:null,location,city:null,country:null,jobId:id,requisitionId:null,sourceUrl,applyUrl,experienceRequired:experience||null,employmentType:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription:null,sourceDescription:null,nativeTableRequiredSkills:skills,nativeTableRole:nativeTree(row),nativeTableDeclarations,nativeEmployerMetadata,nativeContainingContext:containingContext,nativeLocationLabel:location,nativeGeographyMetadata:geographyMetadata([...ancestors,table,...walk(row,()=>true)]),sourceDetailComplete:false,sourceCountryScopeUnresolved:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false}
 })
 return{jobs,table:nativeTree(table),containingContext,originalHTML:html,bodySHA256:sha(html),contactURL:d.nodes(n=>n.tag==='a'&&n.attrs.href).some(n=>{try{return new URL(n.attrs.href,CAREERS).href===CONTACT}catch{return false}})?CONTACT:null}
}
export function readMistralOffice(html){
 need(typeof html==='string'&&Buffer.byteLength(html)<=4000000,'bounded contact original required')
 const head=activeHead(html);need(head.titles.length===1&&head.titles[0]==='Contact Us - Mistral Solutions','contact publisher identity changed')
 const d=readNativeDocument(html),v=readVisibleNativeDocument(html,{strict:true}),root=one(d.nodes(n=>n.tag==='root'),'contact document root'),parents=new Map()
 const visit=n=>{for(const c of n.children.filter(c=>typeof c!=='string')){parents.set(c,n);visit(c)}};visit(root);noTypedPosting(d)
 const headings=d.nodes(n=>n.tag==='h3'&&d.text(n)==='India Headquarters');need(headings.length===1,'literal own India headquarters country context changed')
 let card=headings[0];while(card&&!(d.text(card).includes('Mistral Solutions Pvt. Ltd.')&&/\bBangalore\b/.test(d.text(card))))card=parents.get(card)
 need(card&&card.tag==='div'&&card.attrs['data-id'],'whole own Bangalore office country card required')
 const visible=one(v.nodes(n=>n.attrs['data-id']===card.attrs['data-id']),'visible own country card')
 need(d.text(card)===v.text(visible),'hidden native office country context')
 const containing=parents.get(card),typed=geographyMetadata(walk(containing,()=>true)),literalCountries=declarations(walk(containing,()=>true)).country
 const unresolved=typed.length>0||literalCountries.some(c=>c!=='India')
 const model=nativeTree(card),containingContext=nativeTree(containing)
 return{country:unresolved?null:'India',workplace:'Bangalore',model,containingContext,reconciledWholeModel:reconciledOfficeTree(model),reconciledContainingContext:reconciledOfficeTree(containingContext),nativeEmailObfuscationComparedAsDecodedByteDigest:true,countryEvidence:d.text(card),nativeCountryMetadata:typed,nativeCountryLabels:literalCountries,typedCountryMetadataUnreviewed:typed.length>0,originalHTML:html,bodySHA256:sha(html),binding:'literal-role-workplace-to-own-explicit-office-country-card',cityDictionaryUsed:false,headquartersCountryAppliedToOtherWorkplaces:false}
}
const identity=value=>clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'')
const identityTokens=value=>clean(value).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]
const containsTokens=(whole,part)=>{const tokens=new Set(identityTokens(whole)),required=identityTokens(part);return required.length>0&&required.every(token=>tokens.has(token))}
const experienceRange=value=>{const nums=String(value).match(/\d+/g);return nums?nums.map(Number).join('-'):/^freshers?$/i.test(clean(value))?'freshers':null}
export function bindMistralDocument(row,doc,office){
 const tableFields=row.nativeTableDeclarations||{},fields=Object.fromEntries(Object.keys(doc.fields).map(key=>[key,[...(doc.fields[key]||[]),...(tableFields[key]||[])]]))
 const titleMatch=[doc.title,...fields.designation,...fields.title].some(t=>identity(t)===identity(row.title))&&(containsTokens(doc.title,row.title)||containsTokens(row.title,doc.title))&&fields.designation.every(t=>containsTokens(row.title,t))&&fields.title.every(t=>identity(t)===identity(row.title))&&fields.jobId.every(id=>identity(id)===identity(row.jobId))
 const employerConflict=[...fields.employer,...(row.nativeEmployerMetadata||[]).map(n=>n.value)].some(e=>!['mistralsolutions','mistralsolutionspvtltd','mistralsolutionsprivatelimited'].includes(identity(e)))
 const experienceConflict=fields.experience.some(e=>experienceRange(e)!==experienceRange(row.experienceRequired))
 const locations=fields.location.map(s=>clean(s).replace(/[.]$/,'')),countryConflict=fields.country.some(c=>c!=='India'),locationConflict=locations.some(s=>s!==row.nativeLocationLabel),assignmentConflict=fields.assignment.some(s=>![row.nativeLocationLabel,'India',row.nativeLocationLabel+', India'].includes(clean(s))),unreviewedGeography=(row.nativeGeographyMetadata||[]).length>0
 const country=office?.country==='India'&&row.nativeLocationLabel===office.workplace&&!employerConflict&&!countryConflict&&!locationConflict&&!assignmentConflict&&!unreviewedGeography?'India':null
 const failure=!titleMatch?'published-document-role-conflict':experienceConflict?'published-document-experience-conflict':employerConflict?'published-document-employer-conflict':null
 const description=titleMatch?[row.nativeTableRequiredSkills,doc.text].join('\n\n'):null
 return{title:row.title,company:'Mistral Solutions',department:null,jobId:row.jobId,requisitionId:null,sourceUrl:row.sourceUrl,applyUrl:row.applyUrl,experienceRequired:row.experienceRequired,employmentType:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,nativeTableRequiredSkills:row.nativeTableRequiredSkills,nativeTableRole:row.nativeTableRole,nativeTableDeclarations:row.nativeTableDeclarations,nativeEmployerMetadata:row.nativeEmployerMetadata,nativeContainingContext:row.nativeContainingContext,nativeLocationLabel:row.nativeLocationLabel,nativeGeographyMetadata:row.nativeGeographyMetadata,location:row.nativeLocationLabel,city:null,country,sourceCountryScopeUnresolved:country===null,jobDescription:description,sourceDescription:description,nativeDocument:doc,nativeOfficeCountryEvidence:office,nativeDescriptionWholeDocumentRetained:true,nativeRoleIdentityReconciled:titleMatch,nativeEmployerReconciled:!employerConflict,nativeRoleCriteriaReconciled:!failure&&country==='India',nativeExperienceConflict:experienceConflict,nativeCountryConflict:countryConflict||locationConflict||assignmentConflict||unreviewedGeography,sourceDetailComplete:false,sourceDetailStatus:failure?'native-publisher-conflict':'unqualified-native-observation',sourceDetailFailureKind:failure||'current-publisher-transport-and-country-proof-not-qualified',nativePostingID:row.jobId,nativeCanonicalRoleURL:null,nativePublishedDocumentURL:row.sourceUrl,nativePublishedApplyURL:row.applyUrl,applicationVisited:false,applicationFormSubmitted:false,activeApplyVerified:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false}
}
