import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {readElectrifexHtml,descendants,hasClass,norm,text} from './nativeHtml.js'

export const HOMEPAGE_URL='https://www.electrifex.com/'
export const CAREERS_URL='https://talents.electrifex.com/'
export const reviewed=JSON.parse(readFileSync(new URL('./reviewedSurfaces.json',import.meta.url),'utf8'))
export const sha=value=>createHash('sha256').update(value).digest('hex')
const absolute=(value,base=CAREERS_URL)=>{try{return new URL(value,base).href}catch{return null}}
const one=(nodes,label)=>{if(nodes.length!==1)throw Error('ambiguous-or-missing-'+label);return nodes[0]}
const check=(ok,label)=>{if(!ok)throw Error(label)}
const find=(node,predicate)=>descendants(node,predicate)
const valueOf=(node,predicate,label)=>one(find(node,predicate),label)
const sameJSON=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const lineFields=(description,label)=>[...description.matchAll(new RegExp('(?:^|\\n)\\s*(?:'+label+')\\s*:\\s*([^\\n]+)','gi'))].map(m=>norm(m[1]))
export const hasOfficialHomepageSignal=html=>{
  const doc=readElectrifexHtml(html)
  return doc.nodes(n=>n.tag==='title').some(n=>norm(n.raw)==='Electrifex')
    &&doc.nodes(n=>n.tag==='meta'&&n.attrs.name==='description').some(n=>/^Electrifex: Engineering innovative solutions for automotive, embedded, and cloud technologies\./.test(n.attrs.content||''))
    &&doc.nodes(n=>n.attrs.id==='root').length===1
}
export const hasOfficialCareersSignal=html=>{
  const doc=readElectrifexHtml(html)
  return doc.nodes(n=>n.tag==='title').some(n=>norm(n.raw)==='Electrifex | Career | Online Registration | Join Us')
    &&doc.nodes(n=>n.attrs.id==='accordionExample'&&hasClass(n,'accordion')).length===1
    &&doc.nodes(n=>/^h[1-6]$/.test(n.tag)&&norm(text(n))==='Job Openings').length===1
}
const roleFromCard=(card,doc,now)=>{
  check(find(card,n=>n.duplicates.length>0).length===0,'duplicate-role-attributes')
  const button=valueOf(card,n=>n.tag==='button'&&hasClass(n,'accordion-button'),'accordion-button')
  const target=button.attrs['data-bs-target'],id=/^#jobCollapseOne(\d+)$/.exec(target||'')?.[1]
  check(id&&button.attrs['data-bs-toggle']==='collapse'&&button.attrs.type==='button'&&button.attrs['aria-controls']===target.slice(1),'collapse-binding')
  const panel=valueOf(card,n=>n.attrs.id===target.slice(1)&&hasClass(n,'accordion-collapse'),'collapse-panel')
  check(panel.attrs['aria-labelledby']===`headingOne-${id}`&&panel.attrs['data-bs-parent']==='#accordionExample','collapse-owner')
  const heading=valueOf(card,n=>n.attrs.id===`headingOne-${id}`,'heading-owner')
  check(find(heading,n=>n===button).length===1,'heading-button-owner')
  const badge=valueOf(button,n=>n.tag==='span'&&hasClass(n,'badge'),'experience-badge')
  const roleTitle=valueOf(button,n=>n.tag==='h5','role-title')
  const experienceRequired=norm(text(badge)),title=norm(experienceRequired+' '+text(roleTitle))
  check(title.length>10&&/^(?:Fresher|Experienced|Internship)$/.test(experienceRequired),'native-title-or-experience')
  const forms=find(panel,n=>n.tag==='form'),form=one(forms,'application-form')
  const applyUrl=absolute(form.attrs.action)
  check(applyUrl===`${CAREERS_URL}registration_form/${id}`&&(form.attrs.method||'').toLowerCase()==='post','application-form-contract')
  const input=valueOf(form,n=>n.tag==='input'&&n.attrs.name==='job_id','registration-key')
  check(input.attrs.type==='hidden'&&input.attrs.value===id,'registration-key-mismatch')
  check(find(form,n=>n.tag==='input'||n.tag==='select'||n.tag==='textarea').length===1,'unreviewed-application-fields')
  const submit=valueOf(form,n=>n.tag==='button'&&n.attrs.type==='submit','submit-button')
  check(norm(text(submit))==='Apply Now'&&!Object.hasOwn(submit.attrs,'disabled')&&!Object.hasOwn(form.attrs,'disabled'),'application-disabled-or-closed')
  check(!Object.hasOwn(submit.attrs,'form')||Boolean(form.attrs.id)&&submit.attrs.form===form.attrs.id,'submit-form-owner-override')
  check(!Object.hasOwn(submit.attrs,'formaction')||absolute(submit.attrs.formaction)===applyUrl,'submit-action-override')
  check(!Object.hasOwn(submit.attrs,'formmethod')||submit.attrs.formmethod.toLowerCase()==='post','submit-method-override')
  check(!Object.hasOwn(submit.attrs,'formenctype')&&!Object.hasOwn(submit.attrs,'formtarget')&&!Object.hasOwn(submit.attrs,'formnovalidate'),'unreviewed-submit-context-override')
  check(find(card,n=>Object.entries(n.attrs).some(([key,value])=>/(?:country|employer|organization|company|work-location)/i.test(key)||['name','itemprop'].includes(key)&&/(?:country|employer|organization|company|work.?location)/i.test(value))).length===0,'unreviewed-country-or-employer-field')
  const sections={}
  for(const [slug,label]of[['description','Description'],['requirements','Requirements'],['application-process','Application Process']]){
    const tab=valueOf(panel,n=>n.tag==='button'&&n.attrs.id===`${slug}-tab-${id}`,'tab-'+slug)
    const section=valueOf(panel,n=>n.attrs.id===`bordered-justified-${slug}-${id}`,'section-'+slug)
    check(tab.attrs['data-bs-toggle']==='tab'&&tab.attrs['data-bs-target']==='#'+section.attrs.id&&tab.attrs.role==='tab'&&tab.attrs.type==='button'&&norm(text(tab))===label,'tab-target-'+slug)
    check(section.attrs.role==='tabpanel'&&section.attrs['aria-labelledby']===tab.attrs.id&&hasClass(section,'tab-pane'),'tab-owner-'+slug)
    sections[label]=text(section)
    check(sections[label].length>80&&!/^(?:job description|requirements|coming soon|tbd|n\/a|apply now)[.!:\s]*$/i.test(sections[label]),'missing-native-'+slug)
  }
  check(find(panel,n=>hasClass(n,'tab-pane')).length===3,'unknown-role-section')
  const requirements=sections.Requirements,parts=requirements.split(/Good to [Hh]ave\s*:?/i)
  const mustHave=parts[0].replace(/^Skills and Qualifications\s*/i,'').replace(/^Must Have\s*:?\s*/i,'').trim(),goodToHave=parts.slice(1).join('\n').trim()||null
  const jobDescription=Object.entries(sections).map(([label,body])=>`${label}\n${body}`).join('\n\n')
  const rolePanelText=text(panel)
  const dates=lineFields(rolePanelText,'Application deadline|Closing date|Valid through')
  check(dates.length===0,'unreviewed-or-expired-application-deadline')
  check(!/\b(?:applications? (?:are |is )?closed|no longer accepting applications|position (?:is )?(?:closed|filled)|job (?:is )?expired)\b/i.test(rolePanelText),'closed-native-role')
  const employerFields=lineFields(sections.Description+'\n'+sections.Requirements,'Employer|Hiring company|Hiring organization')
  check(employerFields.every(value=>value==='Electrifex'),'conflicting-role-employer')
  const countries=lineFields(sections.Description+'\n'+sections.Requirements,'Work country|Job country|Country|Job location|Work location')
  // No work-country field exists in the reviewed board. A new field is retained
  // for review; office addresses, interviews, campaigns and dropdowns are never evidence.
  check(countries.length===0,'unreviewed-role-work-country-field')
  return {title,company:'Electrifex',jobId:id,jobIdType:'native-registration-id',nativeRegistrationId:id,requisitionId:null,
    location:null,city:null,country:null,countryEvidence:null,sourceUrl:CAREERS_URL,applyUrl,applicationMethod:'POST',
    applicationContextUrl:CAREERS_URL,applicationFields:{job_id:id},applicationSubmitted:false,
    employmentType:null,experienceRequired,minimumQualification:mustHave.split(/\n+/).filter(line=>/degree/i.test(line)).join('\n')||null,
    preferredQualification:goodToHave,requiredSkills:mustHave.split(/\n+/).map(line=>line.replace(/^\s*\*\s*/, '').trim()).filter(Boolean),
    postingDate:null,closingDate:null,remoteStatus:null,descriptionSections:sections,jobDescription,
    nativeApplicationProcess:sections['Application Process'],nativeRequirements:requirements,source:'electrifex',
    link:CAREERS_URL+'#'+panel.attrs.id,applicationTargetKind:'native-registration-post-form',observedAt:now}
}
export const extractNativeInventory=(html,{now=new Date().toISOString(),stylesheets=[],revealBootstrap=false}={})=>{
  const doc=readElectrifexHtml(html,{stylesheets,revealBootstrap}),reasons=[],roles=[],invalidRoles=[]
  const boards=doc.nodes(n=>n.attrs.id==='accordionExample'&&hasClass(n,'accordion'))
  if(!hasOfficialCareersSignal(html))reasons.push('unverified-native-board-identity')
  const board=boards.length===1?boards[0]:null
  const cards=board?find(board,n=>hasClass(n,'accordion-item')):[]
  for(const [index,card]of cards.entries())try{roles.push(roleFromCard(card,doc,now))}catch(error){const id=find(card,n=>n.tag==='form').map(n=>/\/registration_form\/(\d+)$/.exec(n.attrs.action||'')?.[1]).find(Boolean);invalidRoles.push({index,id:id||null,reason:error.message});reasons.push(`invalid-role:${id||index}:${error.message}`)}
  const ids=roles.map(r=>r.jobId)
  if(new Set(ids).size!==ids.length)reasons.push('duplicate-native-registration-identities')
  const uniqueRoles=roles.filter(role=>ids.filter(id=>id===role.jobId).length===1)
  const forms=doc.nodes(n=>n.tag==='form'&&/registration_form/.test(n.attrs.action||''))
  if(forms.length!==cards.length)reasons.push('native-registration-containers-disagree')
  if(!cards.length)reasons.push('no-verified-native-empty-contract')
  const hiddenCards=doc.rawNodes(n=>hasClass(n,'accordion-item')&&!n.inert&&n.hidden)
  if(hiddenCards.length)reasons.push('hidden-native-candidate-containers')
  if(doc.visibility.uncertain.some(node=>doc.rawNodes(candidate=>hasClass(candidate,'accordion-item')&&!candidate.inert).some(card=>{for(let current=card;current;current=current.parent)if(current===node)return true;for(let current=node;current;current=current.parent)if(current===card)return true;return false})))reasons.push('uncertain-native-css-visibility')
  for(const node of doc.executionNodes(n=>['a','button','select','form'].includes(n.tag))){
    const value=(node.attrs.href||node.attrs.action||'')+' '+norm(text(node))
    if(node.tag==='a'&&node.attrs.href){
      const href=node.attrs.href
      if(!['https://www.electrifex.com','https://www.electrifex.com/','javascript:void(0)'].includes(href))reasons.push('unreviewed-hiring-link-or-pagination:'+href)
    }
    if(/page|next|previous|load.?more|total|filter|country|employer|company/i.test(value+' '+Object.entries(node.attrs).flat().join(' '))&&!(node.tag==='button'&&/application-process/.test(node.attrs.id||'')))reasons.push('unreviewed-inventory-control')
  }
  const counterText=doc.nodes(n=>['p','span','div'].includes(n.tag)&&/^(?:total(?:\s+(?:jobs?|openings?|positions?))?|(?:jobs?|openings?|positions?)\s+total)\s*[:(]?\s*\d+\)?$/i.test(norm(text(n))))
  if(counterText.length)reasons.push('unreviewed-native-inventory-counter')
  if(doc.rawNodes(n=>['iframe','object','embed'].includes(n.tag)&&!n.parent?.inert).length)reasons.push('unreviewed-native-frame')
  if(doc.executionNodes(n=>n.tag==='base').length)reasons.push('unreviewed-base-url')
  const scripts=doc.executionNodes(n=>n.tag==='script'&&(!n.attrs.type||/^(?:module|text\/(?:java|ecma)script|application\/(?:java|ecma)script)$/i.test(n.attrs.type)))
  if(scripts.some(node=>node.duplicates.length||!sameJSON(Object.keys(node.attrs).sort(),node.attrs.src?['src']:[])))reasons.push('unreviewed-executable-client-attributes')
  for(const node of doc.executionNodes(()=>true))for(const [attribute,value]of Object.entries(node.attrs)){
    if(!/^on/i.test(attribute))continue
    const match=/^getAvailableTimeSlots\((\d+)\)$/.exec(value)
    if(attribute!=='onclick'||node.tag!=='a'||node.attrs.href!=='javascript:void(0)'||node.attrs['data-bs-target']!=='#verticalycentered'||!match||!doc.rawNodes(candidate=>!candidate.inert&&candidate.tag==='form'&&candidate.attrs.action===`/registration_form/${match[1]}`).length)reasons.push('unreviewed-executable-client-handler')
  }
  const clients=scripts.filter(n=>n.attrs.src).map(n=>absolute(n.attrs.src))
  const inline=scripts.filter(n=>!n.attrs.src).map(n=>sha(n.raw||''))
  const expectedClients=reviewed.assets.filter(r=>r.url.startsWith(CAREERS_URL)&&r.url.endsWith('.js')).map(r=>r.url)
  if(!sameJSON(clients,expectedClients)||!sameJSON(inline,reviewed.inlineScripts))reasons.push('unreviewed-executable-client-contract')
  const styles=doc.executionNodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet').map(n=>absolute(n.attrs.href))
  if(doc.executionNodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet').some(node=>node.duplicates.length||!sameJSON(Object.keys(node.attrs).sort(),['href','rel'])))reasons.push('unreviewed-stylesheet-attributes')
  const expectedStyles=reviewed.assets.filter(r=>!r.url.startsWith(HOMEPAGE_URL)&&!r.url.endsWith('.js')).map(r=>r.url)
  if(!sameJSON([...styles].sort(),[...expectedStyles].sort()))reasons.push('unreviewed-stylesheet-contract')
  const inlineStyles=doc.executionNodes(n=>n.tag==='style').map(n=>sha(n.raw||''))
  if(!sameJSON(inlineStyles,reviewed.inlineStyles))reasons.push('unreviewed-inline-style-contract')
  return {roles:uniqueRoles,candidateRecords:cards.length+hiddenCards.length,visibleCandidateRecords:cards.length,invalidRoles,reasons:[...new Set(reasons)],clients,styles,inlineScripts:inline,
    pagination:{kind:'reviewed-single-server-rendered-accordion',advertisedTotal:null,observedContainers:cards.length,hasNextPageContract:false},
    nativeIdentityVerified:hasOfficialCareersSignal(html)}
}
export const extractJobs=(html,options)=>extractNativeInventory(html,options).roles
