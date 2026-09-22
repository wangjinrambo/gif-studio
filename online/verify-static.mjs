import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),site=path.join(root,'dist','web-online');
for(const file of ['index.html','app.js','browser-engine.js','style.css','sample.mp4','vendor/ffmpeg/index.js','vendor/ffmpeg/worker.js','vendor/ffmpeg/classes.js','vendor/core/ffmpeg-core.js','vendor/core/ffmpeg-core.wasm','vercel.json','netlify.toml','_headers','Dockerfile'])assert.ok((await stat(path.join(site,file))).size>0,file);
for(const file of ['app.js','browser-engine.js'])assert.equal(spawnSync(process.execPath,['--check',path.join(site,file)],{windowsHide:true}).status,0,file);
const app=await readFile(path.join(site,'app.js'),'utf8'),engine=await readFile(path.join(site,'browser-engine.js'),'utf8');
assert.ok(!app.includes('new XMLHttpRequest'),'No server upload adapter');
assert.ok(!app.includes('fetch(`/api/'),'No localhost frame API');
assert.ok(!app.includes("?download=1"),'Blob downloads must not have a query string');
assert.ok(app.startsWith("import {api,uploadMedia,frameBlob}"),'Client conversion adapter is wired');
assert.ok(!engine.includes('http://127.0.0.1'),'No local service dependency');
const wasm=await readFile(path.join(site,'vendor/core/ffmpeg-core.wasm'));assert.equal(wasm.readUInt32LE(0),0x6d736100,'WASM magic');
assert.ok(WebAssembly.validate(wasm),'Valid WASM module');
JSON.parse(await readFile(path.join(site,'vercel.json'),'utf8'));
assert.ok((await stat(path.join(site,'.nojekyll'))).isFile(),'Static Pages marker');

// Resolve real resource references under both project Pages and domain roots.
const html=await readFile(path.join(site,'index.html'),'utf8');
const modules=['app.js','browser-engine.js',...(await readdir(path.join(site,'vendor/ffmpeg'))).filter(n=>n.endsWith('.js')).map(n=>'vendor/ffmpeg/'+n)];
for(const prefix of ['/', '/gif-studio/', '/a-different-repository/']){
  const base=new URL(prefix,'https://example.github.io');
  async function check(ref,from=base){
    const url=new URL(ref,from);
    assert.equal(url.origin,base.origin,'Runtime assets must be same-origin: '+ref);
    assert.ok(url.pathname.startsWith(base.pathname),'Asset escaped repository path: '+url);
    const rel=decodeURIComponent(url.pathname.slice(base.pathname.length))||'index.html';
    assert.ok((await stat(path.join(site,rel))).isFile(),'Missing resource: '+url);
  }
  for(const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/g))await check(m[1]);
  for(const file of modules){
    const source=await readFile(path.join(site,file),'utf8'),url=new URL(file,base);
    for(const m of source.matchAll(/\bfrom\s*["']([^"']+)["']/g))await check(m[1],url);
    for(const m of source.matchAll(/new URL\(["']([^"']+)["']\s*,\s*(import\.meta\.url|base)\)/g)){
      if(m[1]!=='.')await check(m[1],m[2]==='base'?base:url);
    }
  }
}
console.log('Static deployment checks passed: assets, JS syntax, client adapter, WASM binary, platform configuration and GitHub Pages repository paths.');
