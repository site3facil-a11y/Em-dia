import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const iconSvgPath = path.join(rootDir, 'public', 'icon.svg');
const assetsDir = path.join(rootDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

async function run() {
  console.log('Gerando assets PNG a partir de', iconSvgPath);

  const svgBuffer = fs.readFileSync(iconSvgPath);

  // 1. assets/icon-only.png (1024x1024)
  const iconOnlyPath = path.join(assetsDir, 'icon-only.png');
  await sharp(svgBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(iconOnlyPath);
  console.log('✓ Gerado:', iconOnlyPath);

  // 2. assets/splash.png e assets/splash-dark.png (2732x2732, sólido #1E1B4B com ícone ~25% da largura = 683px)
  const splashSize = 2732;
  const iconInSplashSize = Math.round(splashSize * 0.25); // ~683px

  const resizedIconBuffer = await sharp(svgBuffer)
    .resize(iconInSplashSize, iconInSplashSize)
    .png()
    .toBuffer();

  const splashBg = {
    create: {
      width: splashSize,
      height: splashSize,
      channels: 4,
      background: '#1E1B4B',
    },
  };

  const left = Math.round((splashSize - iconInSplashSize) / 2);
  const top = Math.round((splashSize - iconInSplashSize) / 2);

  const splashPath = path.join(assetsDir, 'splash.png');
  await sharp(splashBg)
    .composite([
      {
        input: resizedIconBuffer,
        left,
        top,
      },
    ])
    .png()
    .toFile(splashPath);
  console.log('✓ Gerado:', splashPath);

  const splashDarkPath = path.join(assetsDir, 'splash-dark.png');
  fs.copyFileSync(splashPath, splashDarkPath);
  console.log('✓ Gerado:', splashDarkPath);

  console.log('Todos os assets foram gerados com sucesso!');
}

run().catch((err) => {
  console.error('Erro ao gerar assets:', err);
  process.exit(1);
});
