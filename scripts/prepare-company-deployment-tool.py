"""Offline-only adapter preparation. Never imports SSH or invokes deployment commands."""
import argparse
import ast
import json
import os
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--skill-root', default=str(Path.home()/'.codex/skills/uper-server-deploy'))
parser.add_argument('--output', default='.local-backups/company-trial-20261014/tool')
access = parser.add_mutually_exclusive_group()
access.add_argument('--controlled-access', action='store_true', help='Use private HTTP Basic authentication instead of deny-all')
access.add_argument('--staff-trial-access', action='store_true', help='Explicitly approved public trial entry; retain application staff authentication')
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
if args.controlled_access:
    body = body.replace('  deny all;', '  # Authenticated company trial; do not distribute credentials to external testers.\n  auth_basic "UPER private company trial";\n  auth_basic_user_file /etc/nginx/conf.d/home-access.htpasswd;')
elif args.staff_trial_access:
    body = body.replace('  deny all;', '  # Public trial entry explicitly approved; staff APIs retain application authentication.')
    body = body.replace('  # REQUIRED: replace with approved VPN/private testing ranges. Default must remain deny-all.\n  # allow REPLACE_WITH_APPROVED_VPN_CIDR;\n', '')
extra = '''
_StandardRemote = Remote
class Remote(_StandardRemote):
    # The user's environment naming standard overrides only the new home project.
    def read(self, remote):
        return super().read("/opt/project/home/api/.env.test" if remote == "/opt/project/home/api/.env" else remote)
    def put(self, data, remote, mode=None):
        return super().put(data, "/opt/project/home/api/.env.test" if remote == "/opt/project/home/api/.env" else remote, mode)
    def run(self, cmd, **kwargs):
        if cmd.startswith("cd /opt/project/home/api && mkdir -p data &&"):
            cmd = cmd.replace(".env", ".env.test")
        return super().run(cmd, **kwargs)

_standard_compose_yml = compose_yml
def compose_yml(app, ts, memory):
    result = _standard_compose_yml(app, ts, memory)
    return result.replace("env_file: .env", "env_file: .env.test") if app == "home" else result

_standard_pack = pack
def pack(root, files, meta):
    if meta.get("app") == "home":
        meta = {**meta, "environment": "test", "envFile": ".env.test"}
    return _standard_pack(root, files, meta)

_standard_prune = prune
def prune(r, app, kind):
    if app != "home":
        return _standard_prune(r, app, kind)
    # Keep company trial rollback artifacts; never prune images belonging to other projects.
    return

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
    if domain == "home.prototype.uperedu.com" and COMPANY_CONTROLLED_ACCESS:
        # Keep credentials out of command arguments, output and release packages.
        private = json.load(open(os.environ["UPER_TRIAL_ACCESS_FILE"]))
        config = "user = " + json.dumps(private["username"] + ":" + private["password"]) + "\\n"
        _, output = r.run("curl --config - -s -o /dev/null --max-time 20 -w '%{http_code} ssl_verify=%{ssl_verify_result}' --resolve home.prototype.uperedu.com:443:127.0.0.1 'https://home.prototype.uperedu.com" + path + "'", stdin=config, check=False)
        parts = output.strip().split()
        code = parts[0] if parts and "ssl_verify=0" in parts else "503"
        print("    authenticated company health: " + code)
    else:
        code = _standard_verify(r, domain, path)
    # The base tool accepts 401/403 as reachable; company trial must pass actual health.
    if domain == "home.prototype.uperedu.com" and path == "/api/health" and code != "200":
        return "503"
    return code

_standard_cmd_db = cmd_db
def cmd_db(r, a):
    if a.app != "home":
        return _standard_cmd_db(r, a)
    private = json.load(open(os.environ["UPER_TRIAL_SECRET_FILE"]))
    password = private["databasePassword"]
    if not re.fullmatch(r"[A-Za-z0-9_-]{32,}", password):
        die("A generated private database credential is required")
    # Never reset an existing account/schema during a deployment retry.
    command = "docker exec -i mysql sh -c 'MYSQL_PWD=" + chr(34) + "$MYSQL_ROOT_PASSWORD" + chr(34) + " mysql -uroot --batch --skip-column-names'"
    _, schemas = r.run(command, stdin="SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='uper_trial_home';")
    if schemas.strip():
        die("Trial database already exists; review and reuse its private configuration, never reset it")
    sql = "CREATE DATABASE `uper_trial_home` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;" + chr(10)
    transport = "NONE" if private.get("mysqlTlsMode") == "disabled" else "SSL"
    sql += "CREATE USER 'home_trial'@'%' IDENTIFIED BY '" + password + "' REQUIRE " + transport + ";" + chr(10)
    sql += "GRANT ALL PRIVILEGES ON `uper_trial_home`.* TO 'home_trial'@'%';" + chr(10)
    r.run(command, stdin=sql)
    update_env(r, a.app, {"MYSQL_TRIAL_URL": "mysql://home_trial:" + password + "@mysql:3306/uper_trial_home"})
    print("Created isolated uper_trial_home with schema-scoped TLS-required home_trial account; credentials withheld")

'''
main = 'if __name__ == "__main__":'
if source.count(main)!=1:
    raise SystemExit('Deployment tool entry changed; manual review required')
