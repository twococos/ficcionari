// Genera les icones PWA a partir del favicon.svg de la marca.
// Ús: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const OUT = path.resolve('public/icons')

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <rect width="512" height="512" fill="#0058F8"/>
  <text x="50%" y="50%" dy="0.08em" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, sans-serif" font-size="300" font-weight="900" fill="#F8C800">F</text>
</svg>`

const targets = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

await mkdir(OUT, { recursive: true })
for (const { name, size } of targets) {
  await sharp(Buffer.from(svg(size))).resize(size, size).png().toFile(path.join(OUT, name))
  console.log('✓', name)
}
console.log('Icones generades a', OUT)
