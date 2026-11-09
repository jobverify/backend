import {readNativeDocument} from '../utils/activeNativeHtml.js'
import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {readVisibleNativeDocument} from '../utils/visibleNativeHtml.js'
import {nativeLines,authoredNativeLines,comparable} from './firstPartyNativeHtml.js'
import {hasSourceDescription} from '../../src/utils/jobSourceContent.js'

const all=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(all)]
const urlAttributes=new Set(['href','xlink:href','src','action','formaction','poster','background','data'])
const executableURL=value=>/^(?:javascript|vbscript|data):/i.test(decodeHTML(value).replace(/[\u0000-\u0020\u007f-\u009f]/g,''))
const unavailableCriteria=/^(?:n\/?a|none|not available|(?:error\s+(?:loading|fetching|retrieving)|(?:unable|failed)\s+to\s+(?:load|fetch|retrieve))\s+(?:the\s+)?(?:job|role|vacancy)\s+(?:details?|description|criteria)[\s\S]*|loading\s+(?:job|role|vacancy)\s+(?:details?|description|criteria)[\s.!]*(?:please\s+wait[\s.!]*)?)$/i
export const currentNativeNodes=all
export function readOwnedCurrentDocument(html,{failure,title,canonical,stylesheetFragment=false,eventPrograms=null}){
 const need=(ok,message)=>{if(!ok)throw failure(message)},one=(rows,label)=>{need(rows.length===1,'Missing or ambiguous '+label);return rows[0]}
 const raw=readNativeDocument(html),root=one(raw.nodes(node=>node.tag==='root'),'native root'),elements=node=>node.children.filter(child=>typeof child!=='string')
 const document=one(elements(root).filter(node=>node.tag==='html'),'owned HTML document')
 const head=one(elements(document).filter(node=>node.tag==='head'),'owned document head'),body=one(elements(document).filter(node=>node.tag==='body'),'owned document body')
 need(!head.inert&&!body.inert,'Owned native document is hidden or inert')
 const nodes=all(root),count=stylesheetFragment?2:1
 need(['html','head','body'].every(tag=>nodes.filter(node=>node.tag===tag).length===count),'Additional native documents require review')
 need(!nodes.some(node=>node.tag==='base'),'Unreviewed native document base')
 if(eventPrograms!==null){
  need(!nodes.some(node=>['iframe','frame','frameset','object','embed'].includes(node.tag)||Object.hasOwn(node.attrs,'srcdoc')||node.tag==='meta'&&(node.attrs['http-equiv']??'').toLowerCase()==='refresh'),'Delegated native document program requires review')
  const observed=nodes.flatMap(node=>Object.entries(node.attrs).filter(([name])=>name.startsWith('on')).map(([attribute,value])=>({tag:node.tag,attribute,valueSHA256:createHash('sha256').update(value).digest('hex'),inert:Boolean(node.inert)})))
  need(JSON.stringify(observed)===JSON.stringify(eventPrograms),'Native event program declarations require review')
 }
 if(stylesheetFragment){
  const fragment=one(elements(head).filter(node=>node.tag==='html'),'reviewed stylesheet fragment'),innerHead=one(elements(fragment).filter(node=>node.tag==='head'),'stylesheet head'),innerBody=one(elements(fragment).filter(node=>node.tag==='body'),'stylesheet body')
  need([fragment,innerHead,innerBody].every(node=>!node.inert&&Object.keys(node.attrs).length===0),'Stylesheet fragment authority changed')
  const charset=one(elements(innerHead),'stylesheet charset'),parts=elements(innerBody)
  need(charset.tag==='meta'&&JSON.stringify(charset.attrs)===JSON.stringify({charset:'UTF-8'}),'Stylesheet identity changed')
  need(parts.length===2&&parts[0].tag==='script'&&parts[0].attrs.type==='text/javascript'&&parts[1].tag==='style','Stylesheet fragment layout changed')
 }
 const titles=nodes.filter(node=>node.tag==='title')
 if(title===null)need(titles.length===0,'Unexpected native document title')
 else {const node=one(titles,'owned native title');need(elements(head).includes(node)&&node.raw?.trim()===title,'Native document title or owner changed')}
 const canonicals=nodes.filter(node=>node.tag==='link'&&(node.attrs.rel??'').toLowerCase().split(/\s+/).includes('canonical'))
 need(canonicals.length<=1&&canonicals.every(node=>elements(head).includes(node)&&node.attrs.href===canonical),'Native canonical declaration or owner changed')
 return {raw,root,document,head,body,nodes}
}
export function readOriginalNativeCriteria(html,failure,{minimumChars=300}={}){
 if(!Number.isSafeInteger(minimumChars)||minimumChars<1||minimumChars>300)throw RangeError('Invalid original criteria minimum')
 if(typeof html!=='string'||Buffer.byteLength(html)>256*1024)throw failure('Missing or excessive original native criteria')
 const raw=readNativeDocument(html),root=raw.nodes(node=>node.tag==='root')[0]
 if(!root||all(root).some(node=>['script','style','iframe','frame','frameset','object','embed','template','noscript','base','meta'].includes(node.tag)||Object.hasOwn(node.attrs,'srcdoc')||Object.entries(node.attrs).some(([key,value])=>key.startsWith('on')||urlAttributes.has(key)&&executableURL(value))))throw failure('Delegated or executable native criteria program requires review')
 const visible=readVisibleNativeDocument(html,{strict:true}),visibleRoot=visible.nodes(node=>node.tag==='root')[0]
 const lines=nativeLines(visibleRoot),text=lines.join('\n'),authored=authoredNativeLines(root).join('\n')
 if(comparable(text)!==comparable(authored))throw failure('Original native criteria are hidden or incomplete')
 const qualificationText=decodeHTML(text).replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,'').trim()
 const complete=qualificationText.length>=minimumChars&&hasSourceDescription({sourceDescription:qualificationText})&&!unavailableCriteria.test(qualificationText)
 return {jobDescription:complete?text:null,sourceDescription:complete?text:null,sourceDescriptionHTML:html,sourceDescriptionLines:lines,
  sourceDetailComplete:complete,sourceDetailFailureKind:complete?null:'native-full-criteria-unavailable',
  sourceCriteriaPresentation:'complete-original-native-record-as-data;rendered-application-activation-unverified'}
}
