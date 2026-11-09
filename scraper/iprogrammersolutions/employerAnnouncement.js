import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
export const PROFILE_URL='https://in.linkedin.com/company/iprogrammer-solutions'
export const POST_URL='https://www.linkedin.com/posts/iprogrammer-solutions_hiring-hiringsales-businessdevelopment-activity-7512006475670597632-4SHX'
const HOME_URL='https://iprogrammer.com/', SHORT_URL='https://lnkd.in/djUmmYjJ'
const VIEWER_URL='https://drive.google.com/file/d/1anyX0AFPOePUuuVGh5wL2GAPaY1crle6/view?usp=sharing'
const PDF_URL='https://drive.usercontent.google.com/uc?id=1anyX0AFPOePUuuVGh5wL2GAPaY1crle6&export=download'
const PDF_FINAL_URL='https://drive.usercontent.google.com/download?id=1anyX0AFPOePUuuVGh5wL2GAPaY1crle6&export=download'
const MAX_BYTES=2*1024*1024, REQ='iPro/HRD-TA/JD/2026/SDR/00', EMAIL='darshanas@iprogrammer.co'
const fail=message=>Object.assign(new Error('iProgrammer current employer announcement: '+message),{abortRetries:true,failureKind:'unverified_inventory'})
const clean=value=>String(value??'').replace(/&amp;/gi,'&').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
const uncomment=html=>String(html??'').replace(/<!--[\s\S]*?-->/g,'')
export const fetchAnnouncementPage=async(url,{signal}={})=>{
 signal?.throwIfAborted();const response=await fetch(url,{signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(15000)]),headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',Accept:'text/html,application/pdf;q=0.9,*/*;q=0.8'}})
 const reader=response.body.getReader(),parts=[];let size=0
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES)throw fail('native response exceeds size bound');parts.push(value)}}finally{await reader.cancel()}
 const bytes=Buffer.concat(parts);signal?.throwIfAborted();return {status:response.status,url:response.url,html:url===PDF_URL?null:bytes.toString('utf8'),bytes:url===PDF_URL?bytes:undefined}
}
// Existing installed pdfjs-dist, fresh in-memory bytes only. No OCR or remote font resources.
export const parseNativeAnnouncementPdf=async(bytes,{signal}={})=>{
 signal?.throwIfAborted();if(!bytes||bytes.length>MAX_BYTES||Buffer.from(bytes).subarray(0,5).toString()!=='%PDF-')throw fail('native download is not a bounded PDF')
 const {getDocument,VerbosityLevel}=await import('pdfjs-dist/legacy/build/pdf.mjs')
 signal?.throwIfAborted();const deadline=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(15000)])
 const loading=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useWorkerFetch:false,disableFontFace:true,useSystemFonts:false,verbosity:VerbosityLevel.ERRORS})
 let onAbort
 const pending=(async()=>{const pdf=await loading.promise;if(!pdf.numPages||pdf.numPages>10)throw fail('published PDF page count is outside the verified bound');const texts=[];for(let n=1;n<=pdf.numPages;n++){deadline.throwIfAborted();const page=await pdf.getPage(n),content=await page.getTextContent();texts.push(content.items.filter(i=>typeof i.str==='string').map(i=>i.str+(i.hasEOL?'\n':' ')).join(''))}return texts.join('\n').replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').trim()})()
 try{return await Promise.race([pending,new Promise((_,reject)=>{onAbort=()=>reject(deadline.reason);deadline.addEventListener('abort',onAbort,{once:true});if(deadline.aborted)onAbort()})])}finally{if(onAbort)deadline.removeEventListener('abort',onAbort);pending.catch(()=>{});await loading.destroy()}
}
const currentAnnouncement=(html,checkedAt)=>{
 const page=uncomment(html)
 const canonical=page.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
 if(!/<title>\s*iProgrammer Solutions\s*\|\s*LinkedIn\s*<\/title>/i.test(page)||![PROFILE_URL,'https://www.linkedin.com/company/iprogrammer-solutions'].includes(canonical))throw fail('native employer profile identity changed')
 const visible=page.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,'')
 const websites=[...visible.matchAll(/<a\b[^>]*data-tracking-control-name=["']about_website["'][^>]*>[\s\S]*?<\/a>/gi)]
 try{
  if(websites.length!==1)throw fail('native employer website binding changed')
  const anchor=websites[0][0],href=anchor.match(/href=["']([^"']+)["']/i)?.[1],wrapper=new URL(href.replaceAll('&amp;','&'))
  if(wrapper.protocol!=='https:'||wrapper.hostname!=='www.linkedin.com'||wrapper.pathname!=='/redir/redirect'||wrapper.username||wrapper.password||wrapper.port||wrapper.hash
   ||wrapper.searchParams.getAll('url').length!==1||wrapper.searchParams.get('url')!=='http://www.iprogrammer.com'||![...wrapper.searchParams.keys()].every(key=>['url','urlhash','trk'].includes(key))
   ||clean(anchor)!=='http://www.iprogrammer.com')throw fail('native employer website binding changed')
 }catch{throw fail('native employer website binding changed')}
 const posts=[];const walk=v=>{if(v&&typeof v==='object'){if(v['@type']==='SocialMediaPosting'&&v.mainEntityOfPage===POST_URL)posts.push(v);Object.values(v).forEach(walk)}}
 for(const m of page.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]))}catch{throw fail('native publication schema is malformed')}}
 if(posts.length!==1)throw fail('current exact hiring announcement is missing or ambiguous')
 const post=posts[0],text=clean(post.text),age=Date.parse(checkedAt)-Date.parse(post.datePublished)
 if(post.author?.['@type']!=='Organization'||post.author.name!=='iProgrammer Solutions'||post.author.url!==PROFILE_URL||!Number.isFinite(age)||age<0||age>30*86400000)throw fail('employer author or announcement freshness is unverified')
 if(!/^We’re Hiring \| Sales Development Representative\b/.test(text)||/position filled|role closed|applications closed|no longer hiring|no longer accepting/i.test(text)
  ||!text.includes('Location: Pune | Work Mode: Work from Office | Employment: Full-Time')||!text.includes('4–5 years of experience')
  ||!text.includes('Detailed job description - '+SHORT_URL)||!text.includes('Share your resumes on - '+EMAIL))throw fail('published hiring title, workplace, experience, full JD or email application changed')
 return {datePosted:new Date(Date.parse(post.datePublished)).toISOString(),text}
}
const verifyPdfText=text=>{
 const ids=[...text.matchAll(/iPro\/HRD-TA\/JD\/\d{4}\/[A-Z]+\/\d+/g)].map(m=>m[0]),locations=[...text.matchAll(/Job\s+Location\s*:\s*([^\n]+)/g)].map(m=>clean(m[1]))
 if(!ids.length||ids.some(id=>id!==REQ)||!/^Position\s*:\s*Sales Development Representative \(SDR\)\s*$/m.test(text)
  ||locations.length!==1||locations[0]!=='Pune'||!/^Work Mode\s*:\s*Work from Office\s*$/m.test(text)
  ||!/^Employment Type\s*:\s*Full Time Role\s*$/m.test(text)||!/^Experience\s*:\s*4-5 Yrs\s*$/m.test(text)
  ||!clean(text).includes('iProgrammer is looking for a dynamic Sales Development Representative (SDR)')
  ||text.length<3000||!['Job Overview','Key Responsibilities','Required Experience','Preferred Skills','Educational Qualification',"What We're Looking For",'Why Join iProgrammer?'].every(section=>text.includes(section))
  ||/position filled|role closed|applications closed|no longer hiring/i.test(text))throw fail('fresh full native PDF requisition/title/employer/workplace/JD disagrees with the hiring announcement')
 return text
}
export const runPublishedAnnouncement=async({fetchPage=fetchAnnouncementPage,parsePdf=parseNativeAnnouncementPdf,now=()=>new Date().toISOString(),signal}={})=>{
 const read=async url=>{signal?.throwIfAborted();const page=await fetchPage(url,{signal});signal?.throwIfAborted();if(page.status!==200||page.url!==(url===PDF_URL?PDF_FINAL_URL:url))throw fail('native HTTP or final published authority changed: '+url+' HTTP '+page.status);return page}
 const checkedAt=now(),home=uncomment((await read(HOME_URL)).html)
 if(!/<title>\s*iProgrammer \| AI, Digital Engineering &amp; Odoo Company\s*<\/title>/i.test(home)||!/<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/iprogrammer\.com\/["']/i.test(home)||!clean(home).includes('iProgrammer'))throw fail('current first-party employer homepage changed')
 const post=currentAnnouncement((await read(PROFILE_URL)).html,checkedAt)
 const short=uncomment((await read(SHORT_URL)).html)
 const activeShort=short.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,'')
 const handoffs=[...activeShort.matchAll(/<a\b[^>]*data-tracking-control-name=["']external_url_click["'][^>]*>[\s\S]*?<\/a>/gi)]
 if(handoffs.length!==1||handoffs[0][0].match(/href=["']([^"']+)["']/i)?.[1]?.replaceAll('&amp;','&')!==VIEWER_URL||clean(handoffs[0][0])!==VIEWER_URL)throw fail('published detailed JD shortlink no longer hands off to the same document')
 const viewer=uncomment((await read(VIEWER_URL)).html)
 if(!/<title>JD - SDR 1\.pdf - Google Drive<\/title>/i.test(viewer)||!viewer.includes(PDF_URL.replaceAll('=','\\u003d').replaceAll('&','\\u0026')))throw fail('current public PDF viewer or download handoff changed')
 const download=await read(PDF_URL),description=verifyPdfText(await parsePdf(download.bytes,{signal}));signal?.throwIfAborted()
 const snapshot=currentAnnouncement((await read(PROFILE_URL)).html,checkedAt)
 if(JSON.stringify(post)!==JSON.stringify(snapshot))throw fail('current employer announcement changed during PDF verification')
 const job={title:'Sales Development Representative',company:'Iprogrammer Solutions',source:'iprogrammersolutions',jobId:REQ,requisitionId:REQ,location:'Pune',city:'Pune',country:'India',sourceUrl:POST_URL,applyUrl:POST_URL,link:POST_URL,applicationEmail:EMAIL,employmentType:'Full Time Role',experienceRequired:'4-5 Yrs',remoteStatus:'On-site',postingDate:post.datePosted,closingDate:null,jobDescription:description,requiredSkills:[],minimumQualification:null,preferredQualification:null,sourceListingComplete:false,scrapedAt:checkedAt}
 return attachInventoryEvidence([job],{status:'coverage-gap',surface:PROFILE_URL,firstParty:true,listingComplete:false,pagesFetched:1,reportedTotal:null,indiaFacetCount:null,verifiedAt:checkedAt,reason:'One fresh employer-authored hiring announcement with independently fetched complete native PDF JD and exact published email application; country derives from matching job-specific Pune workplace, not employer headquarters. Public announcement subset only; complete employer/global/India counts and expiry unknown. Publication must remain current within30days; prior jobs cannot expire from this feed.'})
}
