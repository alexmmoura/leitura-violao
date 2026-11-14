// Servidor local do app pronto (pasta dist/), sem dependências: só precisa do Node.
// Usado pelo Iniciar.cmd. Escuta apenas em 127.0.0.1 (nada é exposto na rede).
//
// A porta é fixa (4173) de propósito: o navegador guarda o progresso por endereço,
// então mudar a porta "esconderia" os dados já salvos.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const PORT = Number(process.env.PORT) || 4173;
const URL_APP = `http://localhost:${PORT}/`;
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const NO_BROWSER = process.argv.includes('--no-browser');
// --rede: aceita conexões de outros aparelhos da MESMA rede Wi-Fi (para abrir no celular).
// Só use em casa: qualquer aparelho da rede consegue abrir o app enquanto a janela estiver aberta.
const LAN = process.argv.includes('--rede');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

function openBrowser() {
  if (NO_BROWSER) return;
  if (process.platform === 'win32') exec(`start "" "${URL_APP}"`);
  else if (process.platform === 'darwin') exec(`open "${URL_APP}"`);
  else exec(`xdg-open "${URL_APP}"`);
}

async function fileFor(pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const full = normalize(join(ROOT, rel));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null; // fora da pasta
  try {
    const s = await stat(full);
    if (s.isFile()) return full;
    if (s.isDirectory()) {
      const idx = join(full, 'index.html');
      if ((await stat(idx)).isFile()) return idx;
    }
  } catch {
    /* não existe */
  }
  return null;
}

async function handle(req, res) {
  try {
    const { pathname } = new URL(req.url ?? '/', URL_APP);
    let file = await fileFor(pathname);
    // app de página única: rotas sem extensão caem no index.html
    if (!file && !extname(pathname)) file = join(ROOT, 'index.html');
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Não encontrado');
    }
    const body = await readFile(file);
    const name = file.slice(ROOT.length + 1).replaceAll('\\', '/');
    const headers = { 'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' };
    // arquivos com hash no nome nunca mudam; o resto (index, sw) é sempre revalidado
    headers['Cache-Control'] = name.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(e));
  }
}

// "localhost" pode resolver para IPv4 ou IPv6 conforme o computador: escuta nos dois,
// sempre só na própria máquina.
const server = createServer(handle);
const server6 = createServer(handle);
server6.on('error', () => undefined); // IPv6 desativado: segue só com IPv4

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    // provavelmente o app já está aberto em outra janela: só abre o navegador
    console.log(`O app já está rodando em ${URL_APP} — abrindo o navegador.`);
    openBrowser();
    setTimeout(() => process.exit(0), 500);
  } else {
    console.error('Erro ao iniciar o servidor:', e.message);
    process.exit(1);
  }
});

server.listen(PORT, LAN ? '0.0.0.0' : '127.0.0.1', () => {
  if (!LAN) server6.listen(PORT, '::1');
  if (LAN) {
    const ips = Object.values(networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => n.address);
    console.log('');
    console.log('MODO CELULAR (rede Wi-Fi de casa). No celular, na mesma rede, abra no Chrome:');
    for (const ip of ips) console.log('   http://' + ip + ':' + PORT);
    console.log('Neste modo o microfone e o uso sem internet NAO funcionam no celular (exigem https).');
    console.log('');
  }
  console.log(`Leitura no Violão rodando em ${URL_APP}`);
  console.log('Pode minimizar esta janela. Para encerrar o app, feche-a.');
  openBrowser();
});
