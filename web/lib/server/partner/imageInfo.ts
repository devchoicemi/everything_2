/**
 * Reads what the photo rules need from a file's own bytes: its type, its size in pixels and, for JPEGs, the
 * date it was taken. No image library: JPEG, PNG and HEIC headers are small and well defined.
 */
export type ImageKind = 'jpeg' | 'png' | 'heic'

export interface ImageInfo {
  kind: ImageKind
  mime: string
  width: number
  height: number
  /** when the camera says it was taken (JPEG EXIF), if it says */
  takenAt: Date | null
}

const u16 = (b: Buffer, o: number, le: boolean) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o))
const u32 = (b: Buffer, o: number, le: boolean) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o))

/** DateTimeOriginal (or DateTime) from a JPEG's EXIF block, "YYYY:MM:DD HH:MM:SS". */
function exifDate(buf: Buffer, tiff: number): Date | null {
  try {
    const le = buf.toString('ascii', tiff, tiff + 2) === 'II'
    const first = u32(buf, tiff + 4, le)
    const readIfd = (offset: number): Map<number, number> => {
      const tags = new Map<number, number>()
      const n = u16(buf, tiff + offset, le)
      for (let i = 0; i < n; i++) {
        const e = tiff + offset + 2 + i * 12
        if (e + 12 > buf.length) break
        tags.set(u16(buf, e, le), e)
      }
      return tags
    }
    const ifd0 = readIfd(first)
    const text = (entry: number) => {
      const count = u32(buf, entry + 4, le)
      const off = count > 4 ? tiff + u32(buf, entry + 8, le) : entry + 8
      return buf.toString('ascii', off, off + Math.min(count, 19))
    }
    let raw: string | null = null
    const exifPtr = ifd0.get(0x8769)
    if (exifPtr !== undefined) {
      const sub = readIfd(u32(buf, exifPtr + 8, le))
      const original = sub.get(0x9003) ?? sub.get(0x9004)
      if (original !== undefined) raw = text(original)
    }
    if (!raw && ifd0.get(0x0132) !== undefined) raw = text(ifd0.get(0x0132)!)
    const m = raw && /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(raw)
    if (!m) return null
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])))
    return Number.isNaN(d.getTime()) || Number(m[1]) < 1990 ? null : d
  } catch {
    return null
  }
}

function jpeg(buf: Buffer): ImageInfo | null {
  let o = 2
  let width = 0
  let height = 0
  let orientation = 1
  let takenAt: Date | null = null
  while (o + 4 < buf.length) {
    if (buf[o] !== 0xff) {
      o++
      continue
    }
    const marker = buf[o + 1]
    if (marker === 0xff) {
      o++
      continue
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      o += 2
      continue
    }
    const len = buf.readUInt16BE(o + 2)
    if (marker === 0xe1 && buf.toString('ascii', o + 4, o + 8) === 'Exif') {
      takenAt = exifDate(buf, o + 10)
      try {
        const tiff = o + 10
        const le = buf.toString('ascii', tiff, tiff + 2) === 'II'
        const ifd = tiff + u32(buf, tiff + 4, le)
        const n = u16(buf, ifd, le)
        for (let i = 0; i < n; i++) {
          const e = ifd + 2 + i * 12
          if (u16(buf, e, le) === 0x0112) orientation = u16(buf, e + 8, le)
        }
      } catch {
        /* keep the default */
      }
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      height = buf.readUInt16BE(o + 5)
      width = buf.readUInt16BE(o + 7)
      break
    }
    o += 2 + len
  }
  if (!width || !height) return null
  // a phone held upright stores the picture sideways and marks it with an orientation
  if (orientation >= 5 && orientation <= 8) [width, height] = [height, width]
  return { kind: 'jpeg', mime: 'image/jpeg', width, height, takenAt }
}

function png(buf: Buffer): ImageInfo | null {
  if (buf.length < 24 || buf.toString('ascii', 12, 16) !== 'IHDR') return null
  return { kind: 'png', mime: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), takenAt: null }
}

/** HEIC/HEIF: the 'ispe' box in the metadata holds the picture's size. */
function heic(buf: Buffer): ImageInfo | null {
  const brand = buf.toString('ascii', 8, 12)
  if (buf.toString('ascii', 4, 8) !== 'ftyp' || !['heic', 'heix', 'hevc', 'mif1', 'msf1', 'heim', 'heis'].includes(brand)) return null
  const at = buf.indexOf('ispe', 0, 'ascii')
  if (at < 0 || at + 16 > buf.length) return null
  const width = buf.readUInt32BE(at + 8)
  const height = buf.readUInt32BE(at + 12)
  return width && height ? { kind: 'heic', mime: 'image/heic', width, height, takenAt: null } : null
}

export function readImage(buf: Buffer): ImageInfo | null {
  if (buf.length < 32) return null
  if (buf[0] === 0xff && buf[1] === 0xd8) return jpeg(buf)
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return png(buf)
  return heic(buf)
}
