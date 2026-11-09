import {createHash} from 'node:crypto'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

const clean=v=>String(v??'').replace(/\s+/g,' ').trim(),hasClass=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)
const walk=(n,p)=>[...(p(n)?[n]:[]),...n.children.filter(c=>typeof c!=='string').flatMap(c=>walk(c,p))]
const one=(a,label)=>{if(a.length!==1)throw Error('Media.net one '+label+' required');return a[0]}
const tree=n=>typeof n==='string'?n:{tag:n.tag,attrs:{...n.attrs},children:n.children.map(tree),...(n.raw===undefined?{}:{raw:n.raw})}
const flow=n=>typeof n==='string'?decodeNativeEntities(n):n.tag==='br'?'\n':(/^(?:root|p|div|li|ul|ol|main|h[1-6])$/.test(n.tag)?'\n':'')+n.children.map(flow).join(' ')+(/^(?:root|p|div|li|ul|ol|main|h[1-6])$/.test(n.tag)?'\n':'')
export const nativeMediaText=html=>{const d=readNativeDocument(String(html));return d.text(one(d.nodes(n=>n.tag==='root'),'native text root'))}
export function nativeMediaRole(html){
 if(typeof html!=='string'||Buffer.byteLength(html)>4000000)throw Error('Media.net bounded native role HTML required')
 const d=readNativeDocument(String(html)),root=one(d.nodes(n=>n.tag==='root'),'native document root'),rawBodies=walk(root,n=>hasClass(n,'post-body'))
 const body=rawBodies.length?one(d.nodes(n=>hasClass(n,'post-body')),'active whole native role body'):one(d.nodes(n=>n.tag==='main'),'unqualified legacy role main')
 if(rawBodies.length!==0&&rawBodies.length!==1)throw Error('Media.net ambiguous native role containers')
 const readableTags=new Set(['main','section','div','h1','h2','h3','h4','h5','h6','p','strong','br','b','span','ul','ol','li','u','i','em','a','hr','blockquote','sup','sub','dl','dt','dd','table','thead','tbody','tfoot','tr','th','td','caption','s','small','meta'])
 if(walk(body,n=>!readableTags.has(n.tag)).length)throw Error('Media.net unreviewed application/delegated content in role container')
 const visible=readVisibleNativeDocument(String(html),{strict:true}),visibleBody=rawBodies.length?one(visible.nodes(n=>hasClass(n,'post-body')),'visible native role body'):one(visible.nodes(n=>n.tag==='main'),'visible unqualified role main')
 const unhidden=n=>typeof n==='string'?decodeNativeEntities(n):n.children.map(unhidden).join(' '),text=d.text(body)
 if(!text||clean(unhidden(body))!==text||visible.text(visibleBody)!==text)throw Error('Media.net hidden or unreadable native role content')
 const headings=d.nodes(n=>n.attrs.id==='jobProfile'),heading=headings.length?one(headings,'native job heading'):one(d.nodes(n=>/^h[1-6]$/.test(n.tag),body).slice(0,1),'unqualified role heading'),title=d.text(heading)
 const lines=flow(body).split('\n').map(clean).filter(Boolean),field=label=>{const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),matches=lines.map(line=>new RegExp('^'+escaped+'\\s*:\\s*(.*)$','i').exec(line)).filter(Boolean);if(matches.length>1)throw Error('Media.net duplicate native '+label+' fields');return matches[0]?.[1]||null}
 const location=field('Location'),countryField=field('Country'),countries=new Set(),countryMetadata=[]
 const countryKey=value=>['country','addresscountry','countryname','workcountry','jobcountry','joblocationcountry'].includes(String(value).toLowerCase().replace(/^.*[/#:]/,'').replace(/^data-/,'').replace(/[-_:]/g,''))
 for(const node of walk(body,()=>true)){
  for(const [key,value]of Object.entries(node.attrs))if(countryKey(key))countryMetadata.push({tag:node.tag,attribute:key,value})
  if(['itemprop','property','name'].some(key=>String(node.attrs[key]||'').split(/\s+/).some(countryKey)))countryMetadata.push({tag:node.tag,attribute:'typed-country',value:node.attrs.content??node.attrs.value??d.text(node)})
 }
 let unknownCountryField=false
 for(const value of [countryField,...countryMetadata.map(item=>item.value)].filter(value=>value!==null)){
  const name=nativeCountryName(clean(value));if(name)countries.add(name);else unknownCountryField=true
 }
 const words=String(location||'').match(/[A-Za-z]+/g)||[]
 for(let i=0;i<words.length;i++)for(let n=1;n<=5&&i+n<=words.length;n++){const phrase=words.slice(i,i+n).join(' ');if(phrase.length<4&&!/^(?:US|USA|UK|UAE)$/.test(phrase))continue;const name=nativeCountryName(phrase);if(name)countries.add(name)}
 const country=!unknownCountryField&&countries.size===1?[...countries][0]:null,mode=field('Work mode')||field('Workplace type')||field('Remote status')||location||''
 const remoteStatus=/\b(?:not|no|non)[\s-]+(?:remote|hybrid)\b/i.test(mode)?null:/\bhybrid\b/i.test(mode)?'Hybrid':/\bremote\b/i.test(mode)?'Remote':/\bon[ -]?site\b/i.test(mode)?'On-site':null
 return{title,location,city:field('City'),country,remoteStatus,employmentType:field('Employment Type'),minimumQualification:field('Minimum Qualification'),preferredQualification:field('Preferred Qualification'),description:text,requirementItems:d.nodes(n=>n.tag==='li',body).map(n=>d.text(n)),record:{heading:tree(heading),body:tree(body),rawRolePage:String(html),rawRolePageSHA256:createHash('sha256').update(String(html)).digest('hex'),nativeLocationLabel:location,nativeCountryLabel:countryField,nativeCountryMetadata:countryMetadata,countryFromLiteralPublishedLabelsOnly:true,cityDictionaryUsed:false,applicationControlsExcluded:true},countryUnresolved:country===null}
}
