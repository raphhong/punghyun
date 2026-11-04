"""Disposable local synthetic PostgreSQL, no network/volumes/service credentials."""
import concurrent.futures, os, pathlib, subprocess, time, uuid, json
ROOT=pathlib.Path(__file__).resolve().parents[1]
ENV={k:v for k,v in os.environ.items() if k not in ('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH')}
D=['docker','--host=unix:///var/run/docker.sock']; NAME='monthly-probe-'+uuid.uuid4().hex[:10]
IMAGE='postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b'
def docker(*args):return subprocess.run(D+list(args),env=ENV,capture_output=True,text=True,check=True)
def sql(s):
 r=subprocess.run(D+['exec','-i',NAME,'psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres'],input=s,env=ENV,capture_output=True,text=True,timeout=30)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
def reserve(k,t='2026-11-04T12:00:00Z',amount=500000):return sql(f"select monthly_probe.reserve('{k}','bound','{t}',{amount});")
def uid(n):return f'10000000-0000-4000-8000-{n:012}'
B=uid(1);A=uid(2)
def grant(n):
 g,c=uid(100+n),uid(200+n)
 consent=json.dumps(dict(confirmed=True,snapshot='1111111111111111111111111111111111111111111111111111111111111111',actorId=A,customerId=c,expiresAt=4102444800000))
 release=json.dumps(dict(policyVersion=B+':1',scopeHash='2222222222222222222222222222222222222222222222222222222222222222'))
 sql(f"insert into public.customers values('{c}');insert into sales_ai_transmission_grants(id,budget_id,actor_id,customer_id,snapshot,scope_hash,active,expires_at,policy_revision,model,max_output_tokens,max_request_bytes,timeout_ms,release,consent,reserve_microusd) values('{g}','{B}','{A}','{c}','1111111111111111111111111111111111111111111111111111111111111111','2222222222222222222222222222222222222222222222222222222222222222',true,'2099-01-01',1,'mock',1000,16000,30000,'{release}','{consent}',500000);")
 return g,c
def req(n):return f"set role service_role;select sales_ai_reserve('{uid(100+n)}','{A}','{uid(200+n)}','1111111111111111111111111111111111111111111111111111111111111111','2222222222222222222222222222222222222222222222222222222222222222','{uid(300+n)}','binding');"
def check_counters():
 assert sql("select b.reserved_calls=(select count(*) from sales_ai_jobs) and b.reserved_microusd=(select sum(reserved_microusd) from sales_ai_jobs) from sales_ai_budgets b;")=='t'
