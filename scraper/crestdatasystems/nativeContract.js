import {createHash} from 'node:crypto'
import {readNativeDocument,decodeNativeHtml} from './nativeHtml.js'
export const BASE='https://www.crestdata.ai/',CAREERS=BASE+'careers/',BOARD=CAREERS+'open-positions/',REBRAND=BASE+'blogs/introducing-crest-data',CONTACT=BASE+'contact/'
export const FEEDS=['job_career?per_page=100&_fields=id,date,link,title,content,team,job_location','job_location?per_page=100&hide_empty=true&_fields=id,name,slug','team?per_page=100&hide_empty=true&_fields=id,name,slug'].map(p=>BASE+'wp-json/wp/v2/'+p)
export const check=(condition,message)=>{if(!condition)throw Error('Crest native contract: '+message)}
const one=(items,label)=>{check(items.length===1,'Expected one '+label);return items[0]}
const norm=value=>decodeNativeHtml(value).replace(/\s+/g,' ').trim()
const descendants=(root,predicate)=>root.inert?[]:[...(predicate(root)?[root]:[]),...root.children.filter(n=>typeof n!=='string').flatMap(n=>descendants(n,predicate))]
function canonical(doc,url){check(one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href===url,'Canonical mismatch')}
function activeLinks(doc,url){check(doc.nodes(n=>n.tag==='a'&&n.attrs.href===url).length>0,'Active official handoff missing')}
export function verifyBinding(pages,client){
 const docs=pages.map(p=>readNativeDocument(p))
 for(let i=0;i<5;i++)canonical(docs[i],[BASE,CAREERS,BOARD,REBRAND+'/',CONTACT][i])
 activeLinks(docs[0],CAREERS);activeLinks(docs[1],BOARD)
 const rebrand=docs[3].nodes(n=>n.tag==='body').map(n=>docs[3].text(n)).join(' ')
 check(rebrand.includes('Crest Data Systems')&&rebrand.includes('rebrand to Crest Data'),'Explicit corporate rebrand missing')
 const offices=docs[4].nodes(n=>n.tag==='body').map(n=>docs[4].text(n)).join(' ')
 check(offices.includes('Ahmedabad, Gujarat, India')&&offices.includes('Pune, Maharashtra, India'),'Corporate India office corroboration missing')
 const scripts=docs[2].nodes(n=>n.tag==='script'&&!n.attrs.src&&!Object.hasOwn(n.attrs,'nomodule')&&(!n.attrs.type||['text/javascript','application/javascript'].includes(n.attrs.type)))
 check(scripts.filter(n=>createHash('sha256').update(n.raw||'').digest('hex')===client.inlineScriptSha256).length===1,'Advertised active public client changed')
}
export function parseFeed(response){
 const count=response.headers.get('x-wp-total'),pages=response.headers.get('x-wp-totalpages')
 check(typeof count==='string'&&/^(?:0|[1-9]\d*)$/.test(count)&&pages==='1','Native total/pages unavailable or multiple-page contract unqualified')
 const data=JSON.parse(response.body);check(Array.isArray(data),'Expected native public array; upstream error envelope')
 check(Number.isSafeInteger(Number(count))&&data.length===Number(count)&&data.length<=100,'Incomplete native feed')
 check(data.every(r=>r&&typeof r==='object'&&!Array.isArray(r)&&Number.isSafeInteger(r.id)&&r.id>0),'Invalid native IDs')
 for(const row of data)for(const [key,value] of Object.entries(row)){
  const k=key.toLowerCase()
  if(['error','errors','exception','fault','success','statuscode'].includes(k))check((['error','errors','exception','fault'].includes(k)&&value==null)||(k==='success'&&value===true)||(k==='statuscode'&&value===200),'Native failure or malformed status field')
 }
 check(new Set(data.map(r=>r.id)).size===data.length,'Duplicate native IDs');return data
}
function date(value,now){
 check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value),'Native publication precision changed')
 const parsed=new Date(value+'Z');check(Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,19)===value,'Invalid native calendar')
 check(value.slice(0,10)<=now.slice(0,10),'Future publication date')
 // The supplied local timestamp has no zone: preserve it, publish its calendar day.
 return value.slice(0,10)
}
function content(doc,id){
 const root=one(doc.nodes(n=>n.attrs['data-elementor-type']==='wp-post'&&n.attrs['data-elementor-id']===String(id)),'native post root')
 const title=doc.text(one(descendants(root,n=>n.tag==='h1'),'native visible heading'))
 const location=one(descendants(root,n=>n.tag==='h2').map(n=>doc.text(n)).filter(t=>!/^Apply now$/i.test(t)),'native location heading')
 const jd=doc.text(one(descendants(root,n=>doc.hasClass(n,'elementor-widget-text-editor')),'full native description'))
 return{root,title,location,jd}
}
function description(value){
 const text=norm(value),body=text.replace(/^No\. Of Positions\s*:\s*\d+\s+Location\s*:\s*Ahmedabad(?:\s*\/\s*Pune)?(?:\s+Experience\s*:\s*\d+\+?\s*Years)?\s*/i,'')
 if(/(?:this|the)\s+(?:role|job|position|vacancy)\s+(?:(?:is|has been)\s+(?:closed|filled|no longer available)|is not available)|no longer accepting applications/i.test(body))return null
 const remainder=body.replace(/(?:please\s+)?(?:click\s+(?:the\s+)?apply(?:\s+now)?|apply\s+now|submit\s+your\s+application|(?:the\s+)?(?:full\s+)?job\s+description\s+is\s+(?:currently\s+)?unavailable|(?:please\s+)?check\s+back\s+later|(?:see|view)\s+(?:the\s+)?attachment)[^.!?]*(?:[.!?]|$)/gi,'').trim()
  .replace(/^(?:Job Description\s*:\s*)?About Crest Data\s*:[\s\S]*?(?=(?:Job Description|Role Overview|Responsibilities|Qualifications|Required qualification)\s*:|$)/i,'')
  .replace(/\b(?:job description|sample|placeholder|coming soon|details available soon|read more|attached|tbd|n\/a)\b/gi,'').trim()
 return (remainder.match(/[A-Za-z]/g)||[]).length>=80?text:null
}
function validateApplication(doc,form,match,postId){
 // The public CF7 action alone is insufficient: validate its current widget,
 // hidden native identifiers, and usable applicant/submit controls. Never submit.
 const unit=one(doc.nodes(n=>n.attrs.id===match[2]),'native application unit')
 check(descendants(unit,n=>n===form).length===1,'Application unit does not contain its form')
 check(doc.hasClass(form,'wpcf7-form')&&form.attrs['data-status']==='init','Native application status unavailable')
 const enabled=(node,predicate)=>node.inert||Object.hasOwn(node.attrs,'disabled')||Object.hasOwn(node.attrs,'readonly')||node.attrs['aria-disabled']?.toLowerCase()==='true'?[]:[...(predicate(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>enabled(n,predicate))]
 const controls=enabled(one(doc.nodes(n=>n.tag==='root'),'native document'),n=>['input','textarea','button','select'].includes(n.tag))
 for(const [name,value] of[['_wpcf7',match[3]],['_wpcf7_unit_tag',match[2]],['_wpcf7_container_post',String(postId)]]){
  const input=one(descendants(form,n=>n.attrs.name===name),'native '+name)
  check(input.tag==='input'&&input.attrs.type==='hidden'&&input.attrs.value===value&&controls.includes(input)&&!Object.hasOwn(input.attrs,'form'),'Native application identifier mismatch, disabled or reassociated')
 }
 for(const [name,type] of[['name-438','text'],['email-873','email'],['tel-969','tel'],['url-168','url'],['acceptance-120','checkbox']]){
  const input=one(descendants(form,n=>n.attrs.name===name),'native applicant control '+name)
  check(input.tag==='input'&&input.attrs.type===type&&controls.includes(input)&&!Object.hasOwn(input.attrs,'form'),'Native applicant control unavailable')
 }
 const experience=one(descendants(form,n=>n.attrs.name==='message-601'),'native applicant relevant experience')
 check(experience.tag==='textarea'&&controls.includes(experience)&&!Object.hasOwn(experience.attrs,'form'),'Native relevant experience control unavailable')
 const submit=one(descendants(form,n=>['input','button'].includes(n.tag)&&n.attrs.type==='submit'),'native application submit')
 check(controls.includes(submit)&&!['form','formaction','formmethod'].some(key=>Object.hasOwn(submit.attrs,key)),'Native application submit unavailable or redirected')
}
export function parseJobs(rows,locations,teams,details,now){
 check(locations.every(l=>typeof l.name==='string'&&typeof l.slug==='string'),'Invalid office taxonomy')
 const known=new Map([[13,['Ahmedabad','ahmedabad']],[14,['Pune','pune']]])
 for(const l of locations)check(known.has(l.id)&&l.name===known.get(l.id)[0]&&l.slug===known.get(l.id)[1],'Unknown or conflicting native office')
 check(teams.every(t=>typeof t.name==='string'&&typeof t.slug==='string'),'Invalid native team taxonomy')
 const urls=new Set();return rows.map((row,index)=>{
  check(row.title&&typeof row.title.rendered==='string'&&row.content&&typeof row.content.rendered==='string','Missing native role data')
  check(row.status==null||row.status==='publish','Non-public native status')
  for(const key of['country','countryCode','country_code','employer','company'])check(row[key]==null,'New native country/employer field requires qualification')
  check(Array.isArray(row.job_location)&&row.job_location.length>0&&new Set(row.job_location).size===row.job_location.length,'Missing/duplicate office scope')
  const cities=row.job_location.map(id=>{const l=locations.find(l=>l.id===id);check(l&&known.has(id),'Unresolved role location');return l.name})
  check(Array.isArray(row.team)&&row.team.length>0&&new Set(row.team).size===row.team.length&&row.team.every(id=>teams.some(t=>t.id===id)),'Unknown/duplicate role team')
  check(typeof row.link==='string'&&/^https:\/\/www\.crestdata\.ai\/jobs\/[a-z0-9-]+\/$/.test(row.link)&&!urls.has(row.link),'Invalid/duplicate native URL');urls.add(row.link)
  const postedAt=date(row.date,now),titleDoc=readNativeDocument(row.title.rendered),title=titleDoc.nodes(n=>n.tag==='root').map(n=>titleDoc.text(n)).join('')
  check(title&&title===norm(row.title.rendered),'Native title is not plain active text')
  const api=content(readNativeDocument(row.content.rendered),row.id),doc=readNativeDocument(details[index]),page=content(doc,row.id)
  canonical(doc,row.link)
  const meta=name=>one(doc.nodes(n=>n.tag==='meta'&&n.attrs.property===name),'native '+name).attrs.content
  check(meta('og:title')===title+' - Crest Data'&&meta('og:url')===row.link,'Native page title/URL mismatch')
  check(api.title===page.title&&api.title.length>0&&api.location===page.location&&api.jd===page.jd,'Native detail/feed mismatch')
  check(page.location===cities.join('/'),'Native title office/taxonomy disagreement')
  const position=/^No\. Of Positions\s*:\s*(\d+)\s+Location\s*:\s*([^]+?)\s+(?:Experience\s*:|Job Description\s*:|Role Overview\s*:|Required qualification\s*:)/i.exec(page.jd)
  check(position&&Number(position[1])>0&&position[2].trim()===cities.join('/'),'Native vacancy/description location mismatch')
  const forms=descendants(page.root,n=>n.tag==='form').filter(f=>descendants(f,n=>n.tag==='input'&&n.attrs.name==='_wpcf7_container_post'&&n.attrs.value===String(row.id)).length)
  const form=one(forms,'job-bound public application form'),inputs=descendants(form,n=>n.tag==='input'&&n.attrs.name==='_wpcf7_container_post')
  check(inputs.length===1&&inputs[0].attrs.value===String(row.id),'Conflicting native application post ID')
  const action=form.attrs.action,match=typeof action==='string'&&/^([^#]+)#(wpcf7-f(\d+)-p(\d+)-o\d+)$/.exec(action)
  check(match&&match[1]===new URL(row.link).pathname&&match[4]===String(row.id)&&form.attrs.method?.toLowerCase()==='post','Native application identity mismatch')
  validateApplication(doc,form,match,row.id)
  const jd=description(page.jd)
  return{jobId:String(row.id),title,company:'Crest Data Systems',source:'crestdatasystems',sourceURL:row.link,sourceUrl:row.link,url:row.link,applyUrl:new URL(action,BASE).href,location:cities.map(c=>c+', India').join('; '),locations:cities.map(c=>c+', India'),city:cities.length===1?cities[0]:null,country:'India',postedAt,postedAtPrecision:'day',nativePostedAt:row.date,nativePostedAtTimezone:null,nativeCountry:null,nativeLegalEmployer:null,nativeBrand:'Crest Data',nativeDetailTitle:page.title,nativeTitleDiscrepancy:title!==page.title,nativeLocation:page.location,nativeLocationIds:row.job_location,nativeTeamIds:row.team,nativeOpenPositions:Number(position[1]),sourceCountryEvidence:'Native exact office taxonomy corroborated by current corporate India office addresses; native country absent',sourceDescription:jd,description:jd,sourceDetailComplete:!!jd,sourceDetailStatus:jd?'complete':'missing-content',sourceListingComplete:false,sourceScopeComplete:false,scrapedAt:now}
 })
}
