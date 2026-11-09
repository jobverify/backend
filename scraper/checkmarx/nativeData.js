import {readNativeDocument} from './nativeHtml.js'
const check=(ok,message)=>{if(!ok)throw Error('Checkmarx native data: '+message)}

function strictJSON(text){
  const frames=[]
  for(let i=0;i<text.length;i++){
    const c=text[i]
    if(c==='"'){
      const start=i
      for(i++;i<text.length;i++){if(text[i]==='\\')i++;else if(text[i]==='"')break}
      let after=i+1;while(after<text.length&&/\s/.test(text[after]))after++
      if(text[after]===':'&&frames.at(-1)?.object){
        const key=JSON.parse(text.slice(start,i+1)),frame=frames.at(-1)
        check(!frame.keys.has(key),'Duplicate native JSON field');frame.keys.add(key)
      }
    }else if(c==='{'||c==='[')frames.push({object:c==='{',keys:new Set()})
    else if(c==='}'||c===']')frames.pop()
  }
  return JSON.parse(text)
}
function readLiteral(text,start){
  const opening=text[start],closing=opening==='{'?'}':']'
  let depth=0,quoted=false,escaped=false
  for(let i=start;i<text.length;i++){
    const c=text[i]
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false}
    else if(c==='"')quoted=true
    else if(c===opening)depth++
    else if(c===closing&&--depth===0)return{value:strictJSON(text.slice(start,i+1)),end:i+1}
  }
  throw Error('Checkmarx native data: Truncated native JSON literal')
}

// Scan lexical boundaries; never evaluate public JavaScript. Quoted text,
// comments, templates and function-local assignments are not native preloads.
function assignments(text,key){
  const found=[];let depth=0,round=0,square=0,boundary=0
  for(let i=0;i<text.length;i++){
    const c=text[i]
    if(c==='/'&&text[i+1]==='/'){i=text.indexOf('\n',i+2);if(i<0)break;continue}
    if(c==='/'&&text[i+1]==='*'){const end=text.indexOf('*/',i+2);check(end>=0,'Truncated script comment');i=end+1;continue}
    if(c==='"'||c==="'"||c.charCodeAt(0)===96){let closed=false;for(let j=i+1;j<text.length;j++){if(text[j]==='\\')j++;else if(text[j]===c){i=j;closed=true;break}}check(closed,'Truncated script string');continue}
    if(c==='{')depth++
    else if(c==='}')depth--
    else if(c==='(')round++
    else if(c===')')round--
    else if(c==='[')square++
    else if(c===']')square--
    else if(c===';'&&depth===0&&round===0&&square===0)boundary=i+1
    if(depth!==0||round!==0||square!==0||!/[A-Za-z_$]/.test(c))continue
    const start=i,match=text.slice(i).match(/^[A-Za-z_$][\w$]*/)[0];i+=match.length-1
    if(match!==key)continue
    // Only an unconditional top-level assignment/declaration can preload data.
    // A JSON literal after if(false), &&, ?:, loops or other expressions is
    // never executed here and therefore cannot establish current public data.
    const prefix=text.slice(boundary,start).replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,'').trim()
    if(prefix!==''&&!/^(?:var|let|const)$/.test(prefix))continue
    let before=start-1;while(before>=0&&/\s/.test(text[before]))before--
    if(text[before]==='.')continue
    let at=i+1;while(at<text.length&&/\s/.test(text[at]))at++
    if(text[at]!=='='||text[at+1]==='=')continue
    at++;while(at<text.length&&/\s/.test(text[at]))at++
    check(text[at]==='{'||text[at]==='[','Native preload is not a JSON literal')
    const result=readLiteral(text,at);found.push(result.value);i=result.end-1
    check(/^\s*(?:[,;]|$)/.test(text.slice(result.end)),'Native literal expression changed')
  }
  return found
}
export function readNativeData(html,key){
  check(typeof html==='string'&&html.length<=3000000,'Native body invalid or over bound')
  const doc=readNativeDocument(html),scripts=doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&!Object.hasOwn(n.attrs,'nomodule')&&[undefined,'','text/javascript','application/javascript'].includes(n.attrs.type))
  const values=scripts.filter(n=>(n.raw||'').includes(key)).flatMap(n=>assignments(n.raw||'',key))
  check(values.length===1,'Expected one active '+key+' preload')
  return values[0]
}