report={}
try:
 docker('run','-d','--rm','--name',NAME,'--network','none','--memory','512m','--cpus','2','--tmpfs','/var/lib/postgresql/data:rw,size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE)
 for _ in range(120):
  if 'PostgreSQL init process complete; ready for start up.' in docker('logs',NAME).stdout and subprocess.run(D+['exec',NAME,'pg_isready','-U','postgres'],env=ENV,capture_output=True).returncode==0:break
  time.sleep(.1)
 sql("create role service_role;create role anon;create role authenticated;")
 sql((ROOT/'tests/fixtures/shared-budget-observed-rpcs.sql').read_text())
 policy=json.dumps(dict(active=True,expiresAt=4102444800000,model='mock',maxOutputTokens=1000,maxRequestBytes=16000,timeoutMs=30000))
 sql(f"insert into auth.users values('{A}');insert into sales_ai_budgets(id,singleton,allocation_approved,allocation_expires_at,policy_revision,owner_policy,max_calls,max_microusd,reserved_calls,reserved_microusd,allocation_manifest_hash) values('{B}',true,true,'2099-01-01',1,'{policy}',3,1500000,0,0,'{'a'*64}');")
 for n in range(30):grant(n)
 # Actual pre-migration reservation+finish API creates history.
 for n in range(3):
  j=sql(req(n));assert j
  result='null' if n<2 else "'{\"sourceSnapshot\":\"1111111111111111111111111111111111111111111111111111111111111111\",\"mode\":\"live\",\"financialApproval\":false}'::jsonb"
  assert sql(f"set role service_role;select sales_ai_finish('{j}','{A}','{uid(200+n)}','1111111111111111111111111111111111111111111111111111111111111111','2222222222222222222222222222222222222222222222222222222222222222',{result},null);")=='t'
 before=sql("select jsonb_agg(to_jsonb(j) order by id) from sales_ai_jobs j;")
 draft=(ROOT/'supabase/drafts/sales_ai_monthly_reservations.sql').read_text()
 sql(draft)
 assert sql("select jsonb_agg(to_jsonb(j) order by id) from sales_ai_jobs j;")==before
 assert sql(req(3))==''
 assert json.loads(sql('set role service_role;select sales_ai_monthly_usage();'))['mode']=='legacy'
 report['migration_preserves_history_and_disabled_legacy']='PASS'
 sql("update sales_ai_budgets set monthly_enabled=true,monthly_limit_microusd=2000000;")
 with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:r=list(pool.map(lambda n:sql(req(n)),range(3,15)))
 assert sum(bool(v) for v in r)==1,r
 check_counters()
 report['12_connections_last_slot_and_lifetime_counters']='PASS'
 assert sql(req(0))==''
 assert sql("select count(*) from sales_ai_jobs where status='unknown';")=='2'
 report['unknown_preserved_replay_blocked']='PASS'
 # ACL prevents bypass through renamed legacy RPC and public read of budget aggregate.
 assert sql("select has_function_privilege('service_role','sales_ai_reserve_premonthly(uuid,uuid,uuid,text,text,uuid,text)','execute');")=='f'
 assert sql("select has_function_privilege('authenticated','sales_ai_monthly_usage()','execute');")=='f'
 report['legacy_rpc_bypass_and_browser_acl_blocked']='PASS'
 # Check actual migration unchanged first; controlled clock applies to TEST functions only.
 sql("create table test_clock(t timestamptz);insert into test_clock values('2026-11-30 23:59:59+00');create function test_now() returns timestamptz language sql as 'select t from public.test_clock';")
 # Replace only wrapper and monthly usage definitions in isolated test DB, no production clock injection.
 for name in ['sales_ai_reserve(uuid,uuid,uuid,text,text,uuid,text)','sales_ai_monthly_usage()']:
  definition=sql(f"select pg_get_functiondef('{name}'::regprocedure);")
  sql(definition.replace('clock_timestamp()','public.test_now()'))
 sql("update sales_ai_jobs set created_at='2026-11-01';update sales_ai_budgets set monthly_limit_microusd=2500000;")
 cmd=D+['exec','-i',NAME,'psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres']
 lock=subprocess.Popen(cmd,env=ENV,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
 lock.stdin.write("begin;select id from sales_ai_budgets for update;\n\\echo LOCKED\n");lock.stdin.flush()
 while lock.stdout.readline().strip()!='LOCKED':
  if lock.poll() is not None:raise RuntimeError(lock.stderr.read())
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  futures=[pool.submit(sql,req(n)) for n in range(15,19)]
  deadline=time.monotonic()+10
  while int(sql("select count(*) from pg_stat_activity where wait_event_type='Lock';"))<4:
   if time.monotonic()>deadline:raise RuntimeError('lock waiters missing')
   time.sleep(.05)
  sql("update test_clock set t='2026-12-01 00:00:00+00';")
  lock.stdin.write('commit;\n\\q\n');lock.stdin.flush();lock.wait(timeout=10)
  rows=[f.result() for f in futures]
 assert sum(bool(v) for v in rows)==2,rows
 assert sql("select count(*) from sales_ai_jobs where created_at='2026-12-01 00:00:00+00';")=='2'
 assert json.loads(sql('select sales_ai_monthly_usage();'))['usedMicrousd']==2500000
 check_counters()
 report['month_boundary_four_blocked_connections_use_admission_clock']='PASS'
 # Unknown transition retains all occupied capacity; completed prior-month reservations expire only by month.
 running=sql("select id from sales_ai_jobs where status='running' limit 1;")
 assert sql(f"select sales_ai_finish(id,actor_id,customer_id,snapshot,scope_hash,null,null) from sales_ai_jobs where id='{running}';")=='t'
 assert json.loads(sql('select sales_ai_monthly_usage();'))['usedMicrousd']==2500000
 sql('update sales_ai_budgets set monthly_limit_microusd=3000000;')
 counters=sql('select reserved_calls,reserved_microusd,max_calls,max_microusd from sales_ai_budgets;')
 sql('begin;'+req(20)+'rollback;')
 assert sql('select reserved_calls,reserved_microusd,max_calls,max_microusd from sales_ai_budgets;')==counters
 assert sql(req(20))
 check_counters()
 report['failure_unknown_retains_budget_and_transaction_rollback']='PASS'
 try:sql('update sales_ai_budgets set monthly_limit_microusd=200000001;');raise AssertionError('cap raised')
 except RuntimeError:pass
 report['200_dollar_database_cap']='PASS'
 sql('update sales_ai_budgets set monthly_limit_microusd=5000000;')
 before=sql('select reserved_calls,reserved_microusd,max_calls,max_microusd from sales_ai_budgets;')
 assert sql(req(21).replace(A,uid(999)))==''
 assert sql(req(21).replace("'1111111111111111111111111111111111111111111111111111111111111111'","'stale'"))==''
 sql(f"update sales_ai_transmission_grants set active=false where id='{uid(121)}';")
 assert sql(req(21))==''
 assert sql('select reserved_calls,reserved_microusd,max_calls,max_microusd from sales_ai_budgets;')==before
 report['monthly_path_keeps_actor_snapshot_consent_guards']='PASS'
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:duplicates=list(pool.map(lambda _:sql(req(22)),range(8)))
 assert sum(bool(x) for x in duplicates)==1
 check_counters()
 report['eight_duplicate_requests_one_reservation']='PASS'
 before=sql('select reserved_calls,reserved_microusd,max_calls,max_microusd from sales_ai_budgets;')
 try:sql('begin;update sales_ai_budgets set reserved_calls=reserved_calls-1;'+req(23)+'commit;');raise AssertionError('reconciliation bypassed')
 except RuntimeError as e:assert 'budget_reconciliation_required' in str(e)
 assert sql('select reserved_calls,reserved_microusd,max_calls,max_microusd from sales_ai_budgets;')==before
 check_counters()
 report['legacy_rpc_exception_rolls_back_all_changes']='PASS'

 before=sql('select reserved_calls,reserved_microusd from sales_ai_budgets;')
 assert sql(f"set role service_role;select sales_ai_revoke_consent('{uid(124)}','{uid(999)}','{uid(224)}','{'1'*64}','{'2'*64}');")=='f'
 assert sql(f"set role service_role;select sales_ai_revoke_consent('{uid(124)}','{A}','{uid(224)}','{'1'*64}','{'2'*64}');")=='t'
 assert sql(req(24))==''
 assert sql('select reserved_calls,reserved_microusd from sales_ai_budgets;')==before
 assert sql("select has_function_privilege('authenticated','sales_ai_revoke_consent(uuid,uuid,uuid,text,text)','execute');")=='f'
 report['scoped_revoke_no_table_update_or_budget_refund']='PASS'
 print(json.dumps(report,indent=2))
finally:
 subprocess.run(D+['rm','-f',NAME],env=ENV,capture_output=True)
