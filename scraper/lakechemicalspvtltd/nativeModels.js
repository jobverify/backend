import {createHash} from 'node:crypto'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
export const HOME='https://lakechemicals.com/',BOARD='https://lakechemicals.com/job-search',SOURCE='lakechemicalspvtltd'
export const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Lake native inventory: '+message),{code:'LAKE_NATIVE_CONTRACT',abortRetries:true})}
export const hash=value=>createHash('sha256').update(value).digest('hex')
export const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const slug=value=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
export const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>within(n,predicate))]
const one=(rows,label)=>{need(rows.length===1,'one '+label+' required');return rows[0]}
const tree=node=>typeof node==='string'?clean(node)||null:node.inert||['script','style','template'].includes(node.tag)?null:
 {tag:node.tag,attrs:structuredClone(node.attrs),children:node.children.map(tree).filter(n=>n!==null)}
// Preserve possibly applicable content before CSS can hide it. A full native
// criterion set is unqualified whenever the projections disagree.
const rawTree=node=>typeof node==='string'?clean(node)||null:['script','style','template'].includes(node.tag)?null:
 {tag:node.tag,attrs:structuredClone(node.attrs),children:node.children.map(rawTree).filter(n=>n!==null)}
const walk=value=>{const out=[],queue=[value];while(queue.length){const v=queue.pop();if(!v||typeof v!=='object')continue;out.push(v);queue.push(...Object.values(v).filter(x=>x&&typeof x==='object'))}return out}
const nativeSchema=(html,d)=>d.nodes(n=>n.tag==='script'&&(n.attrs.type||'').trim().toLowerCase()==='application/ld+json').map(n=>{
 try{return JSON.parse(n.raw)}catch{need(false,'invalid native schema')}
})
const view=(html,url)=>{
 const d=readVisibleNativeDocument(html,{strict:true}),raw=readNativeDocument(html),head=activeHead(html),title=url===HOME?'Home':'Job Search | Lake Chemicals'
 const parents=new Map(),originals=new Map()
 const align=(visible,original,parent)=>{
  need(original&&visible.tag===original.tag&&visible.children.length===original.children.length,'native visibility projection changed')
  originals.set(visible,original);if(parent)parents.set(visible,parent)
  visible.children.forEach((child,index)=>{if(typeof child!=='string')align(child,original.children[index],visible)})
 }
 align(one(d.nodes(n=>n.tag==='root'),'visible native root'),one(raw.nodes(n=>n.tag==='root'),'original native root'),null)
 need(head.titles.length===1&&head.titles[0]===title,'employer page identity changed')
 const meta=property=>head.metas.filter(m=>m.property===property)
 need(meta('og:site_name').length===1&&meta('og:site_name')[0].content==='Lake Chemicals','employer brand identity missing')
 need(meta('og:url').length===1&&meta('og:url')[0].content===(url===HOME?HOME+'home-1':BOARD),'employer canonical identity changed')
 need(!d.nodes(n=>n.tag==='base').length,'active base unsupported')
 const schemas=nativeSchema(html,raw)
 need(!walk(schemas).some(n=>(Array.isArray(n['@type'])?n['@type']:[n['@type']]).includes('JobPosting')),'new native JobPosting requires field review')
 return {d,raw,parents,originals,identity:{title:head.titles[0],publisher:meta('og:site_name')[0].content,canonical:meta('og:url')[0].content,metas:head.metas},schemas}
}
const names=new Intl.DisplayNames(['en'],{type:'region'}),foreignNames=new Set(['United States of America','USA','Great Britain','Czech Republic']),codes=[]
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=names.of(code)
 if(code!=='IN'&&name&&name!==code&&name!=='Unknown Region'){foreignNames.add(name);codes.push(code)}
}
const escaped=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const foreignName=new RegExp('(?<![\\p{L}\\p{N}])(?:'+[...foreignNames].map(escaped).join('|')+')(?![\\p{L}\\p{N}])','iu')
const foreignCode=new RegExp('(?<![A-Za-z])(?:'+codes.join('|')+'|UK|GBR|CAN|SGP|AUS|DEU)(?![A-Za-z])')
const geoAttributes=node=>within(node,n=>Object.entries(n.attrs).some(([key,value])=>/country|worksite|workplace|region|residen|jurisdiction|location|city|cities|town|state|province/i.test(key)
 ||key==='itemprop'&&/country|location|address/i.test(value))).map(n=>({tag:n.tag,attrs:structuredClone(n.attrs)}))
