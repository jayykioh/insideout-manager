import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
await mkdir('public/icons',{recursive:true});
const svg=await readFile('public/icon.svg');
for(const size of [192,512])await sharp(svg).resize(size,size).png().toFile('public/icons/icon-'+size+'.png');
const revision=createHash('sha256').update(svg).digest('hex').slice(0,12);
const manifest=[{url:'/icons/icon-192.png',revision},{url:'/icons/icon-512.png',revision},{url:'/icon.svg',revision},{url:'/manifest.webmanifest',revision}];
await build({entryPoints:['src/service-worker.ts'],outfile:'public/sw.js',bundle:true,minify:true,target:['es2022'],define:{'self.__WB_MANIFEST':JSON.stringify(manifest)},legalComments:'none'});
const info={built_at:new Date().toISOString(),service_worker_bytes:(await readFile('public/sw.js')).byteLength};
await writeFile('public/pwa-build.json',JSON.stringify(info));
console.log('Built Workbox service worker and install icons.',info);

