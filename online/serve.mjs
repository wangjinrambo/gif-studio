import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,readFile} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist/web-online');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.mp4':'video/mp4','.json':'application/json','.md':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
    const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
    const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep))throw Error('invalid path');
    const s=await stat(file);if(!s.isFile())throw Error('not file');
    const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Length':s.size,'Accept-Ranges':'bytes'};
    let start=0,end=s.size-1,status=200;
    if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m)throw Error('invalid range');start=+m[1];end=m[2]?Math.min(+m[2],end):end;if(start>end){res.writeHead(416);return res.end();}status=206;headers['Content-Range']=`bytes ${start}-${end}/${s.size}`;headers['Content-Length']=end-start+1;}
    res.writeHead(status,headers);if(req.method==='HEAD')return res.end();await pipeline(createReadStream(file,{start,end}),res);
  }catch{if(!res.headersSent)res.writeHead(404);res.end();}
});
server.listen(Number(process.env.PORT||4320),'127.0.0.1',()=>console.log('GIF Studio web preview http://127.0.0.1:'+server.address().port));
