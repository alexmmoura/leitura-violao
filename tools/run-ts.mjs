// Executa um script TypeScript do projeto usando o carregador do Vite (mesmas
// resoluções de import do app). Uso: node tools/run-ts.mjs <arquivo.ts> [args...]
import { createServer } from 'vite';

const [file, ...args] = process.argv.slice(2);
if (!file) {
  console.error('uso: node tools/run-ts.mjs <arquivo.ts> [args...]');
  process.exit(1);
}
process.argv = [process.argv[0], file, ...args];
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  await server.ssrLoadModule(`/${file.replace(/\\/g, '/')}`);
} finally {
  await server.close();
}
