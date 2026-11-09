import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
export const HOME='https://www.fleetx.ai/careers'
export const need=(value,message)=>{if(!value)throw Object.assign(Error('Fleetx native: '+message),{code:'FLEETX_NATIVE_CONTRACT',abortRetries:true})}
export const hash=value=>createHash('sha256').update(value).digest('hex')
export const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const slug=value=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
const cardsOf=d=>{
 const index=d.nodes(n=>n.attrs.id==='current-openings');need(index.length===1,'one active openings container required')
 const cards=d.nodes(n=>n.tag==='div'&&['flex','flex-col','items-start','text-left','rounded','bg-white','p-6','shadow'].every(c=>d.hasClass(n,c)),index[0])
 return cards.map(node=>{
  const headings=d.nodes(n=>n.tag==='h3',node),paragraphs=d.nodes(n=>n.tag==='p',node)
  need(headings.length===1&&paragraphs.length===3,'native card shape changed')
  return {attrs:structuredClone(node.attrs),title:d.text(headings[0]),heading:{attrs:structuredClone(headings[0].attrs),text:d.text(headings[0])},
   paragraphs:paragraphs.map(p=>({attrs:structuredClone(p.attrs),text:d.text(p)})),text:d.text(node)}
 })
}
export function hasOfficialCareersSignal(html){
 try{const d=readNativeDocument(html),titles=activeHead(html).titles
  return titles.length===1&&titles[0]==='Career Opportunities At Fleetx | Fleetx'&&d.nodes(n=>n.attrs.id==='current-openings').length===1
   &&d.text(d.nodes(n=>n.attrs.id==='current-openings')[0]).includes('Current Openings')
 }catch{return false}
}
const supportedJavaScript=node=>['','text/javascript','application/javascript'].includes((node.attrs.type||'').trim().toLowerCase())
const inlineJavaScript=node=>!Object.hasOwn(node.attrs,'src')&&!Object.hasOwn(node.attrs,'nomodule')&&supportedJavaScript(node)
const walk=value=>{
 const pending=[value],all=[];let count=0
 while(pending.length){need(++count<=100000,'native data traversal bound');const current=pending.pop();if(!current||typeof current!=='object')continue
  all.push(current);for(const child of Object.values(current))if(child&&typeof child==='object')pending.push(child)
 }
 return all
}
export function readNativePage(html){
 need(hasOfficialCareersSignal(html),'active careers identity changed')
 const d=readNativeDocument(html),links=d.nodes(n=>n.tag==='link'&&n.attrs.rel?.toLowerCase()==='canonical')
 need(links.length===1&&links[0].attrs.href===HOME&&!d.nodes(n=>n.tag==='base').length,'current canonical/base changed')
 const schemas=d.nodes(n=>n.tag==='script'&&n.attrs.type?.toLowerCase()==='application/ld+json').map(n=>JSON.parse(n.raw))
 let stream=''
 for(const node of d.nodes(n=>n.tag==='script'&&inlineJavaScript(n))){
  const match=/^\s*self\.__next_f\.push\((\[[\s\S]*\])\)\s*;?\s*$/.exec(node.raw||'');if(!match)continue
  const packet=JSON.parse(match[1]);need(Array.isArray(packet)&&packet.length===2&&packet[0]===1&&typeof packet[1]==='string','literal Flight packet changed');stream+=packet[1]
 }
 const records=new Map()
 for(const line of stream.split('\n')){const match=/^([0-9a-f]+):(.*)$/.exec(line);if(match){need(!records.has(match[1]),'duplicate Flight record');records.set(match[1],match[2])}}
 need(records.has('0'),'current Flight root missing');const root=JSON.parse(records.get('0'))
 need(canonical(root.c)===canonical(['','careers']),'Flight route changed')
 const wrapper=value=>Array.isArray(value)&&value[0]==='$'&&value[3]&&typeof value[3].Component==='string'&&value[3].serverProvidedParams
 const branches=walk(root).filter(value=>Array.isArray(value)&&value.some(wrapper))
 need(branches.length===1,'unambiguous native page owner required')
 const owners=branches[0].filter(wrapper);need(owners.length===1,'duplicate native page component')
 const ref=/^\$([0-9a-f]+)$/.exec(owners[0][3].Component),moduleText=ref&&records.get(ref[1])
 need(moduleText?.startsWith('I'),'native page module declaration missing')
 const module=JSON.parse(moduleText.slice(1));need(Array.isArray(module)&&module.length===3&&Number.isSafeInteger(module[0])&&Array.isArray(module[1])&&module[2]==='default','native component ownership changed')
 const scriptGroups=branches[0].filter(value=>Array.isArray(value)&&value.length&&value.every(v=>Array.isArray(v)&&v[0]==='$'&&v[1]==='script'))
 need(scriptGroups.length===1,'native page script group changed')
 const paths=scriptGroups[0].map(v=>v[3]?.src),active=new Set(d.nodes(n=>n.tag==='script'&&n.attrs.src&&!Object.hasOwn(n.attrs,'nomodule')&&supportedJavaScript(n)).map(n=>n.attrs.src))
 need(paths.length>0&&paths.length<=4&&new Set(paths).size===paths.length&&paths.every(path=>typeof path==='string'&&/^\/_next\/static\/chunks\/[a-z0-9_-]+\.js$/.test(path)&&module[1].includes(path)&&active.has(path)),'unreviewed native page asset')
 return {cards:cardsOf(d),schemas,binding:{canonicalURL:HOME,moduleID:module[0],exportName:module[2],pageScripts:paths.map(p=>new URL(p,HOME).href)}}
}
export function readClientRoles(text,moduleID){
 const program=parse(text,{ecmaVersion:'latest',sourceType:'script'}),expression=program.body.length===1&&program.body[0].type==='ExpressionStatement'?program.body[0].expression:null
 need(expression?.type==='CallExpression'&&expression.callee.type==='MemberExpression'&&!expression.callee.computed&&expression.callee.property.name==='push'
  &&expression.callee.object.type==='LogicalExpression'&&expression.callee.object.operator==='||'
  &&expression.callee.object.left.type==='MemberExpression'&&expression.callee.object.left.object.name==='globalThis'&&expression.callee.object.left.property.name==='TURBOPACK'
  &&expression.arguments.length===1&&expression.arguments[0].type==='ArrayExpression','native chunk declaration changed')
 const elements=expression.arguments[0].elements,functions=[]
 for(let i=1;i<elements.length;i++)if(elements[i]?.type==='Literal'&&elements[i].value===moduleID){need(['ArrowFunctionExpression','FunctionExpression'].includes(elements[i+1]?.type),'native module body changed');functions.push(elements[i+1])}
 need(functions.length<=1,'duplicate native page module');if(!functions.length)return null
 const key=p=>p.key?.type==='Identifier'?p.key.name:p.key?.type==='Literal'?p.key.value:null
 const candidate=n=>n.type==='ObjectExpression'&&n.properties.some(p=>key(p)==='title')&&n.properties.some(p=>key(p)==='skills')
 const arrays=walk(functions[0].body).filter(n=>n.type==='ArrayExpression'&&n.elements?.some(candidate))
 need(arrays.length===1&&arrays[0].elements.length>0&&arrays[0].elements.length<=500,'unambiguous native opening array required')
 return arrays[0].elements.map(object=>{
  need(candidate(object),'native opening array element changed');const record={}
  for(const property of object.properties){const name=key(property)
   need(property.type==='Property'&&!property.computed&&property.kind==='init'&&!property.method&&typeof name==='string'&&!Object.hasOwn(record,name)
    &&property.value.type==='Literal'&&typeof property.value.value==='string','nonliteral/duplicate native opening field')
   Object.defineProperty(record,name,{value:property.value.value,enumerable:true,writable:true,configurable:true})
  }
  need(['title','location','exp','skills','col'].every(k=>typeof record[k]==='string'&&clean(record[k])),'incomplete native opening')
  return record
 })
}
export function makeObservation(card,record,context={}){
 const nativeRecord={nativeClientRole:record?structuredClone(record):null,visibleCard:structuredClone(card),schemas:structuredClone(context.page?.schemas||[]),binding:structuredClone(context.page?.binding||null)}
 const experience=record?.exp??card.paragraphs[0].text,skills=record?.skills??card.paragraphs[1].text,location=record?.location??card.paragraphs[2].text
 // The source index is a reference, not a published role/application link.
 return {title:card.title,company:'Fleetx',source:'fleetx',jobId:'fleetx-'+slug(card.title),requisitionId:null,sourceUrl:HOME,link:null,applyUrl:null,
  nativeCanonicalRoleURL:null,location:null,city:null,state:null,country:null,locations:[],countryEvidence:null,sourceCountryScopeUnresolved:true,
  sourceNativeLocationEvidence:{field:record?'native-client-opening.location':'visible-card-untyped-location',value:location,url:context.clientURL||HOME},
  requiredSkills:skills.replace(/^Key Skills:\s*/i,'').split(',').map(s=>s.trim()).filter(Boolean),experienceRequired:experience.replace(/^Minimum Exp\.:\s*/i,''),
  department:null,employmentType:null,remoteStatus:null,postingDate:null,postedAt:null,closingDate:null,firstEverPublication:null,legalEmployer:null,
  jobDescription:card.text,sourceDescription:card.text,nativeSourceRecord:nativeRecord,
  sourceRawNativeHTML:context.html??null,sourceRawNativeHTMLSHA256:context.html==null?null:hash(context.html),
  sourceRawNativeClient:context.clientText??null,sourceRawNativeClientSHA256:context.clientText==null?null:hash(context.clientText),
  sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'native-country-and-full-criteria-unproven',
  sourceNativeProofGaps:['native-role-country-unproven','native-whole-criteria-container-unverified','native-role-canonical-url-unpublished'],
  sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeRoleClosingReconciled:false,
  applicationVisited:false,activeApplyVerified:false,scrapedAt:context.clock??null}
}
export function bindNativeRecords(page,records,context){
 const jobs=[],held=[],groups=new Map()
 for(const card of page.cards){if(!groups.has(card.title))groups.set(card.title,[]);groups.get(card.title).push(card)}
 for(const [title,cards]of groups){const card=cards[0]
  if(!cards.every(other=>canonical(other)===canonical(card))){held.push({title,reason:'conflicting duplicate native cards',cards});continue}
  const matches=records.filter(r=>clean(r.title)===card.title)
  if(matches.length!==1){held.push({title:card.title,reason:'missing/ambiguous own native client record',card});continue}
  const record=matches[0],expected=clean([record.title,record.exp,record.skills,record.location].join(' '))
  if(card.text!==expected){held.push({title:card.title,reason:'own native card/client conflict',card,nativeClientRole:record});continue}
  jobs.push(makeObservation(card,record,{...context,page}))
 }
 return {jobs,held}
}
export function extractFleetxJobs(html){need(hasOfficialCareersSignal(html),'active careers identity changed');return cardsOf(readNativeDocument(html)).map(card=>makeObservation(card,null,{html}))}
