"""Offline-only adapter preparation. Never imports SSH or invokes deployment commands."""
import argparse
import ast
import json
import os
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--skill-root', default=str(Path.home()/'.codex/skills/uper-server-deploy'))
parser.add_argument('--output', default='.local-backups/company-trial-20261014/tool')
args = parser.parse_args()
root = Path.cwd().resolve()
out = (root/args.output).resolve()
if not out.is_relative_to(root/'.local-backups'):
    raise SystemExit('Output must be inside the ignored local-backups directory')
standard = Path(args.skill_root).resolve()/'scripts/uper.py'
source = standard.read_text()
old = '    if m["_web_domain"] == m["_api_domain"]:\n'
new = '    if m["_web_domain"] == m["_api_domain"] and not (m["app"] == "home" and not m.get("frontend") and m["_api_domain"] == "home.prototype.uperedu.com"):\n'
if source.count(old) != 1 or source.count('def proxy_body(upstream, origins):') != 1:
    raise SystemExit('Deployment tool changed; review the adapter before preparing it')
source = source.replace(old, new)
source = source.replace('def proxy_body(upstream, origins):','def standard_proxy_body(upstream, origins):')
# The approved combined deployment serves compiled frontend and API in one container.
template = (root/'cloud/company-trial/nginx.conf.template').read_text()
body = template.split('  # REQUIRED:',1)[1].rsplit('\n}',1)[0]
body = '  # REQUIRED:'+body
extra = '''
_standard_http_only_conf = http_only_conf
def http_only_conf(domain, header, body):
    # While obtaining a certificate, never forward plaintext login/API requests as HTTPS.
    if domain == "home.prototype.uperedu.com":
        body = "    location / { return 301 https://home.prototype.uperedu.com$request_uri; }\\n"
    return _standard_http_only_conf(domain, header, body)

def proxy_body(upstream, origins):
    if upstream != "home-api:8080":
        return standard_proxy_body(upstream, origins)
    return COMPANY_PROXY_BODY

_standard_verify = verify
def verify(r, domain, path="/"):
    code = _standard_verify(r, domain, path)
    # The base tool accepts 401/403 as reachable; company trial must pass actual health.
    if domain == "home.prototype.uperedu.com" and path == "/api/health" and code != "200":
        return "503"
    return code

'''
main = 'if __name__ == "__main__":'
if source.count(main)!=1:
    raise SystemExit('Deployment tool entry changed; manual review required')
source = source.replace(main,'COMPANY_PROXY_BODY = '+repr(body)+'\n'+extra+main)
# Resolve the existing skill helper only when an operator later runs the generated tool.
# No credentials or SSH helper are copied into the repository or package.
marker='import '
pos=source.find('import ')
source=source[:pos]+'import sys\nsys.path.insert(0, '+repr(str(standard.parent))+')\n'+source[pos:]
ast.parse(source)
out.mkdir(parents=True,exist_ok=True);os.chmod(out,0o700)
prepared=out/'uper.py';prepared.write_text(source);os.chmod(prepared,0o600)
manifest={'app':'home','backend':{'domain':'home.prototype.uperedu.com','root':os.path.relpath(root/'.local-backups/company-trial-20261014/package',out),'include':['Dockerfile','runtime/**','web/**','package.json','package-lock.json'],'port':8080,'health':'/api/health','memory':'512m','cors':False}}
(out/'uper.json').write_text(json.dumps(manifest,indent=2)+'\n');os.chmod(out/'uper.json',0o600)
# Validate the patched pure functions without importing the deployment tool or its SSH module.
namespace={'os':__import__('os'),'json':json,'BASE_DOMAIN':'prototype.uperedu.com','check_name':lambda name: None,'die':lambda message: (_ for _ in ()).throw(ValueError(message)),'standard_proxy_body':lambda *_:'standard','COMPANY_PROXY_BODY':body,'_standard_verify':lambda *_:'403','_standard_http_only_conf':lambda domain,header,body:body}
selected=[node for node in ast.parse(source).body if isinstance(node,ast.FunctionDef) and node.name in ('load_manifest','proxy_body','verify','http_only_conf')]
exec(compile(ast.Module(body=selected,type_ignores=[]),'<offline adapter validation>','exec'),namespace)
checked=namespace['load_manifest'](str(out/'uper.json'))
assert checked['_api_domain']=='home.prototype.uperedu.com' and not checked.get('frontend')
assert 'deny all;' in namespace['proxy_body']('home-api:8080',[])
assert '$proxy_add_x_forwarded_for' not in namespace['proxy_body']('home-api:8080',[])
assert 'return 301 https://' in namespace['http_only_conf']('home.prototype.uperedu.com','','unsafe plaintext proxy')
assert namespace['verify'](None,'home.prototype.uperedu.com','/api/health')=='503'
print(json.dumps({'offlineValidation':True,'prepared':True,'networkCalls':0,'deployed':False,'domain':'home.prototype.uperedu.com','defaultAccess':'deny all','tool':str(prepared)}))
