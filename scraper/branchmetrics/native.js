import {createHash} from 'node:crypto'
import {hasSourceDescription} from '../../src/utils/jobSourceContent.js'

export const CAREERS_URL='https://www.branch.io/careers/'
export const BOARD_URL='https://ats.rippling.com/branch/jobs'
export const API_URL='https://ats.rippling.com/api/v2/board/branch/jobs?groupJobsByLocation=false&page=0&pageSize=1000'
export const LEGAL_URL='https://legal.branch.io/saas/privacy-policy/'
const CLIENT_PATH='/wp-content/plugins/branch-rippling-careers/assets/js/view.js'
const CLIENT_SHA256='c682b0fc1afc2103d6affbad8014a2afa23f0c6f53f3ba313803e330ab761fce'
export const check=(ok,message)=>{if(!ok){const error=new Error(`Branch Metrics native: ${message}`);error.code='BRANCHMETRICS_NATIVE_CONTRACT';throw error}}
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const text=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const decode=value=>value.replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
 .replace(/&(amp|quot|apos|nbsp|lt|gt);/g,(_,n)=>({amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>'})[n])
const attrs=value=>{
 const result=new Map()
 for(const m of value.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)){
  const key=m[1].toLowerCase();check(!result.has(key),'duplicate HTML attribute');result.set(key,decode(m[2]??m[3]??m[4]??''))
 }
 return result
}
// Raw text and templates cannot contribute employer links, canonical URLs,
// visible content or Next JSON. No script is evaluated.
function document(input,{excludeHidden=false}={}){
 check(typeof input==='string','HTML is not text')
 const tags=/<!--[\s\S]*?(?:-->|$)|<\/?([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
 const raw=new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','noscript','plaintext'])
 const active=[],visible=[],markup=[],payloads=[],scopes=[];let templates=0,cursor=0,tag,hiddenDepth=0
 const voidElements=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
 while((tag=tags.exec(input))){
  if(!templates&&(!excludeHidden||hiddenDepth===0)){visible.push(input.slice(cursor,tag.index));markup.push(input.slice(cursor,tag.index))}cursor=tags.lastIndex
  if(!tag[1])continue
  const name=tag[1].toLowerCase(),closing=tag[0].startsWith('</')
  if(name==='template'){templates=Math.max(0,templates+(closing?-1:1));continue}
  if(closing){
   if(excludeHidden&&!templates){const index=scopes.findLastIndex(s=>s.name===name);if(index>=0)for(const s of scopes.splice(index))hiddenDepth-=Number(s.hidden)}
   if(!templates&&(!excludeHidden||hiddenDepth===0)){active.push(tag[0]);markup.push(tag[0]);visible.push(' ')}continue
  }
  if(raw.has(name)){
   const close=new RegExp(`</${name}\\s*>`,'gi');close.lastIndex=tags.lastIndex
   const end=name==='plaintext'?null:close.exec(input),a=attrs(tag[2])
   if(!templates&&(!excludeHidden||hiddenDepth===0)&&name==='script'){
    active.push({name,attrs:a})
    if(a.get('id')==='__NEXT_DATA__'){
     check(end&&a.get('type')==='application/json'&&!a.has('src'),'active native JSON script malformed')
     payloads.push(JSON.parse(input.slice(tags.lastIndex,end.index)))
    }
   }
   if(!end){cursor=input.length;break}
   tags.lastIndex=close.lastIndex;cursor=tags.lastIndex
  }else if(!templates){
   const attributes=attrs(tag[2])
   if(excludeHidden&&!voidElements.has(name)){
    const style=(attributes.get('style')||'').toLowerCase().replace(/\s+/g,''),hidden=attributes.has('hidden')
     ||attributes.get('aria-hidden')?.trim().toLowerCase()==='true'
     ||/(?:^|;)(?:display:none|visibility:(?:hidden|collapse))(?:!important)?(?:;|$)/.test(style)
    scopes.push({name,hidden});hiddenDepth+=Number(hidden)
   }
   if(!excludeHidden||hiddenDepth===0){active.push({name,attrs:attributes});markup.push(tag[0]);visible.push(' ')}
  }
 }
 if(!templates&&(!excludeHidden||hiddenDepth===0)){visible.push(input.slice(cursor));markup.push(input.slice(cursor))}
 return{active,payloads,markup:markup.join(''),visible:text(decode(visible.join(' ')))}
}
const canon=value=>JSON.stringify(value,(_k,v)=>plain(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
export const sameNative=(a,b)=>canon(a)===canon(b)
const rejectError=value=>{
 check(plain(value),'native upstream invalid shape')
 for(const key of ['error','Error','errors','Errors','message','Message','exception','Exception','errorMessage','ErrorMessage']){
  if(value[key]!=null)check(value[key]===''||value[key]===false||(Array.isArray(value[key])&&value[key].length===0),'native upstream error')
 }
 for(const key of ['success','Success'])if(value[key]!=null)check(value[key]===true,'native upstream failure')
 for(const key of ['isError','IsError'])if(value[key]!=null)check(value[key]===false,'native upstream failure')
 for(const key of ['statusCode','StatusCode','code','Code'])if(value[key]!=null)check(value[key]===200,'native upstream status failure')
 for(const key of ['status','Status'])if(value[key]!=null)check([200,'success','ok'].includes(value[key]),'native upstream status failure')
}
const publication=value=>{
 for(const key of ['closed','isClosed','archived','isArchived','deleted','isDeleted','unlistedFromSearch'])if(Object.hasOwn(value,key))check(value[key]===false,'native vacancy is closed or unavailable')
 for(const key of ['published','isPublished','active','isActive','isPublic','visible'])if(Object.hasOwn(value,key))check(value[key]===true,'native vacancy is not explicitly public/active')
}
export function parseCorporate(html){
 const elements=document(html).active.filter(v=>typeof v!=='string')
 const endpoints=elements.filter(e=>e.attrs.has('data-endpoint'))
 check(endpoints.length===1&&endpoints[0].attrs.get('data-endpoint')===API_URL
  &&endpoints[0].attrs.get('class')?.split(/\s+/).includes('branch-rippling-careers'),'current exact corporate advertised API missing')
 const scripts=elements.filter(e=>e.name==='script'&&e.attrs.has('src')).map(e=>e.attrs.get('src')).filter(value=>{
  try{const u=new URL(value);return u.origin==='https://www.branch.io'&&u.pathname===CLIENT_PATH&&!u.hash&&!u.username&&!u.password&&[...u.searchParams.keys()].every(k=>k==='ver')}catch{return false}
 })
 check(scripts.length===1,'current active corporate Rippling client missing')
 return{endpoint:API_URL,clientUrl:scripts[0]}
}
export function validateClient(body){check(typeof body==='string'&&createHash('sha256').update(body).digest('hex')===CLIENT_SHA256,'current public client changed; binding renewal/review required')}
export function validateLegal(html){check(/Branch Metrics,? Inc\./.test(document(html).visible)&&/linking and analytics platform/.test(document(html).visible),'current Branch Metrics legal employer missing')}
function boardIdentity(board){
 rejectError(board)
 check(board.boardType==='RIPPLING'&&board.slug==='branch'&&board.companyName==='Branch Metrics, Inc.'
  &&board.boardURL===BOARD_URL&&board.isTest===false&&board.groupJobsByLocation===false,'native board company, test state or tenant mismatch')
}
function payload(html,route,id){
 const doc=document(html);check(doc.payloads.length===1,'one active native Next JSON required')
 const data=doc.payloads[0],props=data?.props?.pageProps,api=props?.apiData
 for(const value of [data,data?.props,props,api])rejectError(value)
 check(data.page===route&&data.isFallback===false&&data.locale==='en-US'&&plain(data.query)
  &&data.query.jobBoardSlug==='branch'&&Object.keys(data.query).every(k=>['jobBoardSlug',...(id?['jobId']:[])].includes(k))
  &&(!id||data.query.jobId===id),'native route, locale, filter or ID mismatch')
 boardIdentity(api.jobBoard)
 return{api,props,doc}
}
export function parseListing(value,page,pageSize=1000){
 rejectError(value)
 check(Number.isInteger(page)&&page>=0&&Array.isArray(value.items)&&Number.isSafeInteger(value.totalItems)&&value.totalItems>=0
  &&value.page===page&&value.pageSize===pageSize&&value.totalPages===Math.ceil(value.totalItems/pageSize)
  &&page<=value.totalPages&&value.items.length===(page<value.totalPages?Math.min(pageSize,value.totalItems-page*pageSize):0),'native page, totals or record count inconsistent')
 return{rows:value.items,page,totalItems:value.totalItems,totalPages:value.totalPages,pageSize}
}
export function parseBoard(html){
 const {props}=payload(html,'/[jobBoardSlug]/jobs')
 check(props.apiData.jobBoardSlug==='branch'&&Array.isArray(props.dehydratedState?.queries),'native board data missing')
 const queries=props.dehydratedState.queries.filter(q=>Array.isArray(q.queryKey)&&q.queryKey[2]==='job-posts')
 check(queries.length===1,'one unfiltered public jobs query required')
 const q=queries[0],filters=q.queryKey[4]
 check(sameNative(q.queryKey.slice(0,4),['board','branch','job-posts',false])&&q.queryKey.length===5
  &&sameNative(filters,{searchQuery:'',departments:[],workplaceType:null,country:'',state:'',city:'',page:0,pageSize:20})
  &&q.state?.status==='success'&&q.state.error===null,'native board query is filtered or unsuccessful')
 return parseListing(q.state.data,0,20)
}
const names=new Intl.DisplayNames(['en'],{type:'region'}),countries=new Map()
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=names.of(code);if(name!==code&&!['ZZ','EU','UN','XA','XB','QO'].includes(code))countries.set(code,name)}
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const foreignMarker=new RegExp(`(?:^|[^\\p{L}])(?:${[...countries].filter(([code])=>code!=='IN').map(([_code,name])=>escapeRegex(name)).join('|')})(?:$|[^\\p{L}])`,'iu')
function location(row){
 check(plain(row)&&typeof row.countryCode==='string'&&countries.has(row.countryCode)&&typeof row.country==='string'
  &&row.country===countries.get(row.countryCode)&&text(row.name),'unknown, malformed or conflicting native country')
 for(const key of ['name','country','countryCode','city','state','stateCode','workplaceType'])check(row[key]==null||typeof row[key]==='string','malformed native location field')
 const label=text(row.name),suffix=label.replace(/^Remote\s*\(/i,'').replace(/\)$/,'').split(',').at(-1).trim()
 const countryHint=[...countries].find(([_code,name])=>name.toLowerCase()===suffix.toLowerCase())?.[0]
 check(!countryHint||countryHint===row.countryCode,'native location label contradicts country')
 if(/^Remote\s*\(/i.test(label)&&/^[A-Z]{2}$/.test(suffix)&&countries.has(suffix))check(suffix===row.countryCode,'remote native country contradicts label')
 if(text(row.city))check(label.toLowerCase().includes(text(row.city).toLowerCase()),'native city contradicts location label')
 if(row.countryCode==='IN')check(/(?:^|[, (])India\)?$/i.test(label)&&!foreignMarker.test(label),'India country needs explicit matching native label without foreign country conflict')
 return row
}
export function mergeListings(rows){
 check(Array.isArray(rows),'native rows missing')
 const grouped=new Map(),seenLocations=new Set()
 for(const row of rows){
  rejectError(row);publication(row)
  check(typeof row.id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(row.id)&&text(row.name)
   &&typeof row.name==='string'&&row.url===`${BOARD_URL}/${row.id}`&&row.language==='en-US'
   &&plain(row.department)&&text(row.department.name)&&Array.isArray(row.locations)&&row.locations.length>0,'native listing identity malformed')
  const {locations,...identity}=row,prior=grouped.get(row.id)
  if(prior)check(sameNative(prior.identity,identity),'same native ID has conflicting fields')
  const target=prior||{identity,...row,locations:[],jobId:row.id,sourceUrl:row.url,title:text(row.name)}
  for(const place of locations){location(place);const key=row.id+'\0'+canon(place);check(!seenLocations.has(key),'duplicate native job/location record');seenLocations.add(key);target.locations.push(place)}
  grouped.set(row.id,target)
 }
 return[...grouped.values()]
}
function publishedDate(value,now){
 check(typeof value==='string','native created date missing')
 const m=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/)
 check(m&&new Date(Date.UTC(+m[1],+m[2]-1,+m[3])).toISOString().slice(0,10)===value.slice(0,10)
  &&+m[4]<24&&+m[5]<60&&+m[6]<60&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=+new Date(now),'invalid or future native created date')
 return value
}
function nativeLocationMatches(label,place){
 if(label===place.name)return true
 // The same current native office uses British Columbia on listings and BC on
 // details. Expand only the supplied state's exact comma-delimited component;
 // the city, country, remote wrapper and every other component stay identical.
 if(!text(place.state)||!text(place.stateCode))return false
 const expand=value=>value.split(',').map(part=>part.trim()===place.stateCode?place.state:part.trim()).join(', ')
 return expand(label)===expand(place.name)
}
export function parseDetail(html,listing,{now=new Date()}={}){
 const {api,doc}=payload(html,'/[jobBoardSlug]/jobs/[jobId]',listing.jobId),job=api.jobPost
 rejectError(job);publication(job);boardIdentity(job.board)
 const heading=doc.markup.match(/<h([12])\b[^>]*>([\s\S]*?)<\/h\1>/i)
 check(heading&&document(heading[2]).visible===listing.title,'rendered native title differs from listing')
 const canonical=doc.active.filter(e=>typeof e!=='string'&&e.name==='link'&&e.attrs.get('rel')==='canonical')
 check(canonical.length===1&&canonical[0].attrs.get('href')===listing.sourceUrl,'native role canonical mismatch')
 check(job.uuid===listing.jobId&&text(job.name)===listing.title&&job.url===listing.sourceUrl&&job.companyName==='Branch Metrics, Inc.'
  &&job.unlistedFromSearch===false&&plain(job.activeJobApplication)&&Array.isArray(job.activeJobApplication.basicQuestions)
  &&job.activeJobApplication.basicQuestions.length>0&&(job.jsonLd==null),'native role identity, publication or apply state mismatch')
 check(Array.isArray(job.workLocations)&&job.workLocations.every(v=>typeof v==='string'&&text(v))
  &&new Set(job.workLocations).size===job.workLocations.length
  &&job.workLocations.length===listing.locations.length
  &&job.workLocations.every(label=>listing.locations.filter(place=>nativeLocationMatches(label,place)).length===1)
  &&listing.locations.every(place=>job.workLocations.filter(label=>nativeLocationMatches(label,place)).length===1)
  &&sameNative(api.workLocations,job.workLocations),'all native role locations must match listing')
 check(plain(job.department)&&text(job.department.name)&&job.department.base_department===listing.department.name
  &&sameNative(api.department,job.department),'native role department mismatch')
 const postingDate=publishedDate(job.createdOn,now)
 check(plain(job.description)&&typeof job.description.company==='string'&&typeof job.description.role==='string','native full description type changed')
 const healthy=hasSourceDescription({sourceDescription:document(job.description.role,{excludeHidden:true}).visible})
 const description=healthy?job.description.company+'\n'+job.description.role:''
 const applyButtons=doc.active.filter(e=>typeof e!=='string'&&e.name==='button'&&e.attrs.get('data-testid')==='Apply now')
 check(applyButtons.length>0&&applyButtons.every(e=>e.attrs.get('data-disabled')==='false'&&!e.attrs.has('disabled')),'current public apply action missing')
 return{postingDate,closingDate:null,sourceNativeCreatedOn:job.createdOn,sourceNativeWorkLocations:job.workLocations,department:job.department.name,
  employmentType:job.employmentType?.id??null,sourceUrl:job.url,applyUrl:job.url,link:job.url,
  jobDescription:description,sourceDescription:description,sourceDetailComplete:healthy,
  ...(healthy?{}:{sourceDetailFailureKind:'missing-content'})}
}
