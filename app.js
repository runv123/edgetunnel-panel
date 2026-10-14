(() => {
  const $ = id => document.getElementById(id);
  const state = { base: '', password: '', connected: false, config: null, cf: null };
  const titles = {overview:'概览',config:'核心配置',cloudflare:'Cloudflare 配置',telegram:'Telegram 通知',ips:'自定义优选 IP',logs:'运行日志',tools:'检测工具'};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const baseUrl = () => state.base.replace(/\/+$/, '');
  function message(id, text, error=false){ const el=$(id); el.textContent=text||''; el.classList.toggle('error',!!error); }
  function setConnected(yes){ state.connected=yes; $('loginView').classList.toggle('hidden',yes); $('appView').classList.toggle('hidden',!yes); $('logoutBtn').classList.toggle('hidden',!yes); $('refreshBtn').classList.toggle('hidden',!yes); $('connectionLabel').textContent=yes?'已连接内核':'尚未连接内核'; document.querySelector('.status-dot').style.background=yes?'#32d583':'#f79009'; }
  async function api(path, opts={}) {
    const headers = new Headers(opts.headers||{}); headers.set('X-Admin-Password',state.password);
    if (opts.body && !(opts.body instanceof FormData) && typeof opts.body==='string' && !headers.has('Content-Type')) headers.set('Content-Type','application/json');
    const response = await fetch(baseUrl()+'/'+path.replace(/^\//,''), { ...opts, headers, mode:'cors', credentials:'omit' });
    const raw = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${raw.slice(0,300)}`);
    if (raw.startsWith('重定向中')) throw new Error('内核仍在使用旧版登录校验，尚未启用独立面板 API 认证桥接。');
    try { return JSON.parse(raw); } catch { return raw; }
  }
  function go(page){ if(!titles[page])return; document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page)); document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); $(''+page+'Page').classList.remove('hidden'); $('pageTitle').textContent=titles[page]; }
  async function connect(){
    const base=$('apiBase').value.trim(), password=$('adminPassword').value;
    if(!/^https:\/\//i.test(base)){message('loginMessage','请填写以 https:// 开头的内核网址。',true);return;}
    if(!password){message('loginMessage','请输入管理员密码。',true);return;}
    state.base=base;state.password=password; $('connectBtn').disabled=true; $('connectBtn').textContent='正在连接…'; message('loginMessage','');
    try { await api('admin/config.json'); setConnected(true); go('overview'); await refreshOverview(); }
    catch(e){setConnected(false);message('loginMessage',friendly(e),true);}
    finally{$('connectBtn').disabled=false;$('connectBtn').textContent='连接内核';}
  }
  function friendly(e){const s=String(e?.message||e); if(s.includes('Failed to fetch')||s.includes('NetworkError'))return '连接失败：请检查内核网址、网络和内核的跨域 API 设置。'; return s;}
  async function loadConfig(){try{const data=await api('admin/config.json');state.config=data;$('configEditor').value=JSON.stringify(data,null,2);message('configMessage','配置读取成功。');}catch(e){message('configMessage',friendly(e),true);}}
  async function saveConfig(){try{const data=JSON.parse($('configEditor').value);await api('admin/config.json',{method:'POST',body:JSON.stringify(data)});state.config=data;message('configMessage','已保存到原内核。');await refreshOverview();}catch(e){message('configMessage',friendly(e),true);}}
  async function loadCf(){try{const data=await api('admin/config.json');const cf=data.CF||{};state.cf=cf;$('cfEditor').value=JSON.stringify({Email:cf.Email||null,GlobalAPIKey:cf.GlobalAPIKey||null,AccountID:cf.AccountID||null,APIToken:cf.APIToken||null,UsageAPI:cf.UsageAPI||null},null,2);message('cfMessage','已读取内核公开的配置字段；若密钥存于独立 KV 中，原接口不会回显密钥。');}catch(e){message('cfMessage',friendly(e),true);}}
  async function saveCf(){try{const data=JSON.parse($('cfEditor').value);await api('admin/cf.json',{method:'POST',body:JSON.stringify(data)});state.cf=data;message('cfMessage','已保存到原内核。');}catch(e){message('cfMessage',friendly(e),true);}}
  async function refreshOverview(){try{const c=await api('admin/config.json');state.config=c;$('statStatus').textContent='在线';$('statUUID').textContent=c.UUID?String(c.UUID).slice(0,8)+'…':'未配置';$('statHost').textContent=c.HOST||'—';try{const logs=await api('admin/log.json');const arr=Array.isArray(logs)?logs:[];$('statLogs').textContent=arr.length;}catch{$('statLogs').textContent='—';}}catch(e){$('statStatus').textContent='连接失败';throw e;}}
  async function loadLogs(){const body=$('logsBody');body.innerHTML='<tr><td colspan="5" class="empty">正在读取…</td></tr>';try{const data=await api('admin/log.json');const rows=Array.isArray(data)?data:[];$('logsSummary').textContent=`共 ${rows.length} 条记录（按内核保存顺序）`;body.innerHTML=rows.slice().reverse().map(x=>`<tr><td>${esc(x.TIME?new Date(x.TIME).toLocaleString():'—')}</td><td>${esc(x.TYPE)}</td><td>${esc(x.IP)}</td><td>${esc(x.CC)}</td><td>${esc((()=>{try{return new URL(x.URL).pathname+new URL(x.URL).search}catch{return x.URL||'—'}})())}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">暂无日志</td></tr>';}catch(e){body.innerHTML=`<tr><td colspan="5" class="empty">${esc(friendly(e))}</td></tr>`;}}
  async function loadIps(){try{$('ipsEditor').value=await api('admin/ADD.txt');message('ipsMessage','读取成功。');}catch(e){message('ipsMessage',friendly(e),true);}}
  async function saveIps(){try{const text=$('ipsEditor').value;await api('admin/ADD.txt',{method:'POST',body:text,headers:{'Content-Type':'text/plain;charset=UTF-8'}});message('ipsMessage','已保存到原内核。');}catch(e){message('ipsMessage',friendly(e),true);}}
  async function loadTg(){message('tgMessage','原内核只提供 Telegram 配置写入接口，不提供读取接口。为避免误称已读取，现有密钥不会自动回显；可直接输入新值覆盖。');}
  async function saveTg(clear=false){try{const data=clear?{init:true}:{BotToken:$('tgBotToken').value.trim(),ChatID:$('tgChatId').value.trim()};if(!clear&&(!data.BotToken||!data.ChatID))throw new Error('请填写 Bot Token 和 Chat ID。');await api('admin/tg.json',{method:'POST',body:JSON.stringify(data)});message('tgMessage',clear?'已清空通知配置。':'已保存通知配置。');if(clear){$('tgBotToken').value='';$('tgChatId').value='';}}catch(e){message('tgMessage',friendly(e),true);}}
  async function resetConfig(){if(!confirm('确定重置原内核配置？建议先备份当前 JSON。'))return;try{const d=await api('admin/init');$('configEditor').value=JSON.stringify(d,null,2);message('configMessage','重置请求已完成。');await refreshOverview();}catch(e){message('configMessage',friendly(e),true);}}
  async function runtime(){try{$('runtimeInfo').textContent=JSON.stringify(await api('admin/cf.json'),null,2);}catch(e){$('runtimeInfo').textContent=friendly(e);}}
  async function checkProxy(){const input=$('proxyInput').value.trim();if(!input){message('proxyMessage','请先填写代理地址。',true);return;}try{let proto='', value=input; const m=input.match(/^(socks5|http|https|turn|sstp):\/\/(.+)$/i); if(m){proto=m[1].toLowerCase();value=m[2];} else {message('proxyMessage','请使用 socks5://、http://、https://、turn:// 或 sstp:// 开头的代理地址。',true);return;} const qs=new URLSearchParams();qs.set(proto,value);const result=await api('admin/check?'+qs.toString());$('proxyResult').textContent=JSON.stringify(result,null,2);message('proxyMessage','检测请求已完成。');}catch(e){message('proxyMessage',friendly(e),true);}}
  async function usage(){const q=new URLSearchParams({Email:$('cfEmail').value,GlobalAPIKey:$('cfGlobalKey').value,AccountID:$('cfAccount').value,APIToken:$('cfApiToken').value});try{$('usageResult').textContent=JSON.stringify(await api('admin/getCloudflareUsage?'+q.toString()),null,2);}catch(e){$('usageResult').textContent=friendly(e);}}
  $('connectBtn').addEventListener('click',connect);$('adminPassword').addEventListener('keydown',e=>{if(e.key==='Enter')connect();});$('apiBase').addEventListener('keydown',e=>{if(e.key==='Enter')connect();});
  document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  $('logoutBtn').addEventListener('click',()=>{state.password='';state.base='';state.connected=false;$('adminPassword').value='';setConnected(false);message('loginMessage','已断开连接。');});$('refreshBtn').addEventListener('click',()=>refreshOverview().catch(e=>alert(friendly(e))));
  $('loadConfigBtn').addEventListener('click',loadConfig);$('saveConfigBtn').addEventListener('click',saveConfig);$('resetConfigBtn').addEventListener('click',resetConfig);$('loadCfBtn').addEventListener('click',loadCf);$('saveCfBtn').addEventListener('click',saveCf);$('loadRuntimeBtn').addEventListener('click',runtime);$('loadLogsBtn').addEventListener('click',loadLogs);$('loadIpsBtn').addEventListener('click',loadIps);$('saveIpsBtn').addEventListener('click',saveIps);$('loadTgBtn').addEventListener('click',loadTg);$('saveTgBtn').addEventListener('click',()=>saveTg(false));$('clearTgBtn').addEventListener('click',()=>{if(confirm('确定清空 Telegram 通知配置？'))saveTg(true);});$('checkProxyBtn').addEventListener('click',checkProxy);$('usageBtn').addEventListener('click',usage);
  setConnected(false);
})();
