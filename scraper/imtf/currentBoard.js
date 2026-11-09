import {readHTML,sha,markdownCode} from './parser.js'
import {decodeHTML} from 'entities'
import {plainHTML} from '../../scraper-support/native-sources/jobPostingData.js'

export const LLM_INDEX='https://apply.workable.com/imtf/llms.txt'
export const BOARD_INDEX='https://apply.workable.com/imtf/jobs.md'
export const ownJSONCode=url=>typeof url==='string'?/^https:\/\/apply\.workable\.com\/api\/v2\/accounts\/imtf\/jobs\/([A-Z0-9]{6,32})$/.exec(url)?.[1]??null:null
const fail=message=>{throw Object.assign(Error(message),{code:'IMTF_NATIVE_BOARD_SHAPE'})}
const requireShape=(ok,message)=>{if(!ok)fail(message)}
const unique=(values,label)=>{requireShape(values.length===1,'Missing/ambiguous native '+label);return values[0]}
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s
const names=new Intl.DisplayNames(['en'],{type:'region'}),countries=new Map()
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=names.of(code);if(name!==code&&code!=='ZZ')countries.set(name.toLowerCase(),{name,code})}
const placement=label=>{
  const m=/^(.+), ([^,()]+)(?: \((Hybrid|Remote)\))?$/.exec(label)
  const country=m&&countries.get(m[2].toLowerCase())
  requireShape(country,'Unresolved native board country')
  return {city:m[1],country:country.name,countryCode:country.code,workplace:m[3]?.toLowerCase()??'on_site'}
}

