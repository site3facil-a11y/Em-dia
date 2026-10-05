import fs from 'fs';
import path from 'path';
import { ZipArchive } from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const distDir = path.join(rootDir, 'dist');
const zipPath = path.join(rootDir, 'dist.zip');

if (!fs.existsSync(distDir)) {
  console.error('Pasta dist não encontrada. Execute "npm run build" antes de gerar o bundle.');
  process.exit(1);
}

const output = fs.createWriteStream(zipPath);
const archive = new ZipArchive({
  zlib: { level: 9 },
});

output.on('close', () => {
  console.log(`✓ dist.zip gerado com sucesso! (${(archive.pointer() / 1024).toFixed(1)} KB)`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Adiciona todo o conteúdo de dist/ na raiz do zip (index.html fica na raiz)
archive.directory(distDir, false);

await archive.finalize();
