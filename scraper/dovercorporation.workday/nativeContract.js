import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

export const BOARD='https://dover.wd103.myworkdayjobs.com/Dover'
export const API='https://dover.wd103.myworkdayjobs.com/wday/cxs/dover/Dover'
export const CLIENT='https://prod-wd103.myworkdaycdn.com/wday/asset/candidate-experience-jobs/cx-jobs.min.js'
export const CAREERS='https://careers.dovercorporation.com/'
export function verifyCorporate(html){
 const document=readNativeDocument(html)
 check(document.nodes(n=>n.tag==='base').length===0,'Unreviewed corporate document base')
 check(document.nodes(n=>n.tag==='title'&&/Dover/i.test(n.raw??'')).length===1,'Current corporate identity missing')
 check(document.nodes(n=>n.tag==='a'&&n.attrs.href===BOARD).length>0,'Current corporate native-board handoff missing')
}
export const check=(ok,message)=>{if(!ok)throw Error('Dover native: '+message)}
export function verifyShell(html){
 const document=readNativeDocument(html),root=document.nodes(n=>n.tag==='root')[0]
 const mark=(node,inherited=false)=>{if(typeof node==='string')return;node.inert=Boolean(node.inert||inherited||Object.hasOwn(node.attrs,'inert')||Object.hasOwn(node.attrs,'disabled')||node.attrs['aria-disabled']==='true');node.children.forEach(child=>mark(child,node.inert))};mark(root)
 const canonicals=document.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 check(canonicals.length===1&&canonicals[0].attrs.href===BOARD,'Native board canonical identity changed')
 const scripts=document.nodes(n=>n.tag==='script'&&!n.attrs.src).map(n=>n.raw??'').filter(s=>s.includes('window.workday'))
 check(scripts.length===1,'Native board active identity advertisement missing')
 const script=scripts[0]
 for(const [key,value]of [['tenant','dover'],['siteId','Dover'],['clientOrigin','https://wd103.myworkday.com'],['cdnEndpoint','prod-wd103.myworkdaycdn.com']]){
  const matches=[...script.matchAll(new RegExp('\\b'+key+':\\s*"([^"\\n]*)"','g'))]
  check(matches.length===1&&matches[0][1]===value,'Native board/client identity advertisement changed')
 }
 check(script.includes("'/wday/asset/candidate-experience-jobs/'")&&script.includes("'cx-jobs.min.js'"),'Native client advertisement missing')
}
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)
export function noFailure(v){
 check(object(v),'Malformed native envelope')
 for(const [k,value]of Object.entries(v)){
  const key=k.toLowerCase().replace(/[_\s-]/g,'')
  check(!['error','errors','errorcode','errormessage','exception','fault'].includes(key),'Native error envelope')
  if(['ok','success'].includes(key))check(value===true,'Failed native envelope')
  if(['status','statuscode','httpstatus','httpstatuscode'].includes(key))check(value===200,'Failed HTTP envelope')
  if(['meta','metadata','result','response'].includes(key)&&value!=null)noFailure(value)
 }
}
const text=v=>{check(typeof v==='string'&&v.trim()&&!/[\u0000-\u001f]/.test(v),'Native identity text missing');return v}
const keys=(v,allowed)=>{check(object(v)&&Object.keys(v).every(k=>allowed.includes(k)),'Unexpected native schema');return v}
const sorted=a=>a.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'))
export function canonicalFacets(nodes){
 check(Array.isArray(nodes),'Native facets missing');const names=new Set()
 return sorted(nodes.map(n=>{
  keys(n,['facetParameter','descriptor','values']);const name=text(n.facetParameter)
  check(!names.has(name),'Duplicate native facet group');names.add(name)
  check(Array.isArray(n.values),'Native facet values missing');const ids=new Set(),groups=new Set()
  const values=n.values.map(v=>{
   if(Object.hasOwn(v,'facetParameter')){check(!groups.has(v.facetParameter),'Duplicate nested native facet');groups.add(v.facetParameter);return{kind:'group',value:canonicalFacets([v])[0]}}
   keys(v,['id','descriptor','count']);text(v.id);text(v.descriptor)
   check(/^[a-f0-9]{32}$/.test(v.id)&&!ids.has(v.id),'Duplicate or invalid native facet ID');ids.add(v.id)
   check(Number.isSafeInteger(v.count)&&v.count>=0,'Invalid native facet count')
   return{kind:'value',id:v.id,descriptor:v.descriptor,count:v.count}
  })
  if(Object.hasOwn(n,'descriptor'))text(n.descriptor)
  return{facetParameter:name,descriptor:Object.hasOwn(n,'descriptor')?n.descriptor:null,values:sorted(values)}
 }))
}
export function discoverOffices(payload){
 noFailure(payload);canonicalFacets(payload.facets)
 check(payload.userAuthenticated===false&&Number.isSafeInteger(payload.total)&&payload.total>=0&&Array.isArray(payload.jobPostings),'Native global facet envelope malformed')
 const groups=payload.facets.filter(n=>n.facetParameter==='locationMainGroup')
 check(groups.length===1,'Native location facet nesting changed')
 const locations=groups[0].values.filter(n=>n.facetParameter==='locations')
 check(locations.length===1,'Native location facet nesting changed')
 const offices=locations[0].values.filter(v=>/, India$/.test(v.descriptor)).sort((a,b)=>a.id.localeCompare(b.id))
 check(offices.length<=50,'Native India office inventory bound exceeded')
 check(offices.reduce((sum,v)=>sum+v.count,0)<=2000,'Native selected office inventory bound exceeded')
 return offices
}
export function listing(payload,office,offset){
 noFailure(payload);keys(payload,['total','jobPostings','facets','userAuthenticated'])
 check(payload.userAuthenticated===false&&payload.total===office.count&&Array.isArray(payload.jobPostings),'Native selected listing count/schema changed')
 check(payload.jobPostings.length===Math.min(20,Math.max(0,office.count-offset)),'Native listing truncated or overfull')
 const facets=canonicalFacets(payload.facets)
 const parents=payload.facets.filter(v=>v.facetParameter==='locationMainGroup'),locations=parents.length===1?parents[0].values.filter(v=>v.facetParameter==='locations'):[]
 const selected=locations.length===1?locations[0].values.filter(v=>v.id===office.id):[]
 check(selected.length===1&&selected[0].descriptor===office.descriptor&&selected[0].count===office.count,'Selected native office facet count/identity changed')
 const rows=payload.jobPostings.map(r=>{
  keys(r,['title','externalPath','locationsText','postedOn','bulletFields']);text(r.title);text(r.postedOn)
  check(!/[<>]/.test(r.title)&&typeof r.externalPath==='string'&&/^\/job\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(r.externalPath),'Native row identity malformed')
  check(Array.isArray(r.bulletFields)&&r.bulletFields.length===2&&/^JR\d+$/.test(r.bulletFields[1]),'Native requisition malformed')
  const [employer,req]=r.bulletFields
  check(['Dover India Pvt.,Ltd.','Markem-Imaje India Private LTD','Tokheim India Private Ltd'].includes(employer),'Native legal employer changed')
  check(r.externalPath.endsWith('_'+req)||new RegExp('_'+req+'-\\d+$').test(r.externalPath),'Native requisition/path identity mismatch')
  check(r.locationsText===office.descriptor,'Native office country/location mismatch')
  return {...r,req,employer,officeId:office.id}
 })
 return{total:payload.total,rows:sorted(rows),facets}
}
export function nativeDate(value,now,publication=false){
 check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value),'Native date missing')
 const date=new Date(value+'T00:00:00.000Z')
 check(Number.isFinite(+date)&&date.toISOString().slice(0,10)===value,'Invalid native calendar date')
 check(!publication||+date<=Date.parse(now),'Future native publication date')
 return value
}
export function detail(payload,row,now){
 noFailure(payload);const v=payload.jobPostingInfo;noFailure(v)
 check(typeof v.id==='string'&&/^[a-f0-9]{32}$/.test(v.id),'Native posting UID malformed')
 check(v.title===row.title&&v.jobReqId===row.req&&v.jobPostingSiteId==='Dover'&&v.jobPostingId===row.externalPath.split('/').at(-1),'Native detail identity mismatch')
 check(v.externalUrl===BOARD+row.externalPath,'Native role URL identity mismatch')
 check(payload.hiringOrganization?.name===row.employer,'Native legal employer mismatch')
 check(v.posted===true&&v.canApply===true,'Native role closed or unavailable')
 const india=c=>c?.descriptor==='India'&&c.id==='c4f78be1a8f14da0ab49ce1162348a5e'
 check(india(v.country)&&india(v.jobRequisitionLocation?.country)&&v.jobRequisitionLocation.country.alpha2Code==='IN','Native country mismatch')
 check(v.location===row.locationsText&&typeof v.jobRequisitionLocation.descriptor==='string'&&v.jobRequisitionLocation.descriptor.startsWith('IND - '),'Native office location mismatch')
 if(v.jobRequisitionLocation.id!=null)check(v.jobRequisitionLocation.id===row.officeId,'Native primary office ID mismatch')
 if(v.additionalLocations!=null){check(Array.isArray(v.additionalLocations),'Native secondary locations malformed');for(const location of v.additionalLocations)check(location===row.locationsText,'Native secondary country/location mismatch')}
 check(v.locationData==null&&v.multiLocation==null,'Unexpected native multi-location representation')
 nativeDate(v.startDate,now,true)
 if(v.endDate!=null){const end=nativeDate(v.endDate,now);check(end.slice(0,10)>=now.slice(0,10),'Native role closing date expired')}
 return v
}
export function detailSnapshot(payload){
 const fields=['id','title','jobDescription','location','additionalLocations','locationData','multiLocation','jobReqId','jobPostingId','jobPostingSiteId','country','startDate','endDate','canApply','posted','externalUrl','jobRequisitionLocation','remoteType','timeType']
 return JSON.stringify([fields.map(k=>[k,payload.jobPostingInfo[k]??null]),payload.hiringOrganization])
}
export function description(html){
 if(typeof html!=='string'||!html.trim())return null
 const document=readNativeDocument(html),root=document.nodes(n=>n.tag==='root')[0]
 const mark=(node,inherited=false)=>{if(typeof node==='string')return;node.inert=Boolean(node.inert||inherited||Object.hasOwn(node.attrs,'inert')||Object.hasOwn(node.attrs,'disabled')||node.attrs['aria-disabled']==='true');node.children.forEach(child=>mark(child,node.inert))};mark(root)
 const full=document.text(root)
 check(!/\b(?:(?:this|the)\s+(?:job|position|vacancy|role)\s+(?:is\s+(?:no longer available|closed|not available)|has\s+(?:been\s+(?:closed|filled)|expired))|(?:we are\s+)?no longer accepting applications)\b/i.test(full),'Native description says role closed or unavailable')
 // Evaluate role content independently of the long employer intro/EEO/fraud footer.
 const nonRole=/^(?:Dover is a diversified global manufacturer\b|Dover Imaging & Identification \(DII\) is a segment\b|With more than 40 offices\b|All qualified applicants will receive consideration\b|Fraudulent Recruiting Disclaimer\b)/i
 for(const node of document.nodes(n=>['p','li','div','section','h1','h2','h3','h4'].includes(n.tag)))if(nonRole.test(document.text(node))&&node.children.every(child=>typeof child==='string'||!['p','div','section'].includes(child.tag)))node.inert=true
 const role=document.text(root).split(/(?<=[.!?])\s+/).filter(s=>!/^(?:please\s+)?(?:(?:click|select|press|tap)\s+(?:the\s+)?)?apply(?:\s+now)?(?:\s+button)?\b.*\b(?:view|learn|description|application|access|details|requirements|instructions|recruitment|qualifications|responsibilities)\b/i.test(s)&&!/^(?:please\s+)?(?:submit|complete|start|send)\s+(?:(?:your|an?|the)\s+)?application\b.*\b(?:view|access|learn|information|details|responsibilities|qualifications)\b/i.test(s)&&!/^(?:the\s+)?(?:full\s+|detailed\s+)?job description\b.*\b(?:unavailable|not available|available soon|coming soon|available\s+(?:after|once))\b/i.test(s)&&!/^please\s+check back\b/i.test(s)).join(' ').replace(/\b(?:job description|apply now|sample|placeholder|read more|coming soon)\b/gi,'').replace(/[^\p{L}\p{N}]/gu,'')
 return role.length>=100?full:null
}
