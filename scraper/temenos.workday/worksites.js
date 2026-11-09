import{createHash}from'node:crypto'
import{document}from'../../scraper-support/shared/rmkNativePairHtml.js'
import{decodeNativeEntities}from'../../scraper-support/utils/activeNativeHtml.js'
export const TEMENOS_OFFICES='https://www.temenos.com/offices/'
export const TEMENOS_CAREERS='https://www.temenos.com/about-us/careers/'
export const TEMENOS_BOARD='https://temenos.wd103.myworkdayjobs.com/en-US/Temenoscareers'
export const TEMENOS_JOBS='https://temenos.wd103.myworkdayjobs.com/wday/cxs/temenos/Temenoscareers/jobs'
const clean=value=>String(value??'').replace(/\s+/g,' ').trim(),hash=value=>createHash('sha256').update(value).digest('hex')
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Temenos office directory '+message),{abortRetries:true,failureKind:'parser_or_contract_error'})}
const names=new Map(),display=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=display.of(code);if(name&&name!==code&&!['ZZ','EU','UN','XA','XB','QO'].includes(code))names.set(name.toLowerCase(),{descriptor:name,alpha2Code:new Intl.Locale('und-'+code).region})}
for(const[raw,code]of Object.entries({'the netherlands':'NL','usa':'US','united states of america':'US','uk':'GB','uae':'AE','republic of south africa':'ZA','kingdom of saudi arabia':'SA','hong kong':'HK','bosnia and herzegovina':'BA'}))names.set(raw,{descriptor:display.of(code),alpha2Code:code})
const lineText=node=>typeof node==='string'?decodeNativeEntities(node):node.tag==='br'?'\n':node.tag==='script'||node.tag==='style'?'':(node.children??[]).map(lineText).join('')+(['p','div'].includes(node.tag)?'\n':'')
export function readTemenosOfficePage(html,url){
 const u=new URL(url);need(u.origin==='https://www.temenos.com'&&!u.search&&!u.hash&&(u.pathname==='/offices/'||/^\/offices\/page\/[1-9]\d*\/$/.test(u.pathname)),'page identity changed')
 const d=document(html),main=d.nodes(n=>n.tag==='main');need(main.length===1,'main region missing');const canonical=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical');need(canonical.length===1&&canonical[0].attrs.href===TEMENOS_OFFICES,'canonical identity changed')
 const count=[...d.text(main[0]).matchAll(/\b(\d+)\s+Results\b/gi)].map(m=>Number(m[1]));need(count.length===1&&count[0]>0&&count[0]<=1000,'total absent or ambiguous')
 const cards=d.nodes(n=>n.attrs['data-post-id']&&n.attrs['data-position'],main[0]);need(cards.length>0&&cards.length<=20,'page cards absent or excessive')
 const records=cards.map(card=>{const id=Number(card.attrs['data-post-id']),position=Number(card.attrs['data-position']),labels=d.nodes(n=>d.hasClass(n,'h4'),card),address=d.nodes(n=>d.hasClass(n,'address'),card);need(Number.isSafeInteger(id)&&id>0&&Number.isSafeInteger(position)&&position>0&&labels.length===1&&address.length===1,'worksite fields malformed');const label=d.text(labels[0]),lines=lineText(address[0]).split('\n').map(clean).filter(Boolean),publisherCountryText=lines.at(-1);need(label&&lines.length>=2&&publisherCountryText,'public worksite address missing');return{id,position,label,employerEntity:lines[0],addressLines:lines,publisherCountryText,country:names.get(publisherCountryText.toLowerCase())??null,sourceUrl:url,sourceCardSHA256:hash(d.outer(card))}})
 const links=[...new Set(d.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string'&&/^https:\/\/www\.temenos\.com\/offices\/page\/[1-9]\d*\/$/.test(n.attrs.href),main[0]).map(n=>n.attrs.href))]
 return{url,status:200,sha256:hash(html),reportedTotal:count[0],pageNumber:u.pathname==='/offices/'?1:Number(u.pathname.match(/page\/(\d+)/)[1]),records,paginationLinks:links,fetchedAt:new Date().toISOString()}
}
export function reconcileTemenosOffices(pages){
 need(Array.isArray(pages)&&pages.length>0&&pages.length<=10,'page cohort missing');const total=pages[0].reportedTotal,ids=new Set(),positions=new Set(),pageNumbers=new Set(),records=[]
 for(const p of pages){need(p.reportedTotal===total&&!pageNumbers.has(p.pageNumber),'total or page changed');pageNumbers.add(p.pageNumber);for(const r of p.records){need(!ids.has(r.id)&&!positions.has(r.position),'duplicate worksite or position');ids.add(r.id);positions.add(r.position);records.push(r)}}
 const advertisedPages=new Set(pages.flatMap(p=>p.paginationLinks));need([...advertisedPages].every(url=>pages.some(p=>p.url===url))&&records.length===total&&Array.from({length:total},(_,i)=>i+1).every(n=>positions.has(n))&&Array.from({length:pageNumbers.size},(_,i)=>i+1).every(n=>pageNumbers.has(n)),'incomplete directory')
 return{reportedTotal:total,records:records.sort((a,b)=>a.position-b.position),pages:pages.map(({records,paginationLinks,...p})=>({...p,worksiteIds:records.map(r=>r.id)})).sort((a,b)=>a.pageNumber-b.pageNumber)}
}
export function buildTemenosWorksiteProof(initial,closing,corporateReceipt,attempt={}){const attemptStartedAt=attempt.attemptStartedAt??new Date(Math.min(...[corporateReceipt.fetchedAt,...initial.pages.map(p=>p.fetchedAt),...closing.pages.map(p=>p.fetchedAt)].map(Date.parse))).toISOString(),attemptDeadlineAt=attempt.attemptDeadlineAt??new Date(Date.parse(attemptStartedAt)+180000).toISOString();return{version:'workday-additional-worksites-v1',source:'temenos',jobsApiUrl:TEMENOS_JOBS,boardUrl:TEMENOS_BOARD,officialCareersUrl:TEMENOS_CAREERS,directoryUrl:TEMENOS_OFFICES,corporateReceipt,snapshots:[structuredClone(initial),structuredClone(closing)],attemptStartedAt,attemptDeadlineAt,verifiedAt:new Date().toISOString()}}
