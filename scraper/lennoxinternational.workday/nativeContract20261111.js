import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {parse} from 'acorn'
import {decodeHTML} from 'entities'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import fs from 'node:fs'

export const profile=JSON.parse(fs.readFileSync(new URL('./profile20261111.json',import.meta.url)))
export const need=(ok,message)=>{if(!ok)throw Object.assign(Error('[lennoxinternational] '+message),{abortRetries:true,failureKind:'native_contract_unverified'})}
const norm=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const sha=value=>createHash('sha256').update(value).digest('hex')
const ignored=new Set(['blockquote','q','pre','code','template','style','textarea','noscript'])
export function activeDocument(html){
 const original=readNativeDocument(html),root=original.nodes(n=>n.tag==='root')[0]
 const nodes=(predicate,subtree=root)=>{const found=[];const visit=n=>{if(n.inert||ignored.has(n.tag))return;if(predicate(n))found.push(n);for(const c of n.children)if(typeof c!=='string')visit(c)};visit(subtree);return found}
 const text=n=>{const visit=n=>typeof n==='string'?decodeHTML(n):n.inert||ignored.has(n.tag)||['script','title'].includes(n.tag)?'':n.children.map(visit).join(' ');return norm(visit(n))}
 return{...original,root,nodes,text}
}
const one=(values,label)=>{need(values.length===1,'unique active '+label+' required');return values[0]}
const cls=(n,name)=>(n.attrs.class||'').split(/\s+/).includes(name)
const canonical=(doc,expected)=>need(one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel?.toLowerCase()==='canonical'),'canonical').attrs.href===expected,'native canonical URL conflict')
const noBase=doc=>need(!doc.nodes(n=>n.tag==='base').length,'native base URL not reviewed')
export function readCorporate(html,url){
 need(profile.corporateURLs.includes(url),'corporate URL not reviewed')
 const doc=activeDocument(html);noBase(doc)
 // Corporate pages have no canonical today; any newly supplied one must bind
 // the same corporate document, never the native board's publisher canonical.
 const canonicals=doc.nodes(n=>n.tag==='link'&&n.attrs.rel?.toLowerCase()==='canonical')
 need(canonicals.length===0||canonicals.length===1&&canonicals[0].attrs.href===url,'corporate canonical conflict')
 const title=doc.nodes(n=>n.tag==='title').map(n=>decodeHTML(n.raw||''))
 need(title.length===1&&/Lennox India/.test(title[0]),'corporate publisher title unavailable')
 const anchors=doc.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string'&&/icims\.com/.test(n.attrs.href))
 need(anchors.length>0&&anchors.every(n=>n.attrs.href===profile.shellURL)&&anchors.every(n=>/openings|careers/i.test(doc.text(n))),'current corporate native delegation conflict')
 return{url,title:title[0],declaredNativeURL:profile.shellURL,activeDeclarations:anchors.map(n=>({url:n.attrs.href,text:doc.text(n)}))}
}
export function readShell(html){
 const doc=activeDocument(html);canonical(doc,profile.shellCanonical)
 const assetBase=one(doc.nodes(n=>n.tag==='base'),'reviewed native shell asset base')
 need(Object.keys(assetBase.attrs).length===1&&assetBase.attrs.href===profile.shellAssetBaseHref,'native shell asset base conflict')
 // Hidden and quoted HTML does not establish visible publisher/role proof,
 // but executable scripts and event handlers still run there in a browser.
 // Template/noscript/raw-text content is a different, genuinely inert case.
 const executableNodes=predicate=>{const found=[],visit=n=>{if(['template','noscript'].includes(n.tag))return;if(predicate(n))found.push(n);for(const child of n.children)if(typeof child!=='string')visit(child)};visit(doc.root);return found}
 const scripts=executableNodes(n=>n.tag==='script'&&n.attrs.type!=='application/ld+json')
 const signatures=scripts.map(n=>({attributes:n.attrs,...(n.attrs.src?{}:{sha256:sha(n.raw??'')})}))
 need(isDeepStrictEqual(signatures,profile.shellScripts),'reviewed native shell program set changed')
 const handlers=executableNodes(n=>Object.keys(n.attrs).some(k=>/^on/i.test(k))).map(n=>({tag:n.tag,handlers:Object.fromEntries(Object.entries(n.attrs).filter(([k])=>/^on/i.test(k)))}))
 need(isDeepStrictEqual(handlers,profile.shellHandlers),'reviewed native shell handlers changed')
 need(!executableNodes(n=>n.tag==='iframe'||n.tag==='object'||n.tag==='embed'||n.tag==='meta'&&n.attrs['http-equiv']?.toLowerCase()==='refresh'||Object.values(n.attrs).some(v=>/^\s*(?:javascript|data):/i.test(v)&&v!=='javascript:void(0)')).length,'unreviewed native shell executable surface')
 const assignments=[]
 for(const script of scripts.filter(n=>!n.attrs.src)){
  const ast=parse(script.raw,{ecmaVersion:'latest'})
  const walk=n=>{if(!n||typeof n!=='object')return;if(n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&n.left.object.name==='icimsFrame'&&!n.left.computed&&n.left.property.name==='src')assignments.push(n);for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}};walk(ast)
 }
 need(assignments.length===1&&assignments[0].right.type==='Literal'&&assignments[0].right.value===profile.frameURL,'native active iframe AST literal conflict')
 return{requestedURL:profile.shellURL,publisherCanonical:profile.shellCanonical,declaredFrameURL:profile.frameURL,programSignatures:signatures,handlers}
}
const rolePattern=/^https:\/\/indiacareers-lennox\.icims\.com\/jobs\/(\d+)\/[^/?#]+\/job\?in_iframe=1$/
function headerFields(doc,node){
 const values={}
 for(const group of doc.nodes(n=>cls(n,'iCIMS_JobHeaderTag'),node)){
  const label=doc.text(one(doc.nodes(n=>n.tag==='dt',group),'native field label')),value=doc.text(one(doc.nodes(n=>n.tag==='dd',group),'native field value'))
  need(!Object.hasOwn(values,label)&&!!value,'duplicate or empty native header field');values[label]=value
 }
 const left=one(doc.nodes(n=>cls(n,'header')&&cls(n,'left'),node),'native location header')
 need(doc.nodes(n=>cls(n,'field-label')&&doc.text(n)==='Job Locations',left).length===1,'native workplace label missing')
 const spans=left.children.filter(n=>typeof n!=='string'&&n.tag==='span'&&!cls(n,'field-label')&&!n.inert)
 values['Job Locations']=doc.text(one(spans,'native workplace value'))
 return values
}
export function readListing(html){
 const doc=activeDocument(html);noBase(doc);canonical(doc,profile.listingCanonical)
 const header=doc.text(one(doc.nodes(n=>cls(n,'iCIMS_SearchResultsHeader')),'native pagination header'))
 need(/\bPage 1 of 1\b/.test(header)&&!doc.nodes(n=>n.tag==='a'&&/^(?:next|previous)$/i.test(doc.text(n))).length,'bounded native listing pagination changed')
 const cards=doc.nodes(n=>n.tag==='li'&&cls(n,'iCIMS_JobCardItem'));need(cards.length>0&&cards.length<=30,'bounded native listing cohort required')
 const rows=cards.map(card=>{
  const anchor=one(doc.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string'&&n.attrs.href.includes('/jobs/'),card),'own native role anchor'),match=rolePattern.exec(anchor.attrs.href)
  need(match,'native role URL/host/path conflict')
  const title=doc.text(one(doc.nodes(n=>n.tag==='h3',anchor),'native listing title')),fields=headerFields(doc,card)
  need(title&&anchor.attrs.title===match[1]+' - '+title&&fields['Requisition #'],'native listing title/ID binding conflict')
  return{nativeJobId:match[1],requestedURL:anchor.attrs.href,canonicalURL:anchor.attrs.href.split('?')[0],title,fields}
 })
 need(new Set(rows.map(r=>r.nativeJobId)).size===rows.length&&new Set(rows.map(r=>r.canonicalURL)).size===rows.length,'duplicate native listing identities')
 need(doc.nodes(n=>n.tag==='a'&&rolePattern.test(n.attrs.href||'')).length===rows.length,'native role links outside own listing cards')
 return{requestedURL:profile.frameURL,canonicalURL:profile.listingCanonical,header,rows,observedNativeCount:rows.length,listingPageCount:1}
}
const boundaries=new Set(['address','article','aside','body','br','caption','dd','details','div','dl','dt','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header','hr','li','main','nav','ol','p','section','summary','table','tbody','td','th','thead','tr','ul'])
function blocks(root,criteriaOnly=false){
 const found=[];let current='';const flush=()=>{const v=norm(decodeHTML(current));if(v)found.push(v);current=''}
 const visit=n=>{if(typeof n==='string'){current+=n+' ';return}if(n.inert||ignored.has(n.tag)||['script','title'].includes(n.tag)||criteriaOnly&&/^h[1-6]$/.test(n.tag)){flush();found.push(null);return}if(boundaries.has(n.tag))flush();for(const c of n.children)visit(c);if(boundaries.has(n.tag))flush();else current+=' '};visit(root);flush();return found
}
function substantiveCriteria(root){
 const lines=blocks(root,true),retained=[]
 const label=/^(?:(?:Minimum|Preferred|Required|Work)\s+)?(?:Experience|Education|Skills(?: and Abilities)?|Responsibilities|Qualifications|Requirements|Job Description|Job Purpose|Training|Education and Experience)\s*:?$/i
 const metadata=/^(?:(?:Job|Work|Role|Office|Primary)\s+)?(?:Locations?|Country|Workplace|Worksite|Title|Department|Division|Employer|Company|Organization|Requisition\s*#?)\s*(?::\s*(.*))?$/i
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(!line||label.test(line)||/^(?:test|jd|n\/a|tbd|placeholder|coming soon|apply now)[.!\s]*$/i.test(line))continue
  const field=metadata.exec(line)
  if(field){if(!field[1]?.trim()&&lines[i+1]){if(lines[i+1]===':')i++;if(lines[i+1]&&!metadata.test(lines[i+1]))i++}continue}
  retained.push(line)
 }
 return retained.join(' ')
}
function fieldValues(lines,pattern){
 const result=[]
 for(let i=0;i<lines.length;i++){if(!lines[i])continue;const match=pattern.exec(lines[i]);if(!match)continue;if(match[1]?.trim())result.push(match[1].trim());else{const next=lines[i+1]===':'?lines[i+2]:lines[i+1];if(next&&!/^[\p{L}][\p{L} /-]{0,60}\s*:/u.test(next))result.push(next)}}return result
}
const countryPatterns=(()=>{const names=new Set();for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const name=nativeCountryName(String.fromCharCode(a,b));if(name&&name.length>2)names.add(name)}return[...names].map(name=>[name,new RegExp('(?<![\\p{L}\\p{N}])'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}\\p{N}])','iu')])})()
const countries=text=>countryPatterns.filter(([,pattern])=>pattern.test(text)).map(([name])=>name)
const countryConsistent=(value,country)=>!countries(value).some(name=>name!==country)&&!new RegExp('\\b(?:not|non)[-\\s]*'+country+'\\b','i').test(value)
function declarations(root,country){
 const lines=blocks(root),key=v=>norm(v).replace(/[^\p{L}\p{N}]/gu,'').toLowerCase(),own=v=>['lennox','lennoxinternational'].includes(key(v))
 const employers=fieldValues(lines,/^(?:(?:Legal|Hiring)\s+)?(?:Employer|Organization Name|Company Name|Company|Organization)\s*(?::\s*(.*))?$/i)
 for(const line of lines.filter(Boolean)){
  for(const m of line.matchAll(/\b(?:you (?:will be|are) employed by|your employer (?:is|will be))\s+([^.!?]+)(?:[.!?]|$)/gi))employers.push(m[1])
  for(const m of line.matchAll(/(?:^|[.!?]\s+)([^.!?]+?)\s+is your employer\b/gi))employers.push(m[1])
  const role=/^(?:This|The) (?:role|position|job) (?:is|will be) (?:at|with|for)\s+([^.!?]+)[.!?]?$/i.exec(line)
  const employee=/^You (?:will be|are) working for\s+([^.!?]+)[.!?]?$/i.exec(line)
  if(role)employers.push(role[1]);if(employee)employers.push(employee[1])
 }
 need(employers.every(own),'own active criteria employer conflict')
 const segments=[''];for(const line of lines){if(line===null)segments.push('');else segments[segments.length-1]+=' '+line}
 need(!segments.some(v=>/\bLennox(?:\s+International)?(?![\p{L}\p{N}]).{0,60}(?:is not|isn['\u2019]t|will not be|won['\u2019]t be).{0,40}employer\b|\b(?:not|won['\u2019]t|aren['\u2019]t|isn['\u2019]t)\s+(?:be\s+)?(?:employed by|(?:an?\s+)?employee of)\s+Lennox(?:\s+International)?(?![\p{L}\p{N}])/iu.test(v)),'own active criteria employer denial')
 const workplaces=fieldValues(lines,/^(?:(?:Job|Work|Role|Office|Primary)\s+)?(?:Locations?|Country|Workplace|Worksite)\s*(?::\s*(.*))?$/i)
 const typedCountries=fieldValues(lines,/^(?:(?:Job|Work|Role)\s+)?Country\s*(?::\s*(.*))?$/i)
 for(const value of typedCountries){const name=nativeCountryName(value);need(name?name===country:!!countries(value).length&&countryConsistent(value,country),'own typed criteria country conflict or unknown')}
 for(const line of lines.filter(Boolean)){
  const m=/^(?:(?:This|The) (?:(?:successful|selected|appointed) )?(?:role|position|job|candidate|employee) (?:is|will be)|You (?:are|will be)) (?:based|located|working) (?:in|at)\s+(.+)$/i.exec(line)
  if(m)workplaces.push(m[1])
 }
 need(workplaces.every(value=>countryConsistent(value,country)),'own active criteria workplace country conflict')
}
const contentKey=value=>{const d=activeDocument(value);return d.text(d.root).replace(/\s/g,'')}
const supportedKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key))
export function readRole(html,row){
 const identity=rolePattern.exec(row.requestedURL)
 need(identity&&identity[1]===row.nativeJobId&&row.requestedURL.split('?')[0]===row.canonicalURL,'own row URL/native ID binding conflict')
 const doc=activeDocument(html);noBase(doc);canonical(doc,row.canonicalURL)
 const schemaNode=one(doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'),'inline own role schema');need(!schemaNode.attrs.src,'external own schema unavailable')
 let schema;try{schema=JSON.parse(schemaNode.raw)}catch{need(false,'own native schema malformed')}
 need(supportedKeys(schema,['@context','@type','title','description','datePosted','validThrough','hiringOrganization','jobLocation','employmentType','url','directApply','occupationalCategory'])&&schema['@type']==='JobPosting'&&schema['@context']==='http://schema.org','own native schema contract changed')
 need(schema.url===row.canonicalURL&&typeof schema.title==='string'&&norm(decodeHTML(schema.title))===row.title,'own schema URL/title/ID conflict')
 need(supportedKeys(schema.hiringOrganization,['@type','name','sameAs'])&&schema.hiringOrganization['@type']==='Organization'&&schema.hiringOrganization.name==='Lennox International'&&schema.hiringOrganization.sameAs==='www.lennoxinternational.com','own native publisher conflict')
 const content=one(doc.nodes(n=>cls(n,'iCIMS_JobContent')),'own native role content'),header=one(doc.nodes(n=>cls(n,'iCIMS_JobsTable'),content),'own native role header')
 declarations(content,countryFromSchema(schema))
 need(doc.text(one(doc.nodes(n=>n.tag==='h1',header),'own role title'))===row.title,'own visible title conflict')
 const fields=headerFields(doc,header);need(fields['Requisition #']===row.fields['Requisition #']&&fields['Job Locations']===row.fields['Job Locations'],'own native requisition/location conflict')
 need(Array.isArray(schema.jobLocation)&&schema.jobLocation.length>0,'own native explicit locations required')
 const addresses=schema.jobLocation.map(place=>{need(supportedKeys(place,['@type','address'])&&place['@type']==='Place'&&supportedKeys(place.address,['@type','addressCountry','addressLocality','addressRegion','streetAddress','postalCode','postOfficeBoxNumber'])&&place.address['@type']==='PostalAddress','own native address shape changed');return place.address})
 const countryNames=addresses.map(a=>nativeCountryName(a.addressCountry));need(countryNames.every(Boolean)&&new Set(countryNames).size===1,'own native country alternatives unresolved');const country=countryNames[0]
 // IN is an explicit native ISO prefix, not the Chennai query or a city guess.
 const visibleCountryPrefixes=[...fields['Job Locations'].matchAll(/(?:^|[,;|/]\s*)([A-Z]{2})-/g)].map(match=>nativeCountryName(match[1]))
 need(addresses.every(a=>typeof a.addressCountry==='string'&&/^[A-Z]{2}$/.test(a.addressCountry)&&fields['Job Locations'].startsWith(a.addressCountry+'-')&&countryConsistent(Object.values(a).filter(v=>typeof v==='string').join(' '),country))&&countryConsistent(fields['Job Locations'],country)&&visibleCountryPrefixes.every(name=>name===country),'own typed country/visible workplace conflict')
 const sections=[]
 for(let i=0;i<content.children.length;i++){
  const heading=content.children[i];if(typeof heading==='string'||heading.tag!=='h2'||!cls(heading,'iCIMS_InfoField_Job')||heading.inert)continue
  const label=doc.text(heading);need(['Company Profile','Job Description','Qualifications'].includes(label),'own native criteria heading changed')
  const next=content.children.slice(i+1).find(n=>typeof n!=='string');need(next&&cls(next,'iCIMS_InfoMsg_Job')&&doc.nodes(n=>n===next,content).length===1,'own visible criteria section missing')
  const text=doc.text(next)
  need(!!substantiveCriteria(next),'own native criteria placeholder or empty')
  sections.push({heading:label,text})
  declarations(next,country)
 }
 need(sections.filter(s=>s.heading==='Job Description').length===1&&sections.filter(s=>s.heading==='Qualifications').length===1&&sections.filter(s=>s.heading==='Company Profile').length<=1,'mandatory own role criteria sections missing')
 const allowedClasses=['iCIMS_JobsTable','iCIMS_InfoField_Job','iCIMS_InfoMsg_Job','iCIMS_JobOptions','iCIMS_SubHeader_Connect','iCIMS_InfoMsg_Connect','iCIMS_PageFooter','iCIMS_Logo']
 need(content.children.every(n=>typeof n==='string'?!norm(decodeHTML(n)):n.inert||ignored.has(n.tag)||allowedClasses.some(name=>cls(n,name))),'unsupported own role content outside reconciled sections')
 need(typeof schema.description==='string'&&contentKey(schema.description)===sections.map(s=>s.heading+s.text).join('').replace(/\s/g,''),'own schema/visible full criteria conflict')
 const schemaDoc=readNativeDocument(schema.description);declarations(schemaDoc.nodes(n=>n.tag==='root')[0],country)
 const date=nativeDate(schema.datePosted,{required:true}),validThrough=nativeDate(schema.validThrough,{required:true})
 need(typeof schema.employmentType==='string'&&schema.employmentType.trim()&&typeof schema.directApply==='boolean','own employment/application metadata changed')
 return{jobId:row.nativeJobId,source:'lennoxinternational',company:'Lennox International',title:row.title,requisitionId:fields['Requisition #'],location:fields['Job Locations'],country,
  jobDescription:schema.description,sourceUrl:row.canonicalURL,applyUrl:row.canonicalURL,postingDate:date.iso,sourcePublicationPrecision:date.precision,
  nativeLegalEmployer:null,legalEmployer:null,sourceNativeSchema:schema,sourceNativeSchemaJSON:schemaNode.raw,sourceNativeFields:fields,sourceNativeSections:sections,sourceNativeValidThrough:validThrough,
  sourceNativeRequestedURL:row.requestedURL,sourceNativeCanonicalURL:row.canonicalURL,sourceNativeHiringOrganization:schema.hiringOrganization,
  sourceEmployerBinding:{kind:'own-native-JobPosting-publisher',name:schema.hiringOrganization.name,legalEntityVerified:false},
  sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,fullSourceDetailQualified:true}
}
function countryFromSchema(schema){const places=schema.jobLocation;return Array.isArray(places)&&places.length?nativeCountryName(places[0]?.address?.addressCountry):null}
