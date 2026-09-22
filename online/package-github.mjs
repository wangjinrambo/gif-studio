import {mkdir, readFile, readdir, stat} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import yazl from 'yazl';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const zipPath=path.join(root,'dist','GIF-Studio-GitHub-Source.zip');
await mkdir(path.dirname(zipPath),{recursive:true});
const zip=new yazl.ZipFile();
const done=pipeline(zip.outputStream,createWriteStream(zipPath));
// Explicit source allowlist keeps user files, desktop binaries and caches out.
for(const file of ['LICENSE','.gitignore','package-lock.json','.github/workflows/pages.yml','packaging/licenses/GPL-2.0.txt']){
  zip.addFile(path.join(root,file),file);
}
for(const dir of ['web','online']){
  for(const name of await readdir(path.join(root,dir))){
    if(!/\.(?:js|mjs|html|css|mp4|md|json|toml|conf)$/.test(name)&&!['_headers','Dockerfile'].includes(name))continue;
    if((await stat(path.join(root,dir,name))).isFile())zip.addFile(path.join(root,dir,name),`${dir}/${name}`);
  }
}
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
pkg.scripts=Object.fromEntries(Object.entries(pkg.scripts).filter(([key])=>['build:web','verify:web','preview:web','build:github'].includes(key)));
zip.addBuffer(Buffer.from(JSON.stringify(pkg,null,2)+'\n'),'package.json');
zip.addBuffer(await readFile(path.join(root,'online','GITHUB-PAGES.md')),'README.md');
zip.end();
await done;
console.log(`GitHub source ZIP: ${zipPath} (${Math.round((await stat(zipPath)).size/1024)} KB)`);
