import {isDeepStrictEqual as same} from 'node:util'
import {activeHead,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {need,one,all,norm,page,props,scalarFields,constraints,authoredLines,semanticCriteria,schemas,schemaContext,schemaCarrier,nativeCountryName,writtenPlaceCountries} from './currentFacts20261120.js'
import {currentReader,nativeUnavailable} from './currentRead20261120.js'

export const CAREERS='https://hex.tech/careers/'
const COMPANY='Hex',SOURCE='hex',UUID=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
const key=value=>String(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
const applicationKeys=new Set(['applyurl','applicationurl','jobapplicationurl','applyuri','applicationuri','applylink','applicationlink','joburl','detailurl'])
const employerKeys=new Set(['employer','employername','company','companyname','hiringorganization','legalemployer'])
const countryKeys=new Set(['country','countrycode','jobcountry','workcountry','workplacecountry','addresscountry'])
const placeKeys=new Set(['joblocation','joblocations','worklocation','worklocations','primarylocation','primarylocations'])
const context=(at,countries)=>({employer:COMPANY,observedAt:at,countryAlternatives:countries})
function pure(fn){try{return fn()}catch(error){if(error?.nativeContradiction)throw error;throw Object.assign(Error('Hex native complete parser/contract: '+error.message),{cause:error,abortRetries:true,nativeContradiction:true,softFailure:true,failureKind:'parser_or_contract_error',lifecycleCleanupAllowed:false})}}
function safeURL(value,base=CAREERS,{fragment=false}={}){need(typeof value==='string'&&value===value.trim()&&value,'native URL malformed');const u=new URL(value,base);need(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&(fragment||!u.hash),'native exact public HTTPS URL differs');return u}
export function isHexRoleURL(value){try{const u=safeURL(value),part=u.pathname.slice('/careers/'.length,-1);return u.origin===new URL(CAREERS).origin&&u.pathname.startsWith('/careers/')&&u.pathname.endsWith('/')&&/^[a-z0-9_()&-]+$/i.test(decodeURIComponent(part))&&u.href===value}catch{return false}}
// Current Hex metadata writes a literal ampersand for the same role whose
// advertised path encodes it. Admit only that path spelling equivalence.
const sameRoleURL=(value,expected)=>value===expected||isHexRoleURL(value)&&isHexRoleURL(expected)&&value.replace(/%26/gi,'&')===expected.replace(/%26/gi,'&')
function applications(properties,allowed){for(const p of properties)if(applicationKeys.has(key(p.key))&&p.value!=null)need(allowed.includes(safeURL(p.value).href),'native same-role application or detail alias conflicts')}
function paths(root,target,path=[]){if(root===target)return[...path,root];for(const child of root.children.filter(n=>typeof n!=='string')){const found=paths(child,target,[...path,root]);if(found)return found}return null}
function carrier(p,node,at,countries=[],allowed=[CAREERS],raw=false){
 const ancestors=paths(raw?p.raw.root:p.root,node);need(ancestors,'actual native carrier ancestry missing')
 need(ancestors.every(n=>!Object.hasOwn(n.attrs,'disabled')&&!Object.hasOwn(n.attrs,'hidden')&&!Object.hasOwn(n.attrs,'inert')&&n.attrs['aria-disabled']!=='true'&&n.attrs['aria-hidden']!=='true'&&!/(?:^|\s)(?:disabled|hidden|d-none)(?:\s|$)/.test(n.attrs.class??'')&&!/(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))/i.test(n.attrs.style??'')),'actual native publisher/role/control carrier withdrawn')
 const properties=props(ancestors.map(n=>({...n,inactive:false,inert:false})));applications(properties,allowed);return constraints(properties,[],context(at,countries))
}
const types=value=>(Array.isArray(value?.['@type'])?value['@type']:[value?.['@type']]).map(t=>String(t??'').replace(/^https?:\/\/schema\.org\//,''))
function typed(value,type,{required=false}={}){need(value&&typeof value==='object'&&!Array.isArray(value),'native typed '+type+' malformed');if(value['@context']!=null)need(typeof value['@context']==='string'&&/^https?:\/\/schema\.org\/?$/.test(value['@context']),'native typed context differs');if(required||value['@type']!=null)need(types(value).length>0&&types(value).every(t=>t===type),'native typed '+type+' differs')}
function employerIdentity(value,{required=false}={}){typed(value,'Organization',{required});need(value.name===COMPANY,'native exact employer/publisher name differs');for(const field of['url','@id'])if(value[field]!=null){const u=safeURL(value[field],CAREERS,{fragment:field==='@id'});u.hash='';need(['hex.tech','www.hex.tech'].includes(u.hostname)&&u.pathname==='/','native employer/publisher root identity differs')}}
function publisherReference(value){if(typeof value==='string'){need(value===COMPANY,'native publisher reference name differs');return}typed(value,'Organization');need(value.name!=null||value.url!=null||value['@id']!=null,'native publisher reference unresolved');if(value.name!=null)need(value.name===COMPANY,'native publisher reference employer differs');for(const field of['url','@id'])if(value[field]!=null){const u=safeURL(value[field],CAREERS,{fragment:field==='@id'});u.hash='';need(['hex.tech','www.hex.tech'].includes(u.hostname)&&u.pathname==='/','native current publisher reference root differs')}}
function foreignCountry(value){const object=value&&typeof value==='object'&&!Array.isArray(value);if(object)typed(value,'Country');const raw=object?value.name:value,country=nativeCountryName(raw);need(country&&country!=='India','native explicit workplace is India or unresolved');if(object)for(const[field,alias]of Object.entries(value))if(['country','countrycode','addresscountry','code','identifier','alternatename'].includes(key(field))&&alias!=null)need(typeof alias==='string'&&nativeCountryName(alias)===country,'native Country name/code aliases conflict');return country}
function publisherFacts(value,at,allowed,depth=0){
 need(depth<=32,'finite publisher scope exceeded');if(!value||typeof value!=='object')return
 const kept=Object.fromEntries(Object.entries(value).filter(([name])=>!countryKeys.has(key(name))))
 applications(Object.entries(kept).map(([key,value])=>({key,value})),allowed);constraints(Object.entries(kept).filter(([name])=>!employerKeys.has(key(name))).map(([key,value])=>({key,value})),[],context(at,[]))
 for(const[field,child]of Object.entries(kept)){if(key(field)==='publisher'&&child!=null)publisherReference(child);if(employerKeys.has(key(field))&&child!=null){if(typeof child==='object')employerIdentity(child);else need(child===COMPANY,'native publisher employer differs')}if(child&&typeof child==='object')publisherFacts(child,at,allowed,depth+1)}
}
function publisher(html,url,at,row){
 const p=page(html,url,{canonical:false}),head=activeHead(p.normalized),publisherCarriers=[]
 const qualify=(node,raw=false)=>{publisherCarriers.push({node,raw});if(!row)carrier(p,node,at,[],[url],raw)}
 need(/\bHex\b/.test(p.title??''),'native current publisher brand differs')
 const canonicals=p.d.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').toLowerCase()==='canonical');if(canonicals.length){const node=one(canonicals,'current publisher canonical');need(sameRoleURL(safeURL(node.attrs.href,url).href,url),'native publisher canonical differs');qualify(node)}
 const actualHeadTitle=one(all(p.raw.root,n=>n.tag==='title').filter(n=>paths(p.raw.root,n).some(parent=>parent.tag==='head')),'actual head-owned publisher title');qualify(actualHeadTitle,true)
 for(const[property,expected]of[['og:site_name',COMPANY],['og:url',url]]){const values=head.metas.filter(m=>m.property===property);need(values.length===1&&(property==='og:url'?sameRoleURL(values[0].content,expected):values[0].content===expected),'native current '+property+' publisher differs')}
 for(const meta of p.d.nodes(n=>n.tag==='meta'&&['og:site_name','og:url','og:title'].includes(n.attrs.property)))qualify(meta)
 const headings=p.d.nodes(n=>n.tag==='h1');need(headings.length>0&&headings.length<=8,'native current own headings missing/excessive');if(row)need(headings.length===1&&norm(p.d.text(headings[0]))===row.title,'native own role heading conflicts with advertised identity')
 const structured=schemas(p,{types:['JobPosting','WebPage','AboutPage','WebSite','Organization']})
 for(const model of structured){need(typeof schemaContext(model)==='string'&&/^https?:\/\/schema\.org\/?$/.test(schemaContext(model)),'native own structured context differs');const declared=types(model);qualify(schemaCarrier(model));if(declared.includes('JobPosting')){need(Boolean(row),'additional native JobPosting requires role qualification');continue}publisherFacts(model,at,[url]);if(declared.includes('Organization'))employerIdentity(model);else{if(model.name!=null)need(typeof model.name==='string'&&(/\bHex\b/.test(model.name)||row&&norm(model.name).includes(row.title)),'native supplied structured page publisher/role name differs');if(model.url!=null)need(safeURL(model.url,url).href===url,'native structured page URL differs');if(model['@id']!=null){const u=safeURL(model['@id'],url,{fragment:true});u.hash='';need(u.href===url,'native structured page identifier differs')}}}
 return{...p,headings,structured,publisherCarriers}
}
export function readCurrentHexInventory(html,{observedAt=new Date().toISOString()}={}){
 const p=publisher(html,CAREERS,observedAt),owners=p.d.nodes(n=>n.children.some(c=>typeof c!=='string'&&c.tag==='h2'&&norm(p.d.text(c))==='Open roles')&&n.children.some(c=>typeof c!=='string'&&/^\[\s*\d+\s*\]$/.test(p.d.text(c))))
 const owner=one(owners,'current semantic Open roles/count owner'),counter=one(owner.children.filter(c=>typeof c!=='string'&&/^\[\s*\d+\s*\]$/.test(p.d.text(c))),'actual native role count')
 const total=Number(p.d.text(counter).match(/\d+/)[0]);need(Number.isSafeInteger(total)&&total>0&&total<=2000,'native finite listing total unavailable');carrier(p,owner,observedAt);carrier(p,counter,observedAt)
 for(const heading of p.headings)carrier(p,heading,observedAt)
 const cards=p.d.nodes(n=>n.tag==='a'&&n.attrs.href).flatMap(node=>{let u;try{u=new URL(node.attrs.href,CAREERS)}catch{return[]}if(u.origin!==new URL(CAREERS).origin||!u.pathname.startsWith('/careers/')||u.pathname==='/careers/')return[];need(isHexRoleURL(u.href),'additional unqualified own role URL');const paragraphs=p.d.nodes(n=>n.tag==='p',node);need(paragraphs.length===2,'actual advertised role title/location incomplete');const title=norm(p.d.text(paragraphs[0])),location=norm(p.d.text(paragraphs[1]));need(title&&location,'native advertised role text missing');return{url:u.href,title,location,node,paragraphs,originalAttributes:structuredClone(node.attrs)}})
 need(cards.length===total&&new Set(cards.map(r=>r.url)).size===total,'native advertised count and all active own roles disagree')
 return{total,cards,p,originalCountAttributes:structuredClone(counter.attrs)}
}
function checkRecord(model,at,countries,allowed,{skipPlaces=false}={}){
 let visited=0
 function visit(value,depth=0){need(depth<=32&&++visited<=20000,'finite same-role record scope exceeded');if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(v=>visit(v,depth+1));return}
  applications(Object.entries(value).map(([key,value])=>({key,value})),allowed);constraints(Object.entries(value).filter(([field])=>!countryKeys.has(key(field))&&!employerKeys.has(key(field))&&!['applicantlocationrequirements','eligibleregion'].includes(key(field))).map(([key,value])=>({key,value})),[],context(at,countries))
  for(const[field,entry]of Object.entries(value)){if(entry==null)continue;const name=key(field)
   if(countryKeys.has(name))need(countries.includes(foreignCountry(entry)),'native same-role explicit country conflicts')
   if(name==='publisher')publisherReference(entry)
   if(employerKeys.has(name)){if(typeof entry==='object'){employerIdentity(entry);publisherFacts(entry,at,allowed)}else need(entry===COMPANY,'native same-role employer differs');continue}
   if(['applicantlocationrequirements','eligibleregion'].includes(name)){const entries=Array.isArray(entry)?entry:[entry];need(entries.length>0&&entries.length<=32,'native applicant country scope malformed');for(const applicant of entries){foreignCountry(applicant);if(applicant&&typeof applicant==='object')visit(applicant,depth+1)}continue}
   if(placeKeys.has(name)&&!skipPlaces){const entries=Array.isArray(entry)?entry:[entry];need(entries.length>0&&entries.length<=32,'native additional workplace alternatives malformed');for(const place of entries)need(countries.includes(workplace(place,at,allowed).country),'native same-role additional workplace contradicts qualified alternatives');continue}
   if(name==='publishedat'){need(typeof entry==='string'&&/T/.test(entry)&&Number.isFinite(Date.parse(entry))&&Date.parse(entry)<=Date.parse(at),'native published date malformed or future')}
   if(types(value).includes('Country'))foreignCountry(value)
   if(['name','propertyid'].includes(name)&&Object.hasOwn(value,'value')){const property={key:String(entry),value:value.value};applications([property],allowed);constraints([property],[String(entry)+': '+String(value.value)],context(at,countries))}
   if(entry&&typeof entry==='object')visit(entry,depth+1)
  }
 }
 visit(model)
}
function workplace(place,at,allowed){
 typed(place,'Place',{required:true});const address=place.address?.postalAddress??place.address;typed(address,'PostalAddress',{required:true});const country=foreignCountry(address.addressCountry)
 for(const text of[place.name,address.name,address.addressLocality,address.addressRegion,address.streetAddress].filter(v=>v!=null)){need(typeof text==='string','native workplace text malformed');need(writtenPlaceCountries(text).every(c=>c===country||country==='United States'&&c==='Georgia'&&text===address.addressRegion&&text==='Georgia'),'native authored workplace contradicts explicit typed country')}
 checkRecord(place,at,[country],allowed,{skipPlaces:true});return{country,originalPlace:structuredClone(place)}
}
function criteria(p,at,countries,allowed,scope=p.root){
 const nodes=all(scope,n=>!n.inert&&!n.inactive),semantic=semanticCriteria(scope),properties=[...props(nodes),...semantic.properties],lines=[...authoredLines(scope),...semantic.lines]
 applications(properties,allowed);return constraints(properties,lines,context(at,countries))
}
export function inspectCurrentHexRole(html,row,{observedAt=new Date().toISOString()}={}){
 need(isHexRoleURL(row?.url)&&norm(row.title),'native exact advertised role missing');const p=publisher(html,row.url,observedAt,row),model=one(p.structured.filter(m=>types(m).includes('JobPosting')),'actual own JobPosting'),allowed=[row.url]
 typed(model,'JobPosting',{required:true});need(model.url===row.url&&norm(model.title)===row.title,'native role structured identity conflicts');if(model['@id']!=null){const id=safeURL(model['@id'],row.url,{fragment:true});id.hash='';need(id.href===row.url,'native JobPosting identifier differs')}
 employerIdentity(model.hiringOrganization,{required:true})
 const locations=Array.isArray(model.jobLocation)?model.jobLocation:[model.jobLocation];need(locations.length>0&&locations.length<=32,'native typed workplace alternatives missing');const workplaces=locations.map(v=>workplace(v,observedAt,allowed)),countries=[...new Set(workplaces.map(p=>p.country))]
 for(const {node,raw} of p.publisherCarriers)carrier(p,node,observedAt,countries,allowed,raw)
 need(typeof model.datePosted==='string'&&norm(model.datePosted),'native original publication absent');const dates=constraints(scalarFields(model),[],context(observedAt,countries));checkRecord(model,observedAt,countries,allowed)
 const description=extractActiveDescription(model.description);need(description&&description.length>=100&&p.d.text(p.root).includes(description),'full original native criteria missing from active own role')
 const d=page(model.description,row.url,{canonical:false,requireTitle:false}),descriptionDates=criteria(d,observedAt,countries,allowed)
 for(const schema of schemas(d,{types:['JobPosting','WebPage']})){need(/^https?:\/\/schema\.org\/?$/.test(schemaContext(schema)??''),'native criteria schema context differs');if(schema.url!=null)need(schema.url===row.url,'native criteria same-role URL differs');if(types(schema).includes('WebPage')){const uri=schema.url??schema['@id'];need(uri===row.url,'native criteria WebPage identity absent/different')}if(schema.title!=null)need(norm(schema.title)===row.title,'native criteria title differs');carrier(d,schemaCarrier(schema),observedAt,countries,allowed);checkRecord(schema,observedAt,countries,allowed)}
 for(const heading of p.headings)carrier(p,heading,observedAt,countries,allowed)
 const main=one(p.d.nodes(n=>n.tag==='main'&&p.d.nodes(h=>h.tag==='h1',n).includes(p.headings[0])),'actual own same-role main content');need(p.d.text(main).includes(description),'original criteria absent from actual same-role main content');carrier(p,main,observedAt,countries,allowed)
 const bodyDates=criteria(p,observedAt,countries,allowed,main)
 for(const schema of p.structured.filter(m=>types(m).some(t=>['WebPage','AboutPage'].includes(t))))checkRecord(schema,observedAt,countries,allowed)
 const selectors=p.d.nodes(n=>n.attrs.id==='ashby_embed'),originalSelectors=all(p.raw.root,n=>n.attrs.id==='ashby_embed');need(selectors.length<=1&&originalSelectors.length===selectors.length,'actual native application selector ambiguous or withdrawn');const selector=selectors[0];if(selector){carrier(p,selector,observedAt,countries,allowed);carrier(p,originalSelectors[0],observedAt,countries,allowed,true);need(UUID.test(selector.attrs['data-jid']??''),'original native application selector malformed')}
 need(writtenPlaceCountries(row.location).every(c=>countries.includes(c)),'advertised explicit country conflicts with same-role structured country')
 return{url:row.url,title:row.title,country:countries.length===1?countries[0]:null,countries,workplaces,nativeJobPosting:structuredClone(model),originalCriteriaHTML:model.description,description,nativeDates:{posted:[...dates.posted,...descriptionDates.posted,...bodyDates.posted],expiry:[...dates.expiry,...descriptionDates.expiry,...bodyDates.expiry]},nativeApplicationSelector:selector?{originalAttributes:structuredClone(selector.attrs),nativeSelectorID:selector.attrs['data-jid'],publicApplicationURL:null,activationVerified:false}:null,applicationsSubmitted:false,companyScopeComplete:false,legalEmployer:null}
}
function qualifyCards(inventory,proofs,at){for(const card of inventory.cards){const proof=one(proofs.filter(p=>p.url===card.url),'same-role native card proof');for(const node of[card.node,...card.paragraphs])carrier(inventory.p,node,at,proof.countries,[card.url])}}
const indexSummary=i=>({total:i.total,rows:i.cards.map(({url,title,location,originalAttributes})=>({url,title,location,originalAttributes})),originalCountAttributes:i.originalCountAttributes})
export async function runCurrentHex(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchPage&&!options.fetchJson,'original native Responses required');for(const field of['maxJobs','maxPages'])if(options[field]!=null)need(Number.isSafeInteger(options[field])&&options[field]>=0,'supported finite caller cap malformed')
 const at=pure(()=>new Date((typeof options.now==='function'?options.now():options.now)??new Date()).toISOString()),io=currentReader([CAREERS],['https://hex.tech'],options),observations=[];let complete=false,opening,closing
 try{
  if(options.maxJobs!==0&&options.maxPages!==0){
   const openingBody=await io.read(CAREERS);opening=pure(()=>readCurrentHexInventory(openingBody.text,{observedAt:at}))
   if(opening.total*2+2>220)throw Object.assign(Error('Hex configured listing exceeds finite complete paired-read budget'),{nativeUnavailable:true,abortRetries:true})
   const openingRoles=[],closingRoles=[]
   for(const row of opening.cards){io.allow(row.url);const body=await io.read(row.url);openingRoles.push(pure(()=>inspectCurrentHexRole(body.text,row,{observedAt:at})))}
   pure(()=>qualifyCards(opening,openingRoles,at));observations.push({phase:'opening',inventory:indexSummary(opening),roles:openingRoles})
   for(const row of opening.cards){const body=await io.read(row.url);closingRoles.push(pure(()=>inspectCurrentHexRole(body.text,row,{observedAt:at})))}
   const closingBody=await io.read(CAREERS);closing=pure(()=>readCurrentHexInventory(closingBody.text,{observedAt:at}));pure(()=>qualifyCards(closing,closingRoles,at))
   const membership=i=>i.cards.map(({url,title,location})=>({url,title,location})).sort((a,b)=>a.url.localeCompare(b.url))
   need(same(membership(opening),membership(closing)),'native complete closing advertised membership changed')
   const binding=rows=>rows.map(row=>({url:row.url,title:row.title,countries:[...row.countries].sort(),nativeSelectorID:row.nativeApplicationSelector?.nativeSelectorID??null})).sort((a,b)=>a.url.localeCompare(b.url))
   need(same(binding(openingRoles),binding(closingRoles)),'native closing same-role identity/workplace/application-selector binding changed')
   observations.push({phase:'closing',inventory:indexSummary(closing),roles:closingRoles});complete=true
  }
  return await finish()
 }catch(error){io.check();if(nativeUnavailable(error)||error?.nativeContradiction)throw error;return pure(()=>{throw error})}finally{io.close()}
 async function finish(){
  const jobs=[],audit={source:SOURCE,observedAt:at,observations,originalResponses:structuredClone(io.receipts),configuredOwnListingComplete:complete,configuredOwnCurrentIndiaJobs:complete?0:null,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,legalEmployer:null,rendererOrUIActivationVerified:false,backendApplicationActivationVerified:false,applicationsSubmitted:false,nativeProgramsExecuted:false}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening?.total??0,observedVacancyCount:opening?.total??0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});if(options.onAudit)await io.callback(options.onAudit,structuredClone(audit));io.check()
  return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:CAREERS,firstParty:complete,listingComplete:complete,lifecycleCleanupAllowed:false,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:at,reason:complete?'paired-current-own-advertised-native-count-all-same-role-JobPostings-and-all-explicit-foreign-workplaces;configured-own-listing-India-projection-only;company-totals-application-activation-and-cleanup-held':'caller-zero-cap-without-native-inventory-proof'})
 }
}