// Called only after parseRoleHTML established this role's tenant, account and
// canonical identity through the official home -> careers -> role handoff.
export function advertisedIndex(identity){
  const doc=readHTML(identity.rawRoleHTML)
  const links=doc.nodes.filter(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('alternate')&&n.attrs.type==='text/plain'&&n.attrs.title==='LLMs')
  const link=unique(links,'inventory alternate')
  requireShape(!link.ambiguous&&link.attrs.href===LLM_INDEX,'Native inventory alternate tenant mismatch')
  return link.attrs.href
}
function declaredCount(text){
  requireShape(text.startsWith('# IMTF Careers\n\n'),'Native inventory publisher mismatch')
  const n=unique([...text.matchAll(/^- All open roles \(GET `https:\/\/apply\.workable\.com\/imtf\/jobs\.md`\): (\d+) current openings$/gm)],'all-open-roles declaration')[1]
  requireShape(Number(n)>0&&Number(n)<=200,'Unsupported native inventory count')
  return Number(n)
}
function inventory(text,total){
  const lines=text.trimEnd().split('\n')
  requireShape(lines[0]==='# IMTF — All Open Positions'&&/^> Last updated: /.test(lines[2])&&date(lines[2].slice(16)),'Invalid native inventory header')
  requireShape(lines[4]==='| Title | Department | Location | Type | Salary | Posted | Details |'&&lines[5]==='|-------|-----------|----------|------|--------|--------|---------|','Native inventory table changed')
  const footer=lines.findIndex((s,i)=>i>5&&s==='---')
  requireShape(footer>5&&lines.slice(footer).join('\n')==='---\nPowered by [Workable](https://www.workable.com)','Invalid native inventory footer')
  const rows=[],codes=new Set()
  for(const line of lines.slice(6,footer)){
    if(!line.trim())continue
    const cells=line.split('|').slice(1,-1).map(s=>s.trim())
    requireShape(line.startsWith('| ')&&line.endsWith(' |')&&cells.length===7&&cells.every(Boolean),'Malformed native inventory row')
    const url=/^\[View\]\(([^)]+)\)$/.exec(cells[6])?.[1],shortcode=markdownCode(url)
    requireShape(shortcode&&!codes.has(shortcode)&&date(cells[5]),'Invalid/duplicate native inventory identity or date');codes.add(shortcode)
    rows.push({shortcode,markdownURL:url,title:cells[0],department:cells[1],location:cells[2],employment:cells[3],salary:cells[4],posted:cells[5],...placement(cells[2]),rawLine:line})
  }
  requireShape(rows.length===total,'Native inventory count mismatch')
  return rows
}
const signature=rows=>JSON.stringify([...rows].sort((a,b)=>a.shortcode.localeCompare(b.shortcode)))
const compact=value=>decodeHTML(value).normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase()
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value
const criteriaFields=[['description','Description'],['requirements','Requirements'],['benefits','Benefits']]
const ownFields=new Set('id shortcode title remote location locations state isInternal code published type language department accountUid approvalStatus workplace description requirements benefits salary_from salary_to salary_currency_iso_code salary_frequency'.split(' '))
function reconciledCriteria(n,fact,places){
  const declaredCountries=new Set(places.map(p=>p.country)),text=[]
  for(const [key]of criteriaFields){
    requireShape(typeof n[key]==='string'&&plainHTML(n[key]).length>=40,'Missing full native '+key)
    const visible=plainHTML(n[key]),allText=decodeHTML(n[key].replace(/<[^>]*>/g,' '))
    requireShape(compact(visible)===compact(allText),'Unreviewed hidden native '+key+' criteria')
    requireShape(compact(visible)===fact.criteria[key],'Native Markdown/own '+key+' criteria conflict')
    text.push(allText)
  }
  const fullText=text.join('\n')
  requireShape(declaredCountries.has('India')||!/\bIndia\b/iu.test(fullText),'Unreviewed role-owned India reference in full native criteria')
  // Free-text worksite alternatives are not projected into invented locations.
  // They need a separate reviewed placement contract before foreign-only zero.
  requireShape(!/\b(?:based|located)\s+(?:in|at|from)\b|\b(?:work|working)\s+from\b|\boffices?\s+(?:in|at)\b|\b(?:locations?|offices?|worksites?|workplaces?)\s*:\s*\S|\b(?:remote|remotely)\s+(?:from|within|anywhere)\b|\b(?:resident|reside|living|live)\s+(?:in|within)\b|\b(?:role|position|job)\b[^.!?\n]{0,80}\b(?:be|work|performed)\s+(?:in|at|from)\b/i.test(fullText),'Unreviewed role-owned worksite text in full native criteria')
}
function detailCountry(markdown,row){
  const header=/^# ([^\n]+)\n\n> IMTF · ([^\n]+) · ([^\n]+) · Posted (\d{4}-\d{2}-\d{2})\n\n/.exec(markdown)
  requireShape(header&&header[1]===row.title&&header[2]===row.location&&header[3]===row.employment&&header[4]===row.posted,'Native board/detail title, placement, type or date conflict')
  const workplace=unique([...markdown.matchAll(/^\*\*Workplace:\*\* ([^\n]+)$/gm)],'detail workplace')[1]
  const department=unique([...markdown.matchAll(/^\*\*Department:\*\* ([^\n]+)$/gm)],'detail department')[1]
  requireShape(workplace===row.workplace&&department===row.department,'Native board/detail workplace or department conflict')
  const headings=[...markdown.matchAll(/^## (.+)$/gm)].map(m=>m[1])
  requireShape(headings.join('|')==='Description|Requirements|Benefits|Apply','Native detail sections changed')
  const sections=[...markdown.matchAll(/^## (Description|Requirements|Benefits|Apply)\n/gm)],criteria={}
  for(let i=0;i<3;i++){
    const value=markdown.slice(sections[i].index+sections[i][0].length,sections[i+1].index)
    const plain=value.replace(/!?\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\\([\\`*_[\]{}()#+.!-])/g,'$1')
    requireShape(plain.trim().length>=40,'Missing full Markdown '+criteriaFields[i][0])
    criteria[criteriaFields[i][0]]=compact(plain)
  }
  const apply=markdown.slice(markdown.indexOf('## Apply'))
  requireShape(apply.trimEnd()===`## Apply\n\n[Apply at IMTF](https://apply.workable.com/imtf/j/${row.shortcode}/apply)\n\n---\nPowered by [Workable](https://www.workable.com)`,'Native detail application identity mismatch')
  return {shortcode:row.shortcode,country:row.country,markdownSHA256:sha(markdown),criteriaSHA256:sha(JSON.stringify(criteria)),criteria}
}
function ownCountries(raw,row,identity,fact){
  const n=JSON.parse(raw)
  requireShape(n&&n.accountUid===identity.nativeAccountId&&n.shortcode===row.shortcode&&Number.isSafeInteger(n.id)&&n.id>0,'Native own account/post identity mismatch')
  requireShape(Object.keys(n).every(key=>ownFields.has(key)),'Unreviewed native own criteria field')
  if(row.shortcode===identity.nativePublicURLShortcode)requireShape(String(n.id)===identity.nativeNumericJobId,'Native own/HTML numeric identity mismatch')
  requireShape(n.state==='published'&&n.isInternal===false&&n.approvalStatus==='approved','Native own publication eligibility mismatch')
  requireShape(n.title===row.title&&typeof n.published==='string'&&n.published.slice(0,10)===row.posted,'Native own title/publication mismatch')
  requireShape(n.workplace===row.workplace&&({full:'Full-time',part:'Part-time',contract:'Contract',temp:'Temporary',temporary:'Temporary',intern:'Internship',volunteer:'Volunteer',other:'Other'})[n.type]===row.employment,'Native own workplace/employment criteria mismatch')
  requireShape(Array.isArray(n.locations)&&n.locations.length>0,'Native own locations missing')
  const places=n.locations.map(l=>{
    requireShape(l&&l.hidden===false&&typeof l.countryCode==='string'&&/^[A-Z]{2}$/.test(l.countryCode),'Native own hidden/unresolved location')
    const country=names.of(l.countryCode)
    requireShape(country!==l.countryCode&&l.countryCode!=='ZZ'&&(!l.country||countries.get(l.country.toLowerCase())?.code===l.countryCode),'Native own country label/code conflict')
    return {city:l.city??null,country,countryCode:l.countryCode}
  })
  if(n.location!=null)requireShape(n.locations.some(l=>['city','country','countryCode','region'].every(k=>(l[k]??null)===(n.location[k]??null))),'Native own primary/all-location conflict')
  requireShape(places.some(p=>p.countryCode===row.countryCode&&p.city===row.city),'Native own/Markdown primary location conflict')
  reconciledCriteria(n,fact,places)
  return {nativeNumericJobId:n.id,places,signature:sha(JSON.stringify(stable(n)))}
}

export async function verifyCurrentBoard(read,identity,onInventory){
  const llms=advertisedIndex(identity),total=declaredCount(await read(llms,'markdown'))
  const opening=inventory(await read(BOARD_INDEX,'markdown'),total)
  const evidence={surface:BOARD_INDEX,nativeAccountId:identity.nativeAccountId,observedListingCount:total,verifiedForeignRoles:[],observedIndiaRoles:[],complete:false,verifiedAt:null,opening,failures:[]}
  onInventory(evidence)
  const checked=[]
  for(const row of opening){
    try{
      const ownURL=`https://apply.workable.com/api/v2/accounts/imtf/jobs/${row.shortcode}`
      const fact=detailCountry(await read(row.markdownURL,'markdown'),row),own=ownCountries(await read(ownURL,'json'),row,identity,fact)
      const {criteria,...retainedFact}=fact
      if(own.places.some(p=>p.country==='India'))evidence.observedIndiaRoles.push({...retainedFact,...own})
      else evidence.verifiedForeignRoles.push({...retainedFact,...own})
      checked.push({row,ownURL,own,fact})
    }catch(error){evidence.failures.push({shortcode:row.shortcode,message:error.message})}
  }
  try{
    for(const {row,ownURL,own,fact}of checked){
      const closingFact=detailCountry(await read(row.markdownURL,'markdown'),row)
      const closingOwn=ownCountries(await read(ownURL,'json'),row,identity,closingFact)
      requireShape(closingOwn.signature===own.signature&&closingFact.markdownSHA256===fact.markdownSHA256,'Native own/Markdown full criteria changed during collection')
    }
    const closing=inventory(await read(BOARD_INDEX,'markdown'),declaredCount(await read(llms,'markdown')))
    requireShape(signature(opening)===signature(closing),'Native inventory changed during collection')
    evidence.complete=evidence.failures.length===0&&checked.length===total
    evidence.verifiedAt=evidence.complete?new Date().toISOString():null
  }catch(error){evidence.failures.push({message:error.message})}
  return evidence
}