source = source.replace(main,'COMPANY_PROXY_BODY = '+repr(body)+'\nCOMPANY_CONTROLLED_ACCESS = '+repr(args.controlled_access)+'\n'+extra+main)
# Resolve the existing skill helper only when an operator later runs the generated tool.
# No credentials or SSH helper are copied into the repository or package.
marker='import '
pos=source.find('import ')
source=source[:pos]+'import sys\nsys.path.insert(0, '+repr(str(standard.parent))+')\n'+source[pos:]
ast.parse(source)
out.mkdir(parents=True,exist_ok=True);os.chmod(out,0o700)
prepared=out/'uper.py';prepared.write_text(source);os.chmod(prepared,0o600)
manifest={'app':'home','backend':{'domain':'home.prototype.uperedu.com','root':os.path.relpath(root/'build/test',out),'include':['Dockerfile','runtime/**','web/**','package.json','package-lock.json'],'port':8080,'health':'/api/health','memory':'512m','cors':False}}
(out/'uper.json').write_text(json.dumps(manifest,indent=2)+'\n');os.chmod(out/'uper.json',0o600)
# Validate the patched pure functions without importing the deployment tool or its SSH module.
namespace={'os':__import__('os'),'json':json,'BASE_DOMAIN':'prototype.uperedu.com','check_name':lambda name: None,'die':lambda message: (_ for _ in ()).throw(ValueError(message)),'standard_proxy_body':lambda *_:'standard','COMPANY_PROXY_BODY':body,'_standard_verify':lambda *_:'403','_standard_http_only_conf':lambda domain,header,body:body}
selected=[node for node in ast.parse(source).body if isinstance(node,ast.FunctionDef) and node.name in ('load_manifest','proxy_body','verify','http_only_conf')]
exec(compile(ast.Module(body=selected,type_ignores=[]),'<offline adapter validation>','exec'),namespace)
checked=namespace['load_manifest'](str(out/'uper.json'))
assert checked['_api_domain']=='home.prototype.uperedu.com' and not checked.get('frontend')
generated_body = namespace['proxy_body']('home-api:8080',[])
if args.staff_trial_access:
    assert 'Public trial entry explicitly approved' in generated_body
    assert 'deny all;' not in generated_body and 'auth_basic' not in generated_body
else:
    assert ('auth_basic_user_file' if args.controlled_access else 'deny all;') in generated_body
assert '$proxy_add_x_forwarded_for' not in namespace['proxy_body']('home-api:8080',[])
assert 'return 301 https://' in namespace['http_only_conf']('home.prototype.uperedu.com','','unsafe plaintext proxy')
namespace['COMPANY_CONTROLLED_ACCESS']=False
assert namespace['verify'](None,'home.prototype.uperedu.com','/api/health')=='503'
print(json.dumps({'offlineValidation':True,'prepared':True,'networkCalls':0,'deployed':False,'domain':'home.prototype.uperedu.com','defaultAccess':'public trial with application authentication' if args.staff_trial_access else 'private authentication' if args.controlled_access else 'deny all','tool':str(prepared)}))