export function readLakeNativeHome(html){
 const {d,parents,originals,identity,schemas}=view(html,HOME)
 need(d.nodes(n=>n.tag==='a'&&n.attrs.href==='/job-search').length>0,'official job-search handoff missing')
 const byId=id=>d.nodes(n=>n.attrs['data-aid']===id)
 const readSite=(headingId,addressId,label,assigned)=>{
  const headings=byId(headingId),addresses=byId(addressId)
  if(headings.length!==1||addresses.length!==1||d.text(headings[0])!==label
   ||d.nodes(n=>/^h[1-6]$/.test(n.tag)&&d.text(n)===label).length!==1)return null
  let box=parents.get(addresses[0])
  while(box&&!within(box,n=>n===headings[0]).length)box=parents.get(box)
  if(!box||box.attrs['data-ux']!=='Block'||within(box,n=>/^h[1-6]$/.test(n.tag)).length!==1)return null
  const context=d.text(box),originalTree=rawTree(originals.get(box)),visibleTree=tree(box)
  if(canonical(originalTree)!==canonical(visibleTree)||geoAttributes(box).length||foreignName.test(context)||foreignCode.test(context)
   ||/\b(?:Country|Countries|City|Cities|State|Province|Region|Worksite|Workplace|Location)\s*:/i.test(context))return null
  const address=d.text(addresses[0])
  if(!assigned.test(address)||!/\bKarnataka\s*\(India\)\.?$/.test(address)||foreignName.test(address)||foreignCode.test(address)||geoAttributes(addresses[0]).length)return null
  return {heading:{attrs:structuredClone(headings[0].attrs),text:d.text(headings[0])},address:{attrs:structuredClone(addresses[0].attrs),text:address,tree:tree(addresses[0])},
   container:{attrs:structuredClone(box.attrs),text:context,tree:visibleTree,rawTree:originalTree}}
 }
 return {identity,schemas,sites:{factory:readSite('CONTACT_INTRO_HEADING_REND','CONTACT_INTRO_DESC_REND','Manufacturing Site',/\bAttibele Industrial Area\b/),
  headOffice:readSite('CONTACT_INFO_BIZ_NAME_REND','CONTACT_INFO_ADDRESS_REND','Corporate Office',/\bShivaji\s*Nagar\b/)}}
}
export function readLakeNativeBoard(html){
 const {d,originals,identity,schemas}=view(html,BOARD),body=one(d.nodes(n=>n.tag==='body'),'active hiring body')
 need(/we['’]re hiring!!/i.test(d.text(body)),'current first-party hiring identity missing')
 const forms=d.nodes(n=>n.tag==='form'&&n.attrs['data-ux']==='Form')
 const form=one(forms.filter(n=>/Attach Resume/.test(d.text(n))&&/Submit Application/.test(d.text(n))),'current published application form')
 const cards=d.nodes(n=>n.attrs['data-ux']==='ContentCard'),rows=[],held=[]
 need(cards.length>0,'no current native cards; empty inventory unverified')
 const publishedTitles=new Set(cards.flatMap(card=>within(card,n=>/^h[2-6]$/.test(n.tag)&&/^CONTENT_HEADLINE\d+_RENDERED$/.test(n.attrs['data-aid']||''))).map(n=>d.text(n)))
 // GoDaddy retains bare, hidden sizing headings copied from other cards. They
 // are retained in rawTree, but cannot supply this card's declared title or
 // criteria. No other hidden element is omitted from the coverage comparison.
 const covered=(original,visible)=>{
  if(typeof original==='string')return clean(original)||null
  if(['script','style','template'].includes(original.tag))return null
  if(visible.inert&&/^h[2-6]$/.test(original.tag)&&original.attrs['data-ux']==='ContentCardHeading'
   &&!original.attrs['data-aid']&&original.children.every(c=>typeof c==='string')
   &&publishedTitles.has(clean(original.children.join(' ')))&&!geoAttributes(original).length)return null
  return {tag:original.tag,attrs:structuredClone(original.attrs),children:original.children.map((c,i)=>covered(c,visible.children[i])).filter(c=>c!==null)}
 }
 for(const card of cards){
  try{
   need(canonical(covered(originals.get(card),card))===canonical(tree(card)),'native role visibility or omitted criteria is unresolved')
   const heading=one(within(card,n=>/^h[2-6]$/.test(n.tag)&&/^CONTENT_HEADLINE\d+_RENDERED$/.test(n.attrs['data-aid']||'')),'native role heading')
   const number=heading.attrs['data-aid'].match(/\d+/)[0],description=one(within(card,n=>n.attrs['data-aid']===`CONTENT_DESCRIPTION${number}_RENDERED`),'native role criteria')
   const title=d.text(heading),criteriaText=d.text(description),whole=d.text(card)
   need(title&&criteriaText.length>100&&/Qualification\s*:/.test(criteriaText)&&/Experience\s*:/.test(criteriaText)&&/Skills\s*:/.test(criteriaText),'native full criteria missing')
   need(whole===clean(title+' '+criteriaText),'unmodeled text outside native role criteria')
   need(!within(card,n=>n.tag==='form').length,'unmodeled native card form')
   const locations=[...criteriaText.matchAll(/\bLocation\s*:\s*([^]+?)(?=\b(?:Location|Qualification|Experience|Skills)\s*:|$)/gi)]
   need(locations.length===1&&locations[0][1].trim(),'missing or ambiguous native role location')
   const fields=[...criteriaText.matchAll(/\b(Countr\w*|Countries|Cit(?:y|ies)\w*|State\w*|Province\w*|Town\w*|Worksite\w*|Workplace\w*|Office\w*|Region\w*|Residen\w*|Jurisdiction\w*|Additional\s*Locations?|Secondary\s*Locations?|Work\s*Locations?|Job\s*Locations?|Location\w*)[^:\n]{0,30}\s*:/gi)]
   const unknown=fields.filter(m=>m[1].toLowerCase()!=='location').map(m=>({label:m[0],context:criteriaText.slice(m.index,m.index+180)}))
   unknown.push(...geoAttributes(card))
   const model={title,attrs:structuredClone(card.attrs),heading:{attrs:structuredClone(heading.attrs),text:title},
    description:{attrs:structuredClone(description.attrs),tree:tree(description)},criteriaText,wholeText:whole,tree:tree(card),rawTree:rawTree(originals.get(card))}
   rows.push({title,jobId:SOURCE+'-'+slug(title),nativeLocation:locations[0][1].trim(),sourceDescription:criteriaText,unknownGeographicFields:unknown,card:model,
    minimumQualification:criteriaText.match(/Qualification\s*:\s*(.*?)\s+Experience\s*:/i)?.[1]||null,
    experienceRequired:criteriaText.match(/Experience\s*:\s*(.*?)\s+Skills\s*:/i)?.[1]||null,
    requiredSkills:within(description,n=>n.tag==='li').map(n=>d.text(n))})
  }catch(error){held.push({reason:error.message,card:tree(card),rawCard:rawTree(originals.get(card)),text:d.text(card)})}
 }
 return {identity,schemas,applicationForm:tree(form),rows,held,nativeCardObservations:cards.length}
}
export const assignedLakeSite=(row,homepage)=>row.nativeLocation==='Attibele (Factory)'?homepage.sites.factory:
 row.nativeLocation==='Shivajinagar (Head Office)'?homepage.sites.headOffice:null
export function makeLakeObservation(row,homepage,page,html,homeHTML,clock){
 const site=homepage&&assignedLakeSite(row,homepage),qualified=Boolean(site&&!row.unknownGeographicFields.length)
 const nativeRecord={card:structuredClone(row.card),worksite:site?structuredClone(site):null,roleLocation:row.nativeLocation,
  employerPage:homepage?{identity:structuredClone(homepage.identity),schemas:structuredClone(homepage.schemas)}:null,
  rolePage:{identity:structuredClone(page.identity),schemas:structuredClone(page.schemas)},applicationForm:structuredClone(page.applicationForm)}
 const proof=qualified?{method:'role-assigned-named-worksite-to-current-employer-address',roleLocation:row.nativeLocation,siteHeading:site.heading.text,
  nativeAddress:site.address.text,nativeAddressSha256:hash(site.address.text),addressId:site.address.attrs['data-aid'],country:'India',sourceUrl:HOME,responseSha256:hash(homeHTML)}:null
 return {title:row.title,jobId:row.jobId,requisitionId:null,source:SOURCE,company:'Lake Chemicals Pvt. Ltd',sourceUrl:BOARD,applyUrl:BOARD,link:BOARD,
  applicationUrlIsGeneric:true,nativeCanonicalRoleURL:null,nativeLocation:row.nativeLocation,location:qualified?row.nativeLocation:null,city:null,state:null,country:qualified?'India':null,
  sourceCountryScopeUnresolved:!qualified,sourceWorksiteCountryProof:proof,nativeHiringOrganization:{name:page.identity.publisher,url:HOME},legalEmployer:null,
  sourceDescription:row.sourceDescription,jobDescription:row.sourceDescription,minimumQualification:row.minimumQualification,experienceRequired:row.experienceRequired,
  requiredSkills:structuredClone(row.requiredSkills),employmentType:null,remoteStatus:null,postingDate:null,postedAt:null,closingDate:null,firstEverPublication:null,
  nativeSourceRecord:nativeRecord,sourceRawNativeHTML:html,sourceRawNativeHTMLSHA256:hash(html),sourceRawNativeEmployerHTML:homeHTML,sourceRawNativeEmployerHTMLSHA256:homeHTML==null?null:hash(homeHTML),
  sourceDetailComplete:false,sourceDetailStatus:'partial',nativeRoleClosingReconciled:false,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  applicationVisited:false,activeApplyVerified:false,scrapedAt:clock}
}
