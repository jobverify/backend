// Literal parser follows the independently reviewed native Phenom grammar.
// Never execute JavaScript taken from an upstream response.
export const incomplete = message => Object.assign(new Error('ECOLAB_INCOMPLETE_SNAPSHOT: '+message), {code:'ECOLAB_INCOMPLETE_SNAPSHOT'})
const decode = value => value.replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
const classicScriptType = attrs => {
  // WHATWG prepare-the-script-element steps 8-13: a present type, including
  // an explicitly empty type, overrides language. Only absent type consults
  // nonempty legacy language; whitespace-only type is not the empty default.
  let type
  if(attrs.has('type')){
    const value=attrs.get('type');if(typeof value!=='string')return false
    type=value===''?'text/javascript':value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g,'')
  }else{
    const language=attrs.get('language');if(language===null)return false
    type=language?'text/'+language:'text/javascript'
  }
  return /^(?:application\/(?:ecmascript|javascript|x-ecmascript|x-javascript)|text\/(?:ecmascript|javascript(?:1\.[0-5])?|jscript|livescript|x-ecmascript|x-javascript))$/i.test(type)
}
const activeElements = html => {
  const scripts=[], links=[], tags=/<!--[\s\S]*?(?:-->|$)|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  const raw=new Set(['script','style','textarea','title','xmp','noscript','noembed','noframes','iframe','plaintext'])
  let templateDepth=0, match
  while((match=tags.exec(html))){
    if(!match[1])continue
    const name=match[1].toLowerCase(),closing=match[0].startsWith('</')
    if(name==='template'){templateDepth=Math.max(0,templateDepth+(closing?-1:1));continue}
    if(closing)continue
    const attrs=new Map()
    for(const a of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)){
      const key=a[1].toLowerCase();attrs.set(key,attrs.has(key)?null:decode(a[2]??a[3]??a[4]??''))
    }
    if(raw.has(name)){
      if(name==='plaintext')break
      const close=new RegExp('</'+name+'\\s*>','gi');close.lastIndex=tags.lastIndex;const end=close.exec(html)
      if(!end)break
      if(name==='script'&&!templateDepth&&!attrs.has('src')&&!attrs.has('nomodule'))scripts.push({type:(attrs.get('type')??(attrs.has('type')?'invalid':'')).trim().toLowerCase(),classic:classicScriptType(attrs),body:html.slice(tags.lastIndex,end.index)})
      tags.lastIndex=close.lastIndex;continue
    }
    if(name==='link'&&!templateDepth)links.push(attrs)
  }
  return {scripts,links}
}
const literalAt = (source,start) => {
  const first=source[start]
  if(first==='{'||first==='['){
    const stack=[];let string=false,escape=false
    for(let i=start;i<source.length;i++){
      const c=source[i]
      if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false}
      else if(c==='"')string=true
      else if(c==='{'||c==='[')stack.push(c)
      else if(c==='}'||c===']'){
        if(stack.pop()!==(c==='}'?'{':'['))throw incomplete('unbalanced native literal')
        if(!stack.length)return {value:JSON.parse(source.slice(start,i+1)),end:i+1}
      }
    }
    throw incomplete('unterminated native JSON model')
  }
  // Non-model native properties include scalar JSON and the observed simple
  // single-quoted pxPageState value. They are consumed, never evaluated.
  const token=/^(?:"(?:\\.|[^"\\\r\n])*"|'(?:\\[^\r\n]|[^'\\\r\n])*'|true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(source.slice(start))?.[0]
  if(!token)throw incomplete('unsupported native literal')
  return {value:first==="'"?null:JSON.parse(token),end:start+token.length}
}
const topLevelModels = body => {
  const masked=body.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\r\n]*|<!--[^\r\n]*/g,v=>v.replace(/[^\r\n]/g,' '))
  if(!/\b(?:var\s+phApp\s*=\s*phApp\s*\|\||phApp\s*\.\s*ddo\s*=)/.test(masked))return {apps:[],ddos:[]}
  const apps=[],ddos=[];let cursor=0
  const skip=()=>{
    while(cursor<body.length){
      const chunk=body.slice(cursor),token=/^(?:[\s;]+|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|<!--[^\r\n]*)/.exec(chunk)?.[0]
      if(!token)break
      cursor+=token.length
    }
  }
  // The advertised bootstrap is a sequence of top-level native literal
  // assignments. Restrict the whole model-bearing script to this grammar;
  // blocks, functions, loops, calls and expressions cannot supply a model.
  while(cursor<body.length){
    skip();if(cursor===body.length)break
    const declaration=/^var\s+phApp\s*=\s*phApp\s*\|\|\s*/.exec(body.slice(cursor))
    const assignment=declaration?null:/^phApp\s*\.\s*([A-Za-z_$][\w$]*)\s*=\s*/.exec(body.slice(cursor))
    if(!declaration&&!assignment)throw incomplete('unsupported native model execution context')
    cursor+=(declaration||assignment)[0].length
    const field=declaration?'app':assignment[1]
    if((field==='app'||field==='ddo')&&body[cursor]!=='{')throw incomplete('native model must be a literal object')
    let parsed;try{parsed=literalAt(body,cursor)}catch{throw incomplete('invalid active native literal')}
    cursor=parsed.end
    const space=/^\s*/.exec(body.slice(cursor))[0];cursor+=space.length
    if(cursor<body.length&&body[cursor]!==';')throw incomplete('native assignment is not a complete top-level statement')
    if(field==='app')apps.push(parsed.value)
    if(field==='ddo')ddos.push(parsed.value)
  }
  return {apps,ddos}
}
const unique = (values,label) => {
  const map=new Map(values.map(x=>[JSON.stringify(x),x]))
  if(map.size>1)throw incomplete('conflicting '+label)
  return map.values().next().value??null
}
export const readNativePage = html => {
  if(typeof html!=='string')throw incomplete('non-HTML response')
  const {scripts,links}=activeElements(html),apps=[],ddos=[],postings=[]
  for(const {type,classic,body} of scripts){
    if(type==='application/ld+json'){
      let parsed;try{parsed=JSON.parse(body)}catch{continue}
      if(parsed?.['@type']==='JobPosting')postings.push(parsed)
      continue
    }
    if(!classic&&type!=='module')continue
    const models=topLevelModels(body);apps.push(...models.apps);ddos.push(...models.ddos)
  }
  const canonicals=links.filter(a=>a.get('rel')?.toLowerCase().split(/\s+/).includes('canonical')).map(a=>a.get('href'))
  if(canonicals.some(x=>typeof x!=='string'))throw incomplete('ambiguous canonical')
  return {app:unique(apps,'app models'),ddo:unique(ddos,'DDO models'),posting:unique(postings,'JobPosting models'),canonical:unique(canonicals,'canonical links')}
}
