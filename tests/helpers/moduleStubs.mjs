import {registerHooks} from 'node:module';

export function stubModules(sources){
  return registerHooks({resolve(specifier,context,next){
    const resolved=next(specifier,context);
    for(const [suffix,source] of sources){
      if(resolved.url.endsWith(suffix))return {url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true};
    }
    return resolved;
  }});
}
export const stubCss=()=>stubModules([['.css','export default {}']]);
