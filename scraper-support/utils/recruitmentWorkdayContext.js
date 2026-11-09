import {extractActiveDescription,readNativeDocument,decodeNativeEntities} from './activeNativeHtml.js'
const check=(ok,message)=>{if(!ok)throw Error('Current Workday context: '+message)}
const INDIA='c4f78be1a8f14da0ab49ce1162348a5e'
export function publishedIndiaLocationFacets(payload){
 const found=new Map()
 const visit=(node,depth=0)=>{
  if(!node||typeof node!=='object'||depth>8)return
  if(node.facetParameter==='locations'){
   check(Array.isArray(node.values),'Malformed native locations facet')
   for(const value of node.values){
    if(typeof value?.descriptor!=='string'||!/,\s*India$/.test(value.descriptor))continue
    check(typeof value.id==='string'&&/^[a-f0-9]{32}$/.test(value.id)&&Number.isSafeInteger(value.count)&&value.count>=0,
     'Invalid native India office facet')
    check(!found.has(value.id),'Duplicate native India office facet')
    found.set(value.id,{facetParameter:'locations',id:value.id,descriptor:value.descriptor,count:value.count})
   }
  }
  for(const value of Array.isArray(node.values)?node.values:[])if(value?.facetParameter)visit(value,depth+1)
 }
 for(const node of Array.isArray(payload?.facets)?payload.facets:[])visit(node)
 check(found.size<=50,'Native India office selection bound exceeded')
 return[...found.values()].sort((a,b)=>a.id.localeCompare(b.id))
}
const calendar=(value,now,publication)=>{
 check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value),'Native calendar date missing')
 const parsed=new Date(value+'T00:00:00.000Z')
 check(Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===value,'Invalid native calendar date')
 check(publication?value<=now.slice(0,10):value>=now.slice(0,10),publication?'Future native publication':'Expired native role')
}
export function reviewedWorkdayEmployerDeclaration(description,contract){
 if(!contract||typeof contract.name!=='string'||typeof contract.prefix!=='string'||!contract.name.trim()||contract.prefix.length<30)return null
 if(!['name-leading-statement','first-paragraph-employment-introduction'].includes(contract.kind))return null
 if(contract.kind==='name-leading-statement'&&!contract.prefix.startsWith(contract.name+' '))return null
 if(contract.kind==='first-paragraph-employment-introduction'&&!contract.prefix.includes(contract.name))return null
 const doc=readNativeDocument(description),blocked=new Set(['blockquote','q','pre','code','template','aside','object','iframe','noscript','script','style'])
 const excluded=node=>node.inert||blocked.has(node.tag)||['hidden','inert','disabled'].some(key=>Object.hasOwn(node.attrs||{},key))
  ||node.attrs?.['aria-hidden']==='true'||node.attrs?.['aria-disabled']==='true'
 const ownText=node=>typeof node==='string'?node:excluded(node)?'':node.children.map(ownText).join(' ')
 let paragraphs=[]
 const visit=node=>{
  if(typeof node==='string'||excluded(node))return
  if(node.tag==='p'){const value=decodeNativeEntities(ownText(node)).replace(/\s+/g,' ').trim();if(value)paragraphs.push(value)}
  for(const child of node.children)visit(child)
 }
 visit(doc.nodes(node=>node.tag==='root')[0])
 if(contract.kind==='first-paragraph-employment-introduction')paragraphs=paragraphs.slice(0,1)
 const prefix=contract.prefix.replace(/\s+/g,' ').trim()
 const paragraph=paragraphs.find(value=>value.startsWith(prefix))
 return paragraph?{name:contract.name,statement:prefix,kind:contract.kind,legalEmployer:null}:null
}
export function currentWorkdayRoleSnapshot(payload,row,site,now,employerDeclaration){
 check(payload&&typeof payload==='object'&&!payload.error&&!payload.errors,'Native detail error envelope')
 const v=payload.jobPostingInfo
 check(v&&v.posted===true&&v.canApply===true,'Native role is not currently public and applicable')
 check(v.title===row.title&&v.jobPostingSiteId===site&&typeof v.jobReqId==='string'&&v.jobReqId.trim()
  &&/^[a-f0-9]{32}$/.test(v.id||''),'Native role identity changed')
 check(/^[a-z0-9_-]{1,128}$/i.test(v.jobReqId),'Invalid native requisition identity')
 const url=new URL(v.externalUrl)
 check(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash
  &&v.jobPostingId===url.pathname.split('/').at(-1)&&new RegExp('_'+v.jobReqId+'(?:-\\d+)?$').test(row.externalPath),
 'Native canonical posting/requisition identity changed')
 const countries=[v.country,v.jobRequisitionLocation?.country]
 check(countries.every(c=>c?.id===INDIA&&c.descriptor==='India'&&(!c.alpha2Code||c.alpha2Code==='IN')),
  'Native work countries are missing or conflicting')
 const legalEmployer=typeof payload.hiringOrganization?.name==='string'&&payload.hiringOrganization.name.trim()
 const declaration=reviewedWorkdayEmployerDeclaration(v.jobDescription,employerDeclaration)
 check(legalEmployer||declaration,'Native employer or reviewed own employment declaration missing')
 check(typeof v.location==='string'&&v.location.trim()&&typeof v.jobRequisitionLocation.descriptor==='string','Native worksite missing')
 check(v.locationData==null&&v.multiLocation==null,'Unreviewed native multi-location model')
 check(v.additionalLocations==null||Array.isArray(v.additionalLocations)&&v.additionalLocations.every(x=>typeof x==='string'&&x.trim()),
  'Malformed native secondary locations')
 check(extractActiveDescription(v.jobDescription)?.length>=100,'Full active native role criteria missing')
 calendar(v.startDate,now,true);if(v.endDate!=null)calendar(v.endDate,now,false)
 const fields=['id','title','jobReqId','jobPostingId','jobPostingSiteId','externalUrl','jobDescription','location','additionalLocations',
  'jobRequisitionLocation','country','startDate','endDate','canApply','posted','timeType','remoteType']
 return JSON.stringify([fields.map(key=>[key,v[key]??null]),payload.hiringOrganization,declaration])
}
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
 ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
const facets=nodes=>(nodes||[]).map(node=>({...node,values:(node.values||[]).map(value=>value.facetParameter?facets([value])[0]:value)
 .sort((a,b)=>String(a.facetParameter||a.id).localeCompare(String(b.facetParameter||b.id)))}))
 .sort((a,b)=>a.facetParameter.localeCompare(b.facetParameter))
export const currentWorkdayListingSnapshot=payload=>JSON.stringify(canonical({total:payload.total,
 jobPostings:[...payload.jobPostings].sort((a,b)=>a.externalPath.localeCompare(b.externalPath)),facets:facets(payload.facets)}))
