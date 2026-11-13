import {decodeNativeEntities,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'

// Literal typography in the acquired native descriptions. Property names alone
// cannot authorize positioning, negative margins or invisible foreground text.
const styles=new Map(Object.entries({
 'font-size':['14px','12pt','10.0pt','11.0pt','15px'],
 'font-family':['arial,helvetica,sans-serif','aptos,sans-serif','calibri,verdana,geneva,sans-serif'],
 'margin-bottom':['11px','12px','13px','1px','3px','5px','4px'],
 'margin-top':['12px','13px','11px','16px','9px','3px'],
 'margin-left':['48px','40px','2px','24px'],'margin-right':['20px'],
 'line-height':['115%','normal','107%','15.0pt','105%','113%'],
 color:['black','#000000'],outline:['0px'],'text-align':['justify','center','start'],
 'tab-stops':['list36.0pt','list.5in','list72.0pt'],'font-weight':['normal','400'],
 'letter-spacing':['-0.2pt','normal'],'list-style-type':['circle'],'text-indent':['0px'],
 '-webkit-text-stroke-width':['0px'],'caret-color':['#000000'],'font-style':['normal','italic'],
 'font-variant-caps':['normal'],'text-transform':['none'],'white-space':['normal'],
 'word-spacing':['0px'],'text-decoration':['none'],
}).map(([key,values])=>[key,new Set(values)]))
const tags=new Set(['root','p','div','span','br','strong','em','b','i','u','ul','ol','li','h1','h2','h3','h4','h5','h6'])
const normalize=value=>String(value??'').replace(/\s+/g,' ').trim()
const raw=node=>typeof node==='string'?decodeNativeEntities(node):typeof node.raw==='string'?decodeNativeEntities(node.raw):node.children.map(raw).join(' ')
function reviewed(node){
 if(typeof node==='string')return true
 if(!tags.has(node.tag)||node.nativeTagUnqualified)return false
 for(const [name,value]of Object.entries(node.attrs)){
  if(name!=='style')return false
  for(const part of value.split(';').filter(value=>value.trim())){
   const colon=part.indexOf(':');if(colon<0)return false
   if(!styles.get(part.slice(0,colon).trim().toLowerCase())?.has(part.slice(colon+1).replace(/\s+/g,'').toLowerCase()))return false
  }
 }
 return node.children.every(reviewed)
}
export function nativeCriterion(value){
 if(typeof value!=='string')return{complete:false,text:''}
 try{
  const doc=readNativeDocument(value),visible=readVisibleNativeDocument(value,{strict:true})
  const root=doc.nodes(node=>node.tag==='root')[0],shown=visible.nodes(node=>node.tag==='root')[0]
  const original=root?normalize(raw(root)):'',rendered=shown?normalize(visible.text(shown)):''
  return{complete:Boolean(root&&shown&&reviewed(root)&&original===normalize(doc.text(root))&&original===rendered),text:rendered}
 }catch{return{complete:false,text:''}}
}
