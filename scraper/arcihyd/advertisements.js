import{activeHead,readNativeDocument}from'../../scraper-support/utils/activeNativeHtml.js'
export const ORIGIN='https://arci.res.in',CAREERS=ORIGIN+'/offerings/careers',VACANCIES=ORIGIN+'/careers/vacancies',WORKSITES=ORIGIN+'/organization/locations-hyderabad'
export const need=(ok,message)=>{if(!ok)throw Error('ARCI native: '+message)}
export const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
export const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const one=(values,label)=>{need(values.length===1,'expected one '+label);return values[0]}
const all=(node,predicate)=>typeof node==='string'||node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.flatMap(child=>all(child,predicate))]
const roleName=value=>norm(value).replace(/&/g,'and').replace(/[^a-z0-9]/gi,'').toLowerCase()
export function calendar(value){const match=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(norm(value));need(match,'unrecognized original date-only field');const out=match[3]+'-'+match[2]+'-'+match[1],date=new Date(out+'T00:00:00Z');need(Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===out,'invalid original calendar date');return out}
export function readInventory(html){
 const doc=readNativeDocument(html);need(activeHead(html).titles.some(title=>/^Vacancies\s*\|\s*International Advanced Research Centre/i.test(title)),'current vacancies publisher changed')
 const cards=doc.nodes(node=>doc.hasClass(node,'career-card')),rows=[]
 for(const card of cards){const links=all(card,node=>node.tag==='a'&&/^\/careers\/vacancies\/[a-z-]+$/.test(node.attrs.href||''));if(!links.length)continue;const link=one(links,'current public advertisement link'),headings=all(card,node=>/^h[2-6]$/.test(node.tag)),title=headings.length?doc.text(headings[0]):link.attrs.title?.replace(/^Know more about /,'');need(title,'native advertisement title unavailable');const dates=/Published Date (\d{2}\.\d{2}\.\d{4}) Start Date (\d{2}\.\d{2}\.\d{4}) End Date (\d{2}\.\d{2}\.\d{4})/.exec(doc.text(card));need(dates,'native advertisement publication/window fields unavailable');rows.push({url:new URL(link.attrs.href,ORIGIN).href,title,publishedRaw:dates[1],published:calendar(dates[1]),startRaw:dates[2],start:calendar(dates[2]),closingRaw:dates[3],closing:calendar(dates[3])})}
 need(rows.length>0&&new Set(rows.map(row=>row.url)).size===rows.length,'unverified or duplicate current advertisement inventory')
 const next=doc.nodes(node=>node.tag==='a'&&node.attrs.href&&/\bpage=\d/.test(node.attrs.href)).map(node=>new URL(node.attrs.href,VACANCIES)).filter(url=>url.pathname==='/careers/vacancies');need(next.length===0,'additional native advertisement pagination requires extraction')
 return rows.sort((a,b)=>a.url.localeCompare(b.url))
}
export function readAdvert(html,listing){
 const doc=readNativeDocument(html),title=doc.text(one(doc.nodes(node=>node.tag==='h1'),'native advertisement title'));need(roleName(title)===roleName(listing.title),'listing/detail advertisement title conflict')
 const tables=doc.nodes(node=>node.tag==='table');need(tables.length===2,'unrecognized public advertisement role tables')
 const info=doc.text(tables[0]);need(info.includes('Published Date')&&info.includes(listing.publishedRaw),'native advertisement publication date conflict')
 const rows=all(tables[1],node=>node.tag==='tr').flatMap(row=>{const cells=all(row,node=>node.tag==='td');if(cells.length!==3||!/^\d+$/.test(doc.text(cells[0])))return[];return[{number:Number(doc.text(cells[0])),title:doc.text(cells[1])}]});need(rows.length>0&&rows.every((row,index)=>row.number===index+1&&row.title),'native public post-type rows incomplete')
 const docs=all(tables[0],node=>node.tag==='a'&&/\.pdf$/i.test(node.attrs.href||'')).map(node=>({name:doc.text(node),url:new URL(node.attrs.href,listing.url).href})),main=one(docs.filter(row=>row.name==='Advertisement Document'),'current public advertisement PDF'),terms=docs.filter(row=>row.name==='General Terms and Conditions')
 need(terms.length<=1,'ambiguous current public general terms');for(const file of[main,...terms]){const url=new URL(file.url);need(url.origin===ORIGIN&&url.pathname.startsWith('/sites/default/files/')&&!url.search&&!url.hash,'unrecognized native public PDF URL')}
 return{...listing,roleRows:rows,mainPdf:main,termsPdf:terms[0]||null}
}
const countryNames=new Map([['usa','United States']]),display=new Intl.DisplayNames(['en'],{type:'region'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=display.of(code);if(name&&name!==code&&!['ZZ','EU','UN','XA','XB','QO'].includes(code))countryNames.set(name.toLowerCase(),name)}
export function readWorksites(html){
 const doc=readNativeDocument(html),result={}
 for(const[name,id,postal]of[['Hyderabad','loc-hq-heading',/Hyderabad\s*-?\s*500005/i],['Gurugram','loc-liaison-heading',/Gurgaon\s*-?\s*122003/i]]){
  const section=one(doc.nodes(node=>node.tag==='section'&&node.attrs['aria-labelledby']===id),'current named office '+name),text=doc.text(section);need(/International Advanced Research Centre.*Powder Metallurgy.*New Materials.*ARCI/.test(text),'native office employer identity changed')
  if(name==='Gurugram')need(text.includes('ARCI Gurugram'),'native Gurugram office name unavailable')
  const addresses=[...new Set(all(section,node=>node.tag==='p'&&postal.test(doc.text(node))).map(doc.text))],known=[],unknown=[]
  for(const value of addresses){const fields=norm(value).replace(/\.$/,'').split(',').map(norm),suffix=fields.at(-1),country=countryNames.get(suffix.toLowerCase());for(const field of fields){const alternative=countryNames.get(field.toLowerCase());if(alternative)known.push(alternative)}if(!country)unknown.push(suffix)}
  const countries=[...new Set(known)],country=addresses.length&&unknown.length===0&&countries.length===1?countries[0]:null,states=[...new Set(addresses.map(value=>norm(value).replace(/\.$/,'').split(',').at(-2)).filter(Boolean))]
  result[name]={office:name,sourceUrl:WORKSITES,nativeSectionId:id,nativeOfficeText:text,nativeAddresses:addresses,nativeCountryAlternatives:countries,unknownCountryLiterals:unknown,country,state:states.length===1?norm(states[0]):null,qualified:country!==null}
 }
 return result
}
const postCodeMatches=text=>[...text.matchAll(/Post\s+Code\s*:\s*([A-Z]+\s*\d+)/g)].map(match=>({code:match[1].replace(/\s+/g,''),raw:match[1],index:match.index}))
function placements(main){const field=/No\.\s*of\s*Post(?:s|\s*\(s\))?\s*:\s*([\s\S]*?)(?=\n(?:Reservation|Natural of Post|Pay level|Age limit))/i.exec(main)?.[1]||'',count=Number(/\((\d+)\)/.exec(field)?.[1]),clause=/\[([\s\S]*?)\]/.exec(field)?.[1],slots=[]
 if(clause)for(const match of norm(clause).matchAll(/(\d+)\s+positions?\s+will\s+be\s+placed\s+at\s+(ARCI-([A-Za-z]+)[\s\S]*?)(?=\s+and\s+\d+\s+positions?|$)/gi))slots.push({count:Number(match[1]),office:match[3],nativePlacement:match[2]})
 return{count:Number.isFinite(count)&&count>0?count:null,slots,allPositionsExplicitlyPlaced:Boolean(count&&slots.length&&slots.reduce((sum,row)=>sum+row.count,0)===count),nativeNoOfPosts:field}
}
function nativeSchedule(page,advert,codes,pdfSha256){
 need(page.number===16&&page.width===612&&page.height===792&&Array.isArray(page.items),'native schedule layout is unqualified')
 const box=(left,right,bottom,top)=>({left,right,bottom,top}),text=area=>norm(page.items.filter(item=>item.x>=area.left&&item.x<area.right&&item.y>=area.bottom&&item.y<=area.top).map(item=>item.text).join(' '))
 const headerBands=[{area:box(120,233,652,691),expected:'Post Name'},{area:box(233,333,652,691),expected:'Tentative Date for CWE'},{area:box(333,466,652,691),expected:'Tentative Date for Interview/Trade/Skill Test'},{area:box(466,548,652,691),expected:'Examination Centre for CWE/ Trade/Skill Test'}]
 for(const header of headerBands)need(roleName(text(header.area))===roleName(header.expected),'native schedule column identity or geometry changed')
 const bands=[{bottom:614,top:654},{bottom:555,top:614},{bottom:526,top:555},{bottom:482,top:526},{bottom:438,top:482},{bottom:394,top:438}],sharedArea=box(233,333,438,555),sharedCwe=text(sharedArea),sharedCodes=codes.slice(2,5).map(row=>row.code)
 need(/\d{1,2}\s+(?:st|nd|rd|th)\s+[A-Za-z]+\s+\d{4}/.test(sharedCwe)&&/\d{4} to \d{4} hours/.test(sharedCwe),'native merged schedule CWE cell unavailable')
 return bands.map((band,index)=>{
  const ownTitle=text(box(120,233,band.bottom,band.top)),expected=advert.roleRows[index];need(roleName(ownTitle)===roleName(expected.title)||roleName(ownTitle).startsWith(roleName(expected.title)),'native schedule row/post identity changed')
  const shared=index>=2&&index<=4,cwe=index===1?null:shared?sharedCwe:text(box(233,333,band.bottom,band.top)),interview=text(box(index===1?233:333,466,band.bottom,band.top)),centre=text(box(466,548,band.bottom,band.top))
  need(interview&&centre&&(index===1||cwe&&/\d{4} to \d{4} hours/.test(cwe)),'native own-role schedule cell unavailable')
  return{text:['Post Name: '+ownTitle,...(cwe?['Tentative Date for CWE: '+cwe]:[]),(index===1?'Interview: ':'Tentative Date for Interview/Trade/Skill Test: ')+interview,'Examination Centre for CWE/Trade/Skill Test: '+centre].join('\n'),binding:{method:'original-PDF-labelled-table-row-and-verified-merged-cell-geometry',pdfSha256,page:page.number,pageWidth:page.width,pageHeight:page.height,nativeRowNumber:index+1,nativePostCode:codes[index].code,nativePostName:ownTitle,ownRowBand:band,sharedCweBox:shared?sharedArea:null,sharedCwePostCodes:shared?sharedCodes:[],nativeCwe:cwe,nativeInterviewOrTradeSkill:interview,nativeExaminationCentre:centre},complete:{text:page.text,pdfSha256,page:page.number}}}
 )
}
export function parsePublishedPostCriteria(advert,main,terms){
 need(main?.text?.includes('International Advanced Research Centre')||main?.text?.includes('INTERNATIONAL ADVANCED RESEARCH CENTRE'),'public PDF employer unavailable')
 const number=/Advt\.?\s*No\.?\s*:?\s*(ARCI\/[A-Z]+\/[A-Z]+\/\d+\/\d{4})/.exec(main.text)?.[1];need(number,'native advertisement identifier unavailable')
 const procedureAt=main.text.indexOf('Application Procedure:'),initial=procedureAt<0?main.text:main.text.slice(0,procedureAt),codes=postCodeMatches(initial);need(codes.length===advert.roleRows.length&&new Set(codes.map(row=>row.code)).size===codes.length,'native HTML/PDF post-type identities do not reconcile')
 const multi=codes.length>1,selectionPages=multi?main.pages.filter(page=>postCodeMatches(page.text).length===1&&main.text.indexOf(page.text)>procedureAt):[],schedule=multi?main.pages.find(page=>page.text.includes('Tentative Schedule for Competitive Written Examination')):null
 if(multi){need(main.totalPages===16&&selectionPages.length===codes.length&&schedule&&terms?.totalPages===5&&terms.text.includes(number),'native full selection/shared-terms/schedule documents incomplete')}
 const headerAt=multi?main.text.indexOf('Sl.\nNo.'):-1
 if(multi)need(headerAt>=0&&headerAt<codes[0].index,'native role table header unavailable or follows a post identity')
 const firstSelection=multi?main.text.indexOf(selectionPages[0].text):-1,commonProcedure=multi?main.text.slice(procedureAt,firstSelection):'',intro=multi?main.text.slice(0,headerAt):'',scheduleRows=schedule?[...schedule.text.matchAll(/(?:^|\n)(0[1-6])\.\s/g)].map(match=>({number:Number(match[1]),index:match.index})):[]
 if(multi)need(firstSelection>procedureAt&&intro&&scheduleRows.length===codes.length,'native public role criteria slices incomplete')
 const schedules=multi?nativeSchedule(schedule,advert,codes,main.sha256):[]
 return codes.map((entry,index)=>{
  const ownMain=multi?initial.slice(entry.index,codes[index+1]?.index??initial.length).trim():main.text,title=norm(/Name of the [Pp]ost\s*:\s*([^\n]+)/.exec(ownMain)?.[1]);need(title,'native public role title unavailable')
  const expected=advert.roleRows[index];need(roleName(title)===roleName(expected.title)||roleName(title).startsWith(roleName(expected.title)),'native post code/title association changed')
  const selection=multi?one(selectionPages.filter(page=>postCodeMatches(page.text)[0].code===entry.code),'own public selection criteria').text:'',scheduleRow=multi?schedule.text.slice(scheduleRows[index].index,scheduleRows[index+1]?.index??schedule.text.length).trim():'',ownSchedule=multi?schedules[index]:null
  const sharedTerms=multi?(entry.code==='OB001'?terms.text:terms.pages.slice(0,4).map(page=>page.text).join('\n\n').replace(/4a\.[\s\S]*?(?=4b\.)/,'')):'',description=multi?[intro,ownMain,commonProcedure,selection,sharedTerms,ownSchedule.text,'Recruitment schedule (all posts):\n'+schedule.text].join('\n\n'):main.text
  need(description.length>1500&&/Essential|Qualifications|Qualification/.test(description),'full current native qualifications unavailable')
  const place=placements(ownMain),scope=[];for(const match of main.text.matchAll(/Last Date[^\n]*|LAST DATE[^\n]*/g))scope.push(match[0])
  return{source:'arcihyd',company:'International Advanced Research Centre for Powder Metallurgy and New Materials (ARCI)',companyDomain:'arci.res.in',companyCareerPage:VACANCIES,atsPlatform:'first-party-public-advertisement-pdf',jobId:number+':'+entry.raw,requisitionId:null,title,sourceUrl:advert.url,detailUrl:advert.url,applyUrl:advert.url,jobDescription:description,sourceDescription:description,postingDate:advert.published,sourcePostingDate:advert.publishedRaw,sourcePostingDatePrecision:'date-only',closingDate:advert.closing,sourceClosingDate:advert.closingRaw,sourceClosingDatePrecision:'date-only-native-timezone-and-exact-expiry-unpublished',sourceNativeAdvertisementNumber:number,sourceNativePostCode:entry.code,sourceNativeOriginalPostCode:entry.raw,sourceNativeNumberOfPosts:place.count,sourceNativeNoOfPostsField:place.nativeNoOfPosts,sourceNativePlacementSlots:place.slots,sourceNativeAllPositionsExplicitlyPlaced:place.allPositionsExplicitlyPlaced,sourceNativeOwnPostMain:ownMain,sourceNativeOwnSelection:selection,sourceNativeOwnSchedule:ownSchedule?.text||'',sourceNativeOriginalScheduleRow:scheduleRow,sourceNativeScheduleBinding:ownSchedule?.binding||null,sourceNativeCompleteSchedule:ownSchedule?.complete||null,sourceNativePdfDeadlines:scope,sourceNativePublicPdfDocuments:[{url:advert.mainPdf.url,sha256:main.sha256,pages:main.totalPages},...(terms?[{url:advert.termsPdf.url,sha256:terms.sha256,pages:terms.totalPages}]:[])],sourceDetailComplete:true,country:null,city:null,state:null,location:null,locations:[],sourceCountryScopeUnresolved:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 })
}
export function bindExplicitWorksites(job,worksites){
 const slots=job.sourceNativePlacementSlots.map(slot=>({...slot,officeEvidence:worksites[slot.office]||null})),india=slots.filter(slot=>slot.officeEvidence?.qualified&&slot.officeEvidence.country==='India'),unknown=slots.some(slot=>!slot.officeEvidence?.qualified)
 if(!job.sourceNativeAllPositionsExplicitlyPlaced||!india.length)return{...job,sourceNativeBoundWorksites:slots,sourceNativeIndiaPositions:0,sourceNativeOtherWorksitesUnresolved:unknown}
 return{...job,country:'India',city:india.length===1?india[0].office:null,state:india.length===1?india[0].officeEvidence.state:null,location:india.map(slot=>slot.nativePlacement).join('; '),locations:india.map(slot=>slot.nativePlacement),sourceNativeBoundWorksites:slots,sourceNativeIndiaPositions:india.reduce((sum,slot)=>sum+slot.count,0),sourceNativeOtherWorksitesUnresolved:unknown,sourceCountryScopeUnresolved:false,sourceIndiaWorksiteQualified:true,sourceCurrentNativeRoleQualified:true,sourceNativeCountryProof:{method:'exact-native-post-placement-to-current-named-office-address-country',sourceUrl:WORKSITES,allOfficeCountriesQualified:!unknown,qualifiedIndiaOfficeNames:india.map(slot=>slot.office),companyHeadquartersInference:false}}
}
