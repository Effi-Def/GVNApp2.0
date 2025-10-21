import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const src = 'public/icons/pig-maskable.svg'
const targets = [
  { file: 'public/icons/pig-192.png', size: 192 },
  { file: 'public/icons/pig-512.png', size: 512 },
  { file: 'public/icons/apple-touch-icon.png', size: 180 },
]

async function ensureDirFor(file) {
  const dir = dirname(file)
  await mkdir(dir, { recursive: true })
}

async function run() {
  for (const t of targets) {
    await ensureDirFor(t.file)
    await sharp(src, { density: 512 })
      .resize(t.size, t.size, { fit: 'contain', background: { r: 255, g: 183, b: 197, alpha: 1 } })
      .png()
      .toFile(t.file)
    console.log('Generated', t.file)
  }
}

run().catch(err => { console.error(err); process.exit(1) })
