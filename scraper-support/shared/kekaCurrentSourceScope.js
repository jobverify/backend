import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument,activeIframeSources} from '../utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../utils/inventoryEvidence.js'

const hash=value=>createHash('sha256').update(value).digest('hex')
const sorted=values=>[...new Set(values)].sort()
const absolute=(value,base)=>{try{return new URL(value,base).href}catch{return String(value)}}
const atsHost=host=>/(?:^|\.)(?:ashbyhq\.com|greenhouse\.io|lever\.co|myworkdayjobs\.com|workdayjobs\.com|smartrecruiters\.com|icims\.com|jobvite\.com|bamboohr\.com|teamtailor\.com|recruitee\.com|workable\.com|breezy\.hr|applytojob\.com|jazz\.co|darwinbox\.com|keka\.com|freshteam\.com|zohorecruit\.(?:com|in)|successfactors\.(?:com|eu)|oraclecloud\.com|naukri\.com)$/.test(host)

// Current complete-source proof is intentionally conservative. An added script,
// form, frame, link, event handler, or active inline posting invalidates its scope.
// The baseline contains evidence from the real current pages, never ATS content
// manufactured for a downstream parser. Changed scope preserves known jobs.
export function captureActiveHiringScope(html,url){
 const doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0]
 // Styles are excluded from visible text by the native reader, but their raw
 // programs can hide or introduce hiring surfaces. Retain every parsed style
 // in DOM order, including its position relative to linked stylesheets and
 // whether an ancestor makes it inert. No CSS rule or unknown syntax is ignored.
 const styles=[];let position=0
 const captureStyles=(node,inertContext=false)=>{
  const at=position++
  if(node.tag==='style'){const raw=node.raw||'';styles.push({position:at,inertContext,
   attributes:Object.fromEntries(Object.entries(node.attrs).sort()),raw,sha256:hash(raw)})}
  for(const child of node.children||[])if(typeof child!=='string')captureStyles(child,inertContext||node.inert===true)
 }
 captureStyles(root)
 const links=sorted(doc.nodes(n=>['a','area'].includes(n.tag)&&n.attrs.href).map(n=>absolute(n.attrs.href,url)))
 const forms=sorted(doc.nodes(n=>n.tag==='form').map(n=>JSON.stringify({action:absolute(n.attrs.action||url,url),method:(n.attrs.method||'get').toLowerCase(),fields:doc.nodes(x=>['input','select','textarea'].includes(x.tag)&&x.attrs.name).map(x=>[x.tag,x.attrs.name,x.attrs.type||'']).sort()})))
 const frames=sorted(activeIframeSources(html).map(src=>absolute(src,url)))
 const scripts=sorted(doc.nodes(n=>n.tag==='script').map(n=>n.attrs.src?'src:'+absolute(n.attrs.src,url):'inline:'+String(n.attrs.type||'javascript')+':'+hash(n.raw||'')))
 const interactions=sorted(doc.nodes(n=>Object.keys(n.attrs).some(key=>/^on/i.test(key))).map(n=>JSON.stringify(Object.fromEntries(Object.entries(n.attrs).filter(([key])=>/^on/i.test(key)).sort()))))
 const activeElementAttributesSha256=hash(JSON.stringify(doc.nodes(n=>n.tag!=='root').map(n=>[n.tag,Object.entries(n.attrs).sort()])))
 return{activeTextSha256:hash(doc.text(root)),activeElementAttributesSha256,links,forms,frames,scripts,interactions,styles}
}

export function createCurrentSourceScope({baselines,kekaRootUrl}){
 const gaps=new Set(),approved=new URL(kekaRootUrl)
 return{
  gaps,
  observeRenderer(url,body){
   const expected=baselines.$renderers?.[url]
   if(!expected||hash(body)!==expected)gaps.add(`unreviewed-renderer-content:${url}`)
  },
  observe(url,html){
   const current=captureActiveHiringScope(html,url),baseline=baselines[url]
   if(!baseline){gaps.add(`unreviewed-native-page:${url}`);return}
   for(const key of Object.keys(current))if(JSON.stringify(current[key])!==JSON.stringify(baseline[key]))gaps.add(`changed-active-${key}:${url}`)
   for(const value of [...current.links,...current.frames,...current.scripts.filter(s=>s.startsWith('src:')).map(s=>s.slice(4))]){
    let u;try{u=new URL(value)}catch{continue}
    const observedKekaAsset=u.hostname==='cdn.keka.com'&&baseline.scripts.includes('src:'+u.href)
    const observedVendorAttribution=u.hostname==='www.keka.com'&&u.pathname==='/'&&baseline.links.includes(u.href)
    if(atsHost(u.hostname)&&!(u.origin===approved.origin&&u.pathname.startsWith('/careers'))&&!observedKekaAsset&&!observedVendorAttribution)gaps.add(`additional-ats:${u.href}`)
    if(/(?:^|\.)linkedin\.com$/.test(u.hostname)&&/^\/jobs(?:\/|$)/.test(u.pathname))gaps.add(`additional-job-channel:${u.href}`)
   }
  },
 }
}

