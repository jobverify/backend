import { document, decode, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { requireNative, plainNativeHTML } from '../../scraper-support/shared/nativeJobPosting.js'
export const SOURCE='fluor', COMPANY='Fluor', ORIGIN='https://careers.fluor.com'
export const CORPORATE='https://www.fluor.com/careers/professional', BOARD=ORIGIN+'/careers'
export const searchURL=start=>ORIGIN+'/api/apply/v2/jobs?domain=fluor.com&start='+start+'&num=10&query=&location='
export const detailURL=id=>ORIGIN+'/api/pcsx/position_details?position_id='+id+'&domain=fluor.com&hl=en'
const ensure=(v,m)=>requireNative(v,'Fluor: '+m)
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)
const text=v=>typeof v==='string'&&v.trim().length>0
const key=v=>norm(v).toLowerCase()
function noError(p){
 ensure(object(p),'Native model unavailable')
 for(const k of ['error','Error'])if(p[k]!=null){const e=p[k];ensure(e===''||object(e)&&Object.keys(e).every(k=>['message','body'].includes(k))&&Object.values(e).every(v=>v===''),'Native error response')}
 for(const k of ['success','Success'])if(p[k]!=null)ensure(p[k]===true,'Native failure response')
 for(const k of ['errors','Errors','exception','errorMessage'])if(p[k]!=null)ensure(p[k]===''||Array.isArray(p[k])&&!p[k].length,'Native error field')
 if(p.metadata!=null)ensure(object(p.metadata)&&(!Object.hasOwn(p.metadata,'isFallback')||p.metadata.isFallback===false),'Native fallback response')
}
const stable=r=>({id:r.id,name:r.name,locations:r.locations,ats_job_id:r.ats_job_id,display_job_id:r.display_job_id,canonicalPositionUrl:r.canonicalPositionUrl,t_create:r.t_create,t_update:r.t_update,isPrivate:r.isPrivate,type:r.type})
function listingIdentity(r){
 ensure(object(r)&&Number.isSafeInteger(r.id)&&r.id>0&&text(r.name),'Native role identity/title unavailable')
 ensure(text(r.ats_job_id)&&text(r.display_job_id)&&r.isPrivate===false&&r.type==='ATS','Native public role/requisition unavailable')
 ensure(Array.isArray(r.locations)&&r.locations.length>0&&r.locations.length<=32&&r.locations.every(text),'Native locations unavailable')
 ensure(r.canonicalPositionUrl===ORIGIN+'/careers/job/'+r.id,'Native public role URL mismatch')
}
function model(raw){
 const p=JSON.parse(raw);noError(p)
 ensure(p.domain==='fluor.com'&&p.isUserAuthenticated===false&&!p.user,'Native anonymous tenant mismatch')
 ensure(object(p.query)&&Object.keys(p.query).length>0&&Object.values(p.query).every(v=>v===''||Array.isArray(v)&&!v.length),'Native global listing unexpectedly filtered')
 ensure(Number.isSafeInteger(p.count)&&p.count>=0&&p.count<=1000&&Array.isArray(p.positions),'Native global count unavailable')
 return p
}
export function createSourceConfig({now=()=>new Date().toISOString()}={}){
 const current=Date.parse(now());ensure(Number.isFinite(current),'Invalid collection clock')
 let boardModel
 return {source:SOURCE,companyName:COMPANY,boardURL:searchURL(0),
  expectedContentType:url=>new URL(url).pathname.startsWith('/api/')?'application/json':'text/html',
  sameReadIdentity:(from,to)=>from===to,
  validateURL(value){
   if(value===CORPORATE||value===BOARD)return
   const u=new URL(value);ensure(u.origin===ORIGIN&&!u.username&&!u.password&&!u.hash,'Unqualified public endpoint')
   if(u.pathname==='/api/apply/v2/jobs'){
    const start=u.searchParams.get('start');ensure(/^(?:0|[1-9]\d*)$/.test(start||'')&&Number(start)<=1000&&Number(start)%10===0&&value===searchURL(Number(start)),'Unqualified global listing query')
   }else{const id=u.searchParams.get('position_id');ensure(/^[1-9]\d{5,15}$/.test(id||'')&&value===detailURL(id),'Unqualified role detail query')}
  },
  handoffs:[
   {url:CORPORATE,verify(html){ensure(document(html).nodes(n=>n.tag==='a'&&n.attrs.href===BOARD).length>0,'Current corporate-to-native board link missing')}},
   {url:BOARD,verify(html){
    // This hidden code element is an advertised literal JSON model, never executable JS.
    const matches=[...html.matchAll(/<code\b[^>]*id=["']smartApplyData["'][^>]*>([\s\S]*?)<\/code>/gi)]
    ensure(matches.length===1,'Native board model missing or ambiguous');boardModel=model(decode(matches[0][1]))
    ensure(boardModel.isPcsEnabled===true,'Native public careers board unavailable')
   }},
  ],
  parseListing(raw,url){
   const p=model(raw),start=Number(new URL(url).searchParams.get('start'))
   ensure(p.positions.length===Math.min(10,Math.max(0,p.count-start)),'Truncated native global page')
   const pageNumber=start/10+1,lastPage=Math.max(1,Math.ceil(p.count/10));ensure(pageNumber<=lastPage,'Page beyond native inventory')
   if(start===0){ensure(boardModel&&p.count===boardModel.count&&JSON.stringify(p.positions.map(stable))===JSON.stringify(boardModel.positions.map(stable)),'Native board/API inventory mismatch')}
   const ids=new Set(),records=p.positions.map(r=>{listingIdentity(r);ensure(!ids.has(r.id),'Duplicate native listing identity');ids.add(r.id);return{id:String(r.id),title:r.name,url:detailURL(r.id),locations:r.locations,rawNative:r}})
   return{pageNumber,lastPage,reportedTotal:p.count,observedRows:records.length,records,terminationKnown:pageNumber===lastPage,nextURL:pageNumber<lastPage?searchURL(start+10):null}
  },
  pageFingerprint:p=>JSON.stringify({total:p.reportedTotal,lastPage:p.lastPage,rows:p.records.map(r=>stable(r.rawNative))}),
  candidateForIndia:r=>r.locations.some(l=>/(?:^|,)\s*India\s*$/i.test(l)),
  parseDetail(raw,row){
   const payload=JSON.parse(raw);noError(payload);ensure(payload.status===200&&object(payload.data),'Native detail envelope unavailable')
   const d=payload.data,r=row.rawNative
   ensure(d.id===r.id&&d.name===r.name&&d.atsJobId===r.ats_job_id&&d.displayJobId===r.display_job_id,'Native detail/listing identity mismatch')
   ensure(JSON.stringify(d.locations)===JSON.stringify(r.locations),'Native detail/listing location mismatch')
   ensure(d.positionUrl==='/careers/job/'+r.id&&d.publicUrl===r.canonicalPositionUrl,'Native detail public URL mismatch')
   ensure(Number.isSafeInteger(d.postedTs)&&d.postedTs>0&&d.postedTs*1000<=current,'Invalid/future native posted timestamp')
   ensure(d.creationTs==null||Number.isSafeInteger(d.creationTs)&&d.creationTs>0&&d.creationTs*1000<=current,'Invalid native creation timestamp')
   ensure(text(d.jobDescription)&&plainNativeHTML(d.jobDescription).length>=100,'Missing full native description')
   ensure(Array.isArray(d.standardizedLocations)&&d.standardizedLocations.length===d.locations.length&&d.standardizedLocations.every(text),'Native standardized locations unavailable')
   const india=[]
   for(let i=0;i<d.locations.length;i++){
    const label=d.locations[i],parts=d.standardizedLocations[i].split(',').map(v=>v.trim()),written=/(?:^|,)\s*India\s*$/i.test(label),iso=parts.at(-1)==='IN'
    if(!written&&!iso)continue
    ensure(written&&iso&&parts.length>=2&&text(parts[0]),'Native country evidence conflicts')
    const visibleCity=label.split(',').slice(0,-1).some(v=>key(v)===key(parts[0]))
    india.push({location:label,nativeStandardizedLocation:d.standardizedLocations[i],country:'India',nativeCountryCode:'IN',city:visibleCity?parts[0]:null,nativeStandardizedCity:parts[0]})
   }
   ensure(india.length>0,'Native detail has no corroborated India location')
   const action=d.positionUserActions?.applyAction
   ensure(object(action)&&action.status==='allowed'&&!action.applyUrl,'Native inline application availability changed')
   // The native canonical role is the enabled inline entry. No form/submit URL is invented or fetched.
   return{id:row.id,title:row.title,sourceURL:d.publicUrl,nativeApplicationURL:d.publicUrl,nativeApplicationMode:'native-enabled-inline-role-entry',nativeListingRecord:row,nativeDetail:d,nativeEnvelope:payload,indiaLocations:india,applicationsVisited:false,sourceScopeComplete:false,originalFirstPublication:null}
  },
 }
}
