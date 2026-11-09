import {document,norm} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {activeScripts} from '../../scraper-support/utils/activeNativeHtml.js'

const CAREERS='https://www.hostbooks.com/in/hb/career/'
const check=(ok,message)=>{if(!ok)throw Object.assign(Error('HostBooks native role: '+message),{abortRetries:true})}
const all=node=>[node,...node.children.filter(n=>typeof n!=='string').flatMap(all)]
const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>within(n,predicate))]
const visible=html=>readVisibleNativeDocument(html,{strict:true})
const slug=value=>norm(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
const date=value=>{
 const match=norm(value).match(/^(\d{1,2}) ([A-Za-z]{3}), (\d{4})$/),months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
 if(!match)return null
 const month=months.indexOf(match[2].toLowerCase())+1,iso=match[3]+'-'+String(month).padStart(2,'0')+'-'+match[1].padStart(2,'0')
 return month&&new Date(iso).toISOString().slice(0,10)===iso?iso:null
}
export const readHostBooksOpeningRows=html=>{
 const doc=visible(html),rows=[]
 const sections=doc.nodes(n=>n.tag==='section'&&doc.hasClass(n,'currentOpening'))
 check(sections.length<=1,'ambiguous current-opening section')
 let tables
 if(sections.length)tables=within(sections[0],n=>n.tag==='table')
 else{
  const ordered=doc.nodes(n=>n.tag==='h3'||n.tag==='table'),headings=ordered.filter(n=>n.tag==='h3'&&doc.text(n)==='Current Opening')
  if(!headings.length)return rows
  check(headings.length===1,'ambiguous current-opening heading')
  const following=ordered.slice(ordered.indexOf(headings[0])+1),end=following.findIndex(n=>n.tag==='h3')
  tables=(end<0?following:following.slice(0,end)).filter(n=>n.tag==='table')
 }
 check(tables.length===1,'missing/ambiguous current-opening table')
 for(const tr of within(tables[0],n=>n.tag==='tr')){
  const cells=tr.children.filter(n=>typeof n!=='string'&&n.tag==='td'&&!n.inert)
  if(cells.length!==4||doc.text(cells[3])!=='View Job')continue
  const title=doc.text(cells[0]),rawDate=doc.text(cells[1]),experience=doc.text(cells[2])
  check(title&&experience,'missing opening table identity')
  const controls=within(cells[3],n=>n.tag==='button')
  check(controls.length<=1,'ambiguous opening control')
  const button=controls[0]
  if(button)check(!Object.hasOwn(button.attrs,'disabled')&&button.attrs['aria-disabled']!=='true'
   &&button.attrs['data-toggle']==='modal'&&button.attrs['data-target']==='#currentOpening-modal'
   &&/^[a-z0-9]+$/.test(button.attrs['data-id']||''),'changed native role modal binding')
  rows.push({title,postingDate:date(rawDate),nativeDateRaw:rawDate,experienceRequired:experience,
   nativeRoleId:button?.attrs['data-id']||null,nativeTarget:button?.attrs['data-target']||null})
 }
 check(new Set(rows.map(r=>r.title)).size===rows.length,'duplicate opening title')
 check(new Set(rows.map(r=>r.nativeRoleId).filter(Boolean)).size===rows.filter(r=>r.nativeRoleId).length,'duplicate native modal role')
 return rows
}
export const hostBooksSummaryRows=html=>new Map(readHostBooksOpeningRows(html).map(row=>[row.title,{postingDate:row.postingDate,experienceRequired:row.experienceRequired}]))
const labeledValues=(html,labels)=>{
 const doc=visible(html),matches=[]
 for(const node of doc.nodes(n=>['p','li'].includes(n.tag))){
  const text=doc.text(node),match=text.match(/^([^:]+):\s*(.*)$/)
  if(match&&labels.some(label=>label.toLowerCase()===norm(match[1]).toLowerCase()))matches.push({label:norm(match[1]),value:norm(match[2]),visible:true})
 }
 return matches
}
const geography=html=>{
 const values=labeledValues(html,['Work Location','Location']),raw=document(html)
 const declared=all(raw.root).filter(n=>['p','li'].includes(n.tag)).flatMap(n=>{
  const value=norm(raw.inner(n).replace(/<[^>]+>/g,' ')),match=value.match(/^(Work Location|Location)\s*:\s*(.*)$/i)
  return match?[{label:norm(match[1]),value:norm(match[2]),visible:values.some(v=>v.value===norm(match[2]))}]:[]
 })
 check(values.length<=1&&new Set(declared.map(v=>v.value)).size<=1,'conflicting or duplicate workplace statements')
 const location=values[0]?.value||null
 if(!location)return{location:null,city:null,country:null,evidence:declared}
 const parts=location.split(',').map(norm),countries=parts.filter(p=>p.length>2).map(nativeCountryName).filter(Boolean)
 check(new Set(countries).size<=1,'conflicting explicit workplace countries')
 const panIndia=/^Pan India(?:\s+Location)?\b/i.test(location)
 const country=panIndia?'India':parts.at(-1).length>2?nativeLocationCountryName(location):null
 const city=panIndia||/[;&|]|\s+and\s+/i.test(location)||country&&nativeCountryName(location)===country?null:parts[0]
 return{location,city,country,evidence:declared}
}
export const readHostBooksRoles=html=>{
 const rows=readHostBooksOpeningRows(html),raw=document(html),nodes=all(raw.root),program=activeScripts(html).join('\n')
 const legacy=[...html.matchAll(/<h5[^>]*>\s*([^<]+?)\s*<\/h5>([\s\S]*?)(?=<h5[^>]*>|<h3[^>]*>\s*Submit Your Resume|$)/gi)]
 return rows.map(row=>{
  let body=null
  if(row.nativeRoleId){
   const modal=nodes.filter(n=>n.attrs.id==='currentOpening-modal')
   check(modal.length===1,'missing/ambiguous native detail modal')
   const blocks=all(modal[0]).filter(n=>raw.hasClass(n,'opening-'+row.nativeRoleId))
   check(blocks.length===1,'missing/ambiguous exact role detail block')
   check(program.includes(".on('show.bs.modal'")&&new RegExp('recipient\\s*==\\s*["\']'+row.nativeRoleId+'["\']').test(program)
    &&program.includes(".opening-"+row.nativeRoleId+"').removeClass('d-none')"),'native detail activation binding changed')
   const declared=document(raw.outer(blocks[0])),headers=declared.nodes(n=>n.tag==='h5'),details=declared.nodes(n=>declared.hasClass(n,'currentDiscription'))
   check(headers.length===1&&declared.text(headers[0])===row.title&&details.length===1,'opening/detail title binding conflict')
   body=declared.inner(details[0])
  }else{
   const matches=legacy.filter(m=>norm(m[1])===row.title)
   check(matches.length<=1,'ambiguous legacy role detail title')
   body=matches[0]?.[2]||null
  }
  const geo=body?geography(body):{location:null,city:null,country:null,evidence:[]},doc=body?visible(body):null
  const description=doc?doc.text(doc.nodes(n=>n.tag==='root')[0])||null:null
  const label=name=>body?labeledValues(body,[name])[0]?.value||null:null
  return{title:row.title,company:'HostBooks',department:label('Division/Department'),location:geo.location,city:geo.city,country:geo.country,
   jobId:slug(row.title),requisitionId:null,nativeRoleId:row.nativeRoleId,sourceUrl:CAREERS+(row.nativeTarget||''),applyUrl:CAREERS,
   employmentType:null,experienceRequired:label('Experience')||row.experienceRequired,minimumQualification:null,preferredQualification:null,requiredSkills:[],
   postingDate:row.postingDate,closingDate:null,jobDescription:description,sourceDescription:description,
   sourceDetailComplete:Boolean(description),sourceDetailStatus:description?'complete':'partial',sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
   nativePostingDateRaw:row.nativeDateRaw,nativeLocationEvidence:geo.evidence,nativeRoleDescriptionHTML:body,
   nativeDescriptionVisibilityQualified:false}
 })
}
