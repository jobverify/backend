const fail=reason=>Object.assign(new Error(`Rave native ${reason}`),{abortRetries:true,partial:true,sourceListingComplete:false,lifecycleCleanupAllowed:false})
const text=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const requireValue=(condition,reason)=>{if(!condition)throw fail(reason)}
const date=value=>typeof value==='string'&&value.trim()&&Number.isFinite(Date.parse(value))?Date.parse(value):null
const identity=(url,id,{api=false,apply=false}={})=>{
 try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&u.origin===(api?'https://api.smartrecruiters.com':'https://jobs.smartrecruiters.com')
  && (api?u.pathname===`/v1/companies/NECSWS/postings/${encodeURIComponent(id)}`:u.pathname.startsWith(`/NECSWS/${id}-`))
  && (apply?[...u.searchParams].every(([k,v])=>k==='oga'&&v==='true')&&!u.searchParams.getAll('oga').slice(1).length:!u.search)}catch{return false}
}
export function raveDetailUrl(posting){
 requireValue(typeof posting?.id==='string'&&/^[\w-]+$/.test(posting.id),'listing identity unavailable')
 const expected=`https://api.smartrecruiters.com/v1/companies/NECSWS/postings/${encodeURIComponent(posting.id)}`
 requireValue(posting.ref==null||posting.ref===expected,'listing detail URL identity changed')
 return expected
}
export function validateRaveNativeDetail(posting,detail){
 requireValue(detail&&detail.id===posting.id&&text(detail.name)===text(posting.name),'detail identity changed')
 requireValue(posting.company?.identifier==='NECSWS'&&detail.company?.identifier==='NECSWS','employer identity changed')
 requireValue(String(posting.location?.country||'').toLowerCase()==='in'&&String(detail.location?.country||'').toLowerCase()==='in','detail country changed')
 requireValue(text(posting.location?.city)===text(detail.location?.city),'detail country/location identity changed')
 requireValue(date(posting.releasedDate)!==null&&date(detail.releasedDate)===date(posting.releasedDate),'detail original date changed')
 requireValue(detail.active!==false&&(!detail.visibility||detail.visibility==='PUBLIC'),'detail active/public identity changed')
 requireValue(identity(detail.postingUrl,posting.id)&&identity(detail.applyUrl,posting.id,{apply:true}),'detail role URL identity changed')
 requireValue((!posting.postingUrl||posting.postingUrl===detail.postingUrl)&&(!posting.applyUrl||posting.applyUrl===detail.applyUrl),'listing/detail role URL identity changed')
 requireValue(new URL(detail.postingUrl).pathname===new URL(detail.applyUrl).pathname,'detail apply URL identity changed')
 return detail
}
export function raveNativeContent(detail,stripTags){
 const sections=detail.jobAd?.sections||{},titles={companyDescription:'Company Description',jobDescription:'Job Description',qualifications:'Qualifications',additionalInformation:'Additional Information'}
 requireValue(typeof sections==='object'&&!Array.isArray(sections)&&Object.keys(sections).every(key=>Object.hasOwn(titles,key)),'unknown native criteria section changed')
 requireValue(Object.values(sections).every(section=>section&&typeof section==='object'&&!Array.isArray(section)&&typeof section.text==='string'),'native criteria section structure changed')
 const source=Object.fromEntries(Object.keys(titles).map(key=>[key,stripTags(sections[key]?.text)||'']))
 const substantive=value=>value.length>=20&&!/^(?:n\/?a|not applicable|enter (?:the )?job description|apply via .{0,100})[.!\s]*$/i.test(value)
 if(!substantive(source.jobDescription)&&!substantive(source.qualifications))throw Object.assign(fail('role criteria unavailable; company boilerplate is not a description'),{code:'RAVE_NATIVE_ROLE_CRITERIA_UNAVAILABLE'})
 return Object.keys(titles).filter(key=>source[key]&&!/^(?:n\/?a|not applicable)[.!\s]*$/i.test(source[key])).map(key=>`${titles[key]}\n${source[key]}`).join('\n\n')
}
export function raveListingPage(payload,{offset,total=null,seen=new Set()}={}){
 requireValue(Array.isArray(payload?.content)&&Number.isSafeInteger(payload.totalFound)&&payload.totalFound>=0&&payload.totalFound<=5000,'pagination total/content unavailable')
 requireValue(total===null||payload.totalFound===total,'pagination total changed')
 requireValue(payload.offset==null||payload.offset===offset,'pagination offset changed')
 requireValue(payload.content.length<=100&&offset+payload.content.length<=payload.totalFound,'pagination row count changed')
 requireValue(payload.content.length>0||offset===payload.totalFound,'pagination ended before reported total')
 for(const row of payload.content){requireValue(typeof row?.id==='string'&&!seen.has(row.id),'pagination repeated or missing role identity');seen.add(row.id)}
 return payload.content
}
export const raveListingSignature=rows=>JSON.stringify(rows.map(row=>({id:row.id,name:row.name,company:row.company?.identifier,country:row.location?.country,city:row.location?.city,visibility:row.visibility,releasedDate:row.releasedDate,ref:row.ref,postingUrl:row.postingUrl,applyUrl:row.applyUrl})).sort((a,b)=>a.id.localeCompare(b.id)))
export const assertRaveClosing=(opening,closing)=>requireValue(raveListingSignature(opening)===raveListingSignature(closing),'closing inventory changed during native detail reads')
export const observeRave=(value,signal)=>new Promise((resolve,reject)=>{
 const abort=()=>reject(signal.reason)
 if(signal.aborted){Promise.resolve(value).catch(()=>{});abort();return}
 signal.addEventListener('abort',abort,{once:true})
 Promise.resolve(value).then(result=>{signal.removeEventListener('abort',abort);signal.aborted?abort():resolve(result)},error=>{signal.removeEventListener('abort',abort);signal.aborted?abort():reject(error)})
})
export async function withRaveDeadline(options,operation){
 const caller=options.signal,timeout=options.collectionTimeoutMs??180000
 caller?.throwIfAborted();requireValue(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=300000,'collection deadline invalid')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Object.assign(fail('collection deadline exceeded'),{failureKind:'network_or_timeout'})),timeout)
 const signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal
 try{return await observeRave(Promise.resolve().then(()=>{signal.throwIfAborted();return operation(signal)}),signal)}finally{clearTimeout(timer);controller.abort()}
}
