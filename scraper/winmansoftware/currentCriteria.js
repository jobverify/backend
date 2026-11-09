import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {WINMAN_SOFTWARE_CATALOG} from './catalog.js'

const cls=(node,name)=>(node.attrs?.class||'').split(/\s+/).includes(name)
const need=(ok,message)=>{if(!ok)throw new Error('Winman current criteria '+message)}
const excluded=new Set(['script','style','template','textarea','noscript','xmp','iframe','object','noembed','noframes'])
const walk=node=>typeof node==='string'||excluded.has(node.tag)?[]:[node,...node.children.flatMap(walk)]
const model=node=>typeof node==='string'?node:{tag:node.tag,attrs:{...node.attrs},...(node.raw!==undefined?{raw:node.raw}:{}),children:node.children.map(model)}
const supported=new Set(['div','section','article','p','br','strong','b','em','i','u','span','a','ul','ol','li','h1','h2','h3','h4','h5','h6','table','thead','tbody','tfoot','tr','td','th','dl','dt','dd','blockquote','hr','sup','sub'])
const everyNode=node=>typeof node==='string'?[]:[node,...node.children.flatMap(everyNode)]
const one=(nodes,label)=>{need(nodes.length===1,'missing or ambiguous '+label);return nodes[0]}

export function readCurrentWinmanCriteria(html,listing){
 const document=readVisibleNativeDocument(String(html??''),{strict:true}),root=one(document.nodes(n=>n.tag==='root'),'document'),all=walk(root)
 const containers=all.filter(n=>cls(n,'job-container'))
 // Reduced legacy detail pages have no whole-role layout. They retain their
 // old summary observations and never acquire whole-criteria qualification.
 if(!containers.length){need(!all.some(n=>cls(n,'job-body')),'unbound role body');return null}
 const container=one(containers.filter(n=>!n.inert),'active role container')
 const own=walk(container),header=one(own.filter(n=>cls(n,'job-header')),'role header'),body=one(own.filter(n=>cls(n,'job-body')),'role body')
 need(!header.inert&&!body.inert,'inactive role header/body')
 const title=one(walk(header).filter(n=>n.tag==='h1'&&cls(n,'job-title')),'role title')
 need(!title.inert&&document.text(title)===listing.title,'role title differs from current listing')
 need(walk(header).filter(n=>cls(n,'job-info')&&!n.inert&&document.text(n)==='Winman Software India LLP').length===1,'employer header differs')
 // Retain every authored field. Unsupported or hidden criteria cannot be
 // silently dropped while describing the remaining summary as complete.
 need(everyNode(body).every(n=>!n.inert&&!n.nativeTagUnqualified&&supported.has(n.tag)),'unsupported or inactive role requirements')
 const fields=walk(body),summary=one(fields.filter(n=>n.tag==='ul'&&cls(n,'job-summary')),'role summary'),qualification=one(fields.filter(n=>n.tag==='p'&&cls(n,'qualification')),'qualification'),marks=one(fields.filter(n=>n.tag==='p'&&cls(n,'marks')),'minimum marks')
 const children=body.children.filter(n=>typeof n!=='string')
 for(const [field,label]of [[summary,'Job Summary'],[qualification,'Qualification'],[marks,'Minimum Marks Throughout']]){
  const previous=children[children.indexOf(field)-1]
  need(previous?.tag==='h2'&&document.text(previous)===label,'native requirement label differs')
 }
 const text=document.text(body),q=document.text(qualification),minimumMarks=document.text(marks)
 need(text&&document.text(summary)&&q&&minimumMarks,'empty role requirements')
 need(fields.some(n=>n.tag==='a'&&n.attrs.href===WINMAN_SOFTWARE_CATALOG.applyUrl&&/^apply\s+now$/i.test(document.text(n))),'own application link differs')
 return{title:document.text(title),text,model:model(body),qualification:q,minimumMarks}
}