// Parse publisher JavaScript as data. Only a direct, top-level, literal object
// assignment in its own executable script establishes khConfig. Comments,
// strings, template literals, functions, computed fields and expressions cannot.
export function hasLiteralActiveKekaConfiguration(html,{identifier,kekaRootUrl,portalName='default'}){
 const doc=readNativeDocument(html),candidates=[]
 for(const script of doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&(!n.attrs.type||/^(?:application|text)\/(?:java|ecma)script$/i.test(n.attrs.type)))){
  let program;try{program=parse(script.raw||'',{ecmaVersion:'latest',sourceType:'script'})}catch{if((script.raw||'').includes('khConfig'))return false;continue}
  const visit=node=>{if(!node||typeof node!=='object')return;if(node.type==='AssignmentExpression'&&node.left?.type==='MemberExpression'&&node.left.object?.name==='window'&&(node.left.property?.name==='khConfig'||node.left.property?.value==='khConfig'))candidates.push({node,program});for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value)}
  visit(program)
 }
 if(candidates.length!==1)return false
 const{node,program}=candidates[0]
 if(program.body.length!==1||program.body[0].type!=='ExpressionStatement'||program.body[0].expression!==node||node.operator!=='='||node.left.computed||node.right.type!=='ObjectExpression')return false
 const values={}
 for(const prop of node.right.properties){if(prop.type!=='Property'||prop.computed||prop.method||prop.shorthand||prop.kind!=='init'||!['Identifier','Literal'].includes(prop.key.type)||prop.value.type!=='Literal'||typeof prop.value.value!=='string')return false;const key=prop.key.name??prop.key.value;if(!['identifier','domain','portalName','targetContainer'].includes(key)||Object.hasOwn(values,key))return false;values[key]=prop.value.value}
 return values.identifier===identifier&&values.domain===kekaRootUrl&&(values.portalName??'default')===portalName
}

const geographicKey=/location|countr|cit(?:y|ies)|state|region|address|geograph|workplace|office|remote|worksite|territor|eligib|residen|relocat|timezone|postal|zip|province/i
const locationFields=new Set(['id','name','city','state','countryCode','countryName'])
const jobFields=new Set(['id','title','departmentIdentifier','departmentName','description','excerpt','jobType','experience','salaryRange','salaryRangeFormat','publishedOn','publishedSinceDays','skillNames','jobLocations','jobNumber'])
export function unhandledKekaGeography(job){
 const unknown=[]
 const walk=(value,path)=>{if(!value||typeof value!=='object')return;for(const[key,child]of Object.entries(value)){const next=`${path}.${key}`;if(geographicKey.test(key))unknown.push(next);if(child&&typeof child==='object')walk(child,next)}}
 for(const[key,value]of Object.entries(job||{})){
  if(key==='jobLocations'){
   if(!Array.isArray(value)||!value.length)unknown.push('jobLocations')
   if(Array.isArray(value))for(const[at,loc]of value.entries())for(const[locKey,child]of Object.entries(loc||{})){if(!locationFields.has(locKey))unknown.push(`jobLocations[${at}].${locKey}`);if(child&&typeof child==='object')walk(child,`jobLocations[${at}].${locKey}`)}
  }else{if(!jobFields.has(key)||geographicKey.test(key))unknown.push(key);if(value&&typeof value==='object')walk(value,key)}
 }
 return sorted(unknown)
}

export function finishCurrentKekaInventory(jobs,{raw,unknown=[],scope,evidence}){
 const incomplete=unknown.length>0||scope.gaps.size>0
 for(const job of jobs){job.sourceListingComplete=!incomplete;job.lifecycleCleanupAllowed=!incomplete;if(unknown.length){job.sourceCountryCoverageGapIds=unknown.map(row=>String(row.id));job.sourceNativeUnresolvedPayloads=unknown}if(scope.gaps.size)job.sourceUnreviewedHiringSurfaces=[...scope.gaps]}
 return attachInventoryEvidence(jobs,{...evidence,status:incomplete?'coverage-gap':raw.length?'complete-inventory':'verified-empty',listingComplete:!incomplete,reportedTotal:scope.gaps.size?null:raw.length,indiaFacetCount:incomplete?null:jobs.length,reason:incomplete?[unknown.length?`unresolved-role-country:${unknown.map(row=>row.id).join(',')}`:null,...scope.gaps].filter(Boolean).join(';'):evidence.reason})
}
