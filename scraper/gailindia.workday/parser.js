import {document,norm} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {requireNative,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
export const SOURCE='gailindia',COMPANY='GAIL India',BOARD='https://www.gailonline.com/Vacancies.html'
const ensure=(value,message)=>requireNative(value,'GAIL: '+message)
const date=value=>{
 const m=/^(\d{2})[.\/-](\d{2})[.\/-](\d{4})$/.exec(value||'')
 return m?nativeDate(`${m[3]}-${m[2]}-${m[1]}`,{required:true}):null
}
export function readBoard(html,clock){
 ensure(typeof html==='string'&&/<title>\s*GAIL India Limited\s*<\/title>/i.test(html),'Official GAIL board identity changed')
 const starts=[...html.matchAll(/const careerData\s*=\s*\{\s*current\s*:\s*`/g)]
 ensure(starts.length===1,'Missing/ambiguous current notice data')
 const start=starts[0].index+starts[0][0].length,end=html.indexOf('`',start),literal=html.slice(start,end)
 ensure(end>start&&!literal.includes('${')&&!literal.includes('\\`'),'Current notice HTML literal interpolated or incomplete')
 ensure(/^`\s*,/.test(html.slice(end)),'Current notice literal termination changed')
 const d=document(literal),cards=d.nodes(n=>d.hasClass(n,'vacancy-card'))
 ensure(!d.nodes(n=>n.tag==='a'&&(n.attrs.rel||'').split(/\s+/).includes('next')
  ||['nav','li'].includes(n.tag)&&/(?:^|\s)(?:pagination|pager|pager__item)(?:\s|$)/.test(n.attrs.class||'')).length,'New native notice pagination controls are unqualified')
 ensure(cards.length>0&&cards.length<=1000,'Missing/excessive notice cards')
 const cutoff=Date.parse(clock)-Date.parse(clock)%86400000-30*86400000,rows=[],recent=[]
 let ageExcluded=0,unknown=0,future=0,nonVacancy=0
 for(const card of cards){
  const text=d.text(card),titles=d.nodes(n=>n.tag==='h3',card).map(n=>d.text(n)),post=/\bPost Date:\s*(\d{2}[.\/-]\d{2}[.\/-]\d{4})\b/i.exec(text)
  let posted=null;try{posted=date(post?.[1])}catch{}
  const ids=d.nodes(n=>n.tag==='p',card).map(n=>d.text(n)).filter(t=>/^ADVERTISEMENT NO\s*\.?\s*:/i.test(t)).map(t=>t.replace(/^ADVERTISEMENT NO\s*\.?\s*:\s*/i,'').trim())
  const links=d.nodes(n=>n.tag==='a'&&n.attrs.href,card).map(a=>({text:d.text(a),url:new URL(a.attrs.href,BOARD).href}))
  const detail=links.filter(l=>/^Detailed Advertisement(?: in English| PDF(?:\s*\(.*\))?)?$/i.test(l.text))
  const administrative=!posted&&titles.length===1&&(/^(?:ADMIT CARD\b|Syllabus\b)/i.test(titles[0])
   ||/^Advt\.\s*no\./i.test(titles[0])&&/\(Exam Date\s*-/.test(titles[0])&&/Mock Test Link/.test(text))
  const row={id:ids.length===1?ids[0]:null,title:titles.length===1?titles[0]:null,postedDate:posted,detailURL:detail.length===1?detail[0].url:null,links,nativeCardHTML:d.outer(card),nativeText:text,nonVacancy:administrative}
  rows.push(row)
  if(administrative){nonVacancy++;continue}
  if(!posted){unknown++;continue}
  if(Date.parse(posted.iso)>Date.parse(clock)){future++;continue}
  if(Date.parse(posted.iso)<cutoff){ageExcluded++;continue}
  recent.push(row)
 }
 ensure(recent.length<=8,'Fresh notice scope exceeds bounded parser budget')
 ensure(new Set(recent.map(r=>r.id)).size===recent.length,'Duplicate/ambiguous fresh notice IDs')
 return{rows,recent,nativeNoticeInventory:{observedNoticeCards:cards.length,ageExcludedNoticeCards:ageExcluded,nonVacancyNoticeCards:nonVacancy,unknownPostingDateNoticeCards:unknown,futurePostingDateNoticeCards:future,recentNoticeCards:recent.length,unit:'advertisement-notice-cards;not job or vacancy totals'},fingerprint:JSON.stringify(rows.map(r=>[r.id,r.title,r.postedDate,r.links,r.nativeText]))}
}
export function readMedicalNotice(pdf,row,clock){
 ensure(Array.isArray(pdf?.pages)&&pdf.pages.length===2&&pdf.pages.every((p,i)=>p.page===i+1&&typeof p.text==='string'),'Complete two-page notice text missing')
 const original=pdf.pages.map(p=>p.text).join('\n'),text=norm(original)
 ensure(original.length>=2600&&original.length<=40000&&text.includes('GAIL (India) Limited')&&text.includes('KOLKATA ZONAL OFFICE'),'PDF employer/full notice conflict')
 const ids=[...new Set([...text.matchAll(/GAIL\/KOLKATA\/HR\/MEDICAL_CONSULTANT\/\d{4}\/\d+/g)].map(m=>m[0]))]
 ensure(ids.length===1&&ids[0]===row.id&&/Part Time Medical Consultant/i.test(row.title||''),'PDF/listing requisition/title conflict')
 ensure(/PART TIME MEDICAL CONSULTANT/.test(text)&&/MBBS/.test(text)&&/one-year post internship/.test(text)&&/Number of Vacancies/.test(text),'Missing authored qualification/vacancy content')
 const vacancies=[...text.matchAll(/\b(0?[1-9]\d*)\s+Walk-in\s+Interview\b/g)]
 ensure(vacancies.length===1,'Ambiguous native vacancy table')
 ensure(text.includes('Camac Street,Kolkata-')&&text.includes('Place of Services to be rendered')&&text.includes('Kolkata-700016'),'Job-specific Kolkata workplace missing')
 const workplace=/Place of Services to be rendered\s*:\s*(.*?)\s*Candidates for the Post/.exec(text)?.[1]
 const workplacePostcodes=[...(workplace??'').matchAll(/\bKolkata-\s*(\d{6})\b/g)]
 ensure(workplace&&/^About 08 months at GAIL Kolkata Zonal Office at /.test(workplace)
  &&workplacePostcodes.length===3&&workplacePostcodes.every(m=>m[1].startsWith('700')),'Advertised service workplace conflicts with Kolkata role scope')
 const day=date(/\b1\.\s*Date\s+(\d{2}\.\d{2}\.\d{4})\b/.exec(text)?.[1])
 const window=/Reporting Time\s+(\d{2}):(\d{2}) Hrs\. to (\d{2}):(\d{2}) Hrs\./.exec(text)
 ensure(day&&window,'Missing native walk-in date/reporting window')
 const numbers=window.slice(1).map(Number),[sh,sm,eh,em]=numbers
 ensure(sh<24&&eh<24&&sm<60&&em<60&&eh*60+em>sh*60+sm,'Invalid reporting window')
 const end=new Date(Date.parse(day.iso)+(eh*60+em-330)*60000).toISOString()
 ensure(row.postedDate&&Date.parse(row.postedDate.iso)<=Date.parse(end),'Posting/reporting chronology conflict')
 const facts={nativePostedDate:row.postedDate,postingClockOwner:'official native notice card Post Date',firstEverPublication:null,nativePDFPages:pdf.pages,
  nativeReportingWindow:window[0].replace(/^Reporting Time\s+/,''),nativeWalkInDate:day,reportingTimezoneDerivedFromVenue:'Asia/Kolkata',nativeClosingDate:null,
  expiryDerivation:'End of explicit walk-in reporting window;Kolkata local time converted atUTC+05:30',derivedWalkInReportingEndsAt:end,
  nativeVacancyCount:Number(vacancies[0][1]),nativeApplicationURL:null,nativeApplicationFormURL:row.links.find(l=>/^Application Form$/i.test(l.text))?.url??null,
  nativeRequisitionID:row.id,nativeEmployer:'GAIL (India) Limited',nativeJobWorkplaceSection:workplace,
  jobCountryDerivation:'Job-specific Place of Services section names Kolkata offices and their Indian postal addresses;not inferred from employer header or interview venue',applicationsVisited:false}
 if(Date.parse(clock)>Date.parse(end))return{excluded:true,id:row.id,kind:'walk-in-reporting-ended',nativeFacts:facts}
 return{source:SOURCE,company:COMPANY,title:'Part Time Medical Consultant',jobId:row.id,requisitionId:row.id,country:'India',city:'Kolkata',state:'West Bengal',location:'Kolkata, India',
  sourceUrl:row.detailURL,link:row.detailURL,applyUrl:null,nativeApplicationURL:null,jobDescription:original,postingDate:row.postedDate.iso,postedAt:row.postedDate.iso,closingDate:end,
  employmentType:'Part Time',nativeFacts:facts,sourceDetailComplete:true,sourceListingComplete:false,scrapedAt:clock}
}
