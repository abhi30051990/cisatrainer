// CISA Trainer - single Render service: serves the app, proxies Claude, and
// syncs progress to Postgres (with localStorage fallback in the browser).
// Secrets (ANTHROPIC_API_KEY, DATABASE_URL) live ONLY in Render env vars.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DB_URL = process.env.DATABASE_URL;

// ---- Postgres ----
let pool = null;
if (DB_URL) {
  pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  pool.query(`CREATE TABLE IF NOT EXISTS users(
    username TEXT PRIMARY KEY,
    pin_hash TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
  )`).then(()=>console.log('DB ready')).catch(e=>console.error('DB init error', e.message));
} else {
  console.warn('No DATABASE_URL set - running without sync (localStorage only).');
}

const hashPin = (u,p) => crypto.createHash('sha256').update(u.toLowerCase()+'::'+p).digest('hex');

const TYPES = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
function serveFile(res, file){
  fs.readFile(file, (err, data) => {
    if (err){ res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'});
    res.end(data);
  });
}
function readBody(req){return new Promise((resolve)=>{let b='';req.on('data',c=>{b+=c;if(b.length>2_000_000)req.destroy();});req.on('end',()=>{try{resolve(JSON.parse(b||'{}'));}catch(e){resolve({});}});});}
function sendJSON(res,code,obj){res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(obj));}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // ---- AI proxy ----
  if (url === '/api/ai' && req.method === 'POST') {
    if (!KEY) return sendJSON(res,500,{error:'Server missing ANTHROPIC_API_KEY'});
    const body = await readBody(req);
    const prompt = body.prompt || '';
    if (!prompt) return sendJSON(res,400,{error:'no prompt'});
    const payload = JSON.stringify({ model: MODEL, max_tokens: 400, messages:[{role:'user',content:prompt}] });
    const api = https.request('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'content-type':'application/json','x-api-key':KEY,'anthropic-version':'2023-06-01','content-length':Buffer.byteLength(payload)}
    }, ar => { let d=''; ar.on('data',x=>d+=x); ar.on('end',()=>{
      try{ const j=JSON.parse(d); const text=(j.content||[]).map(c=>c.text||'').join('\n').trim();
        sendJSON(res,200,{text:text||'(no response)'}); }
      catch(e){ sendJSON(res,502,{error:'bad upstream'}); }
    });});
    api.on('error', e => sendJSON(res,502,{error:e.message}));
    api.write(payload); api.end();
    return;
  }

  // ---- Auth: login-or-create ----
  if (url === '/api/login' && req.method === 'POST') {
    if (!pool) return sendJSON(res,503,{error:'no_db'});
    const {username,pin} = await readBody(req);
    if (!username || !pin || String(pin).length<4) return sendJSON(res,400,{error:'Need username and 4+ digit PIN'});
    const u = String(username).trim().toLowerCase();
    const h = hashPin(u, String(pin));
    try{
      const r = await pool.query('SELECT pin_hash, data FROM users WHERE username=$1',[u]);
      if (r.rows.length===0){
        await pool.query('INSERT INTO users(username,pin_hash,data) VALUES($1,$2,$3)',[u,h,{}]);
        return sendJSON(res,200,{created:true, data:{}});
      }
      if (r.rows[0].pin_hash !== h) return sendJSON(res,401,{error:'Wrong PIN'});
      return sendJSON(res,200,{created:false, data:r.rows[0].data||{}});
    }catch(e){ return sendJSON(res,500,{error:e.message}); }
  }

  // ---- Save progress ----
  if (url === '/api/save' && req.method === 'POST') {
    if (!pool) return sendJSON(res,503,{error:'no_db'});
    const {username,pin,data} = await readBody(req);
    const u = String(username||'').trim().toLowerCase();
    const h = hashPin(u, String(pin||''));
    try{
      const r = await pool.query('SELECT pin_hash FROM users WHERE username=$1',[u]);
      if (r.rows.length===0 || r.rows[0].pin_hash!==h) return sendJSON(res,401,{error:'auth'});
      await pool.query('UPDATE users SET data=$2, updated_at=now() WHERE username=$1',[u,data||{}]);
      return sendJSON(res,200,{ok:true});
    }catch(e){ return sendJSON(res,500,{error:e.message}); }
  }

  // ---- Load progress ----
  if (url === '/api/load' && req.method === 'POST') {
    if (!pool) return sendJSON(res,503,{error:'no_db'});
    const {username,pin} = await readBody(req);
    const u = String(username||'').trim().toLowerCase();
    const h = hashPin(u, String(pin||''));
    try{
      const r = await pool.query('SELECT pin_hash,data FROM users WHERE username=$1',[u]);
      if (r.rows.length===0 || r.rows[0].pin_hash!==h) return sendJSON(res,401,{error:'auth'});
      return sendJSON(res,200,{data:r.rows[0].data||{}});
    }catch(e){ return sendJSON(res,500,{error:e.message}); }
  }

  // ---- static files ----
  let u2 = url; if (u2==='/'||u2==='') u2='/index.html';
  const file = path.join(PUBLIC, path.normalize(u2).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUBLIC)){ res.writeHead(403); return res.end('Forbidden'); }
  serveFile(res, file);
});
server.listen(PORT, () => console.log('CISA Trainer running on ' + PORT));
