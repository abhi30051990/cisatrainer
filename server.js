// CISA Trainer - single Render service: serves the app AND proxies Claude calls.
// Your API key lives ONLY in Render's environment variables, never in any file here.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

const TYPES = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};

function serveFile(res, file){
  fs.readFile(file, (err, data) => {
    if (err){ res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'});
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // ---- API endpoint ----
  if (req.url === '/api/ai' && req.method === 'POST') {
    if (!KEY){ res.writeHead(500); return res.end(JSON.stringify({error:'Server missing ANTHROPIC_API_KEY'})); }
    let body = '';
    req.on('data', c => { body += c; if (body.length > 20000) req.destroy(); });
    req.on('end', () => {
      let prompt = '';
      try { prompt = JSON.parse(body).prompt || ''; } catch(e){}
      if (!prompt){ res.writeHead(400); return res.end(JSON.stringify({error:'no prompt'})); }
      const payload = JSON.stringify({ model: MODEL, max_tokens: 400, messages:[{role:'user',content:prompt}] });
      const api = https.request('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'content-type':'application/json','x-api-key':KEY,'anthropic-version':'2023-06-01','content-length':Buffer.byteLength(payload)}
      }, ar => {
        let d=''; ar.on('data',x=>d+=x); ar.on('end',()=>{
          try{ const j=JSON.parse(d); const text=(j.content||[]).map(c=>c.text||'').join('\n').trim();
            res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify({text:text||'(no response)'})); }
          catch(e){ res.writeHead(502); res.end(JSON.stringify({error:'bad upstream'})); }
        });
      });
      api.on('error', e => { res.writeHead(502); res.end(JSON.stringify({error:e.message})); });
      api.write(payload); api.end();
    });
    return;
  }
  // ---- static files ----
  let url = req.url.split('?')[0];
  if (url === '/' || url === '') url = '/index.html';
  const file = path.join(PUBLIC, path.normalize(url).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUBLIC)){ res.writeHead(403); return res.end('Forbidden'); }
  serveFile(res, file);
});
server.listen(PORT, () => console.log('CISA Trainer running on ' + PORT));
