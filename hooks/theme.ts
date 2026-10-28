// Formato de un tema de la comunidad y su validación. Todo lo que llega de un
// JSON se comprueba aquí antes de tocar el SVG o la rejilla de la terminal.

export type Sprites = {
  /** Animal grande (dos fotogramas): por defecto, una tortuga. */
  big: [string[], string[]]
  /** Animal pequeño en banco (dos fotogramas): por defecto, un pez. */
  small: [string[], string[]]
  /** Lo que crece en el fondo: por defecto, coral y algas. */
  floor: string[]
}

export type Theme = {
  id: string
  label: string
  description: string
  author?: string
  water: { top: string; bottom: string }
  dots: string
  bubble: string
  tiles: Record<string, string>
  glyphs: Record<string, string>
  sprites: Sprites
  source: 'builtin' | 'user'
}

export const DEFAULT_SPRITES: Sprites = {
  big: [
    [
      '...ff.....ff....',
      '....ffsssff.....',
      '...sSsSsSsSs....',
      '..sSsSsSsSsSs.hh',
      '..sSsSsSsSsSshhh',
      '..sSsSsSsSsSs.hh',
      '...sSsSsSsSs....',
      '....ffsssff.....',
      '...ff.....ff....',
    ],
    [
      '.....ff...ff....',
      '.....fsssff.....',
      '...sSsSsSsSs....',
      '..sSsSsSsSsSs.hh',
      '.fsSsSsSsSsSshhh',
      '..sSsSsSsSsSs.hh',
      '...sSsSsSsSs....',
      '.....fsssff.....',
      '.....ff...ff....',
    ],
  ],
  small: [
    ['o..yyy.', 'ooyyyyw', 'o..yyy.'],
    ['...yyy.', 'ooyyyyw', '...yyy.'],
  ],
  floor: [
    '..p...p..g....',
    '.pPp.pPp.g..g.',
    '..pPpPp..gg.g.',
    '...pPp....gGg.',
    '...pPp.....G..',
    '..pPPPp....G..',
  ],
}

export const DEFAULT_GLYPHS: Record<string, string> = {
  S: '%&#', s: 'sts', h: 'tt', f: 'tf', y: 'yv', o: '<o', p: '*@', P: '#%',
  g: '|)', G: '|(', w: 'o',
}

const COLOR = /^#[0-9a-fA-F]{6}$/
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/
// Un carácter imprimible de ancho 1 (lo que la rejilla de la terminal admite).
const GLYPH = /^[!-~¡-ɏ─-◿⠀-⣿·]+$/u
const MAX_SPRITE = 24

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const text = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : undefined

const rows = (v: unknown, where: string): string[] | string => {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_SPRITE) return `${where}: entre 1 y ${MAX_SPRITE} filas`
  for (const row of v) {
    if (typeof row !== 'string' || row.length > MAX_SPRITE) return `${where}: cada fila, texto de hasta ${MAX_SPRITE} caracteres`
  }
  return v as string[]
}

const frames = (v: unknown, where: string): [string[], string[]] | string => {
  if (!Array.isArray(v) || v.length !== 2) return `${where}: dos fotogramas`
  const a = rows(v[0], `${where}[0]`)
  if (typeof a === 'string') return a
  const b = rows(v[1], `${where}[1]`)
  if (typeof b === 'string') return b
  return [a, b]
}

/** Un tema válido, o el motivo por el que no lo es. */
export const parseTheme = (raw: unknown, source: Theme['source']): Theme | string => {
  if (!isRecord(raw)) return 'debe ser un objeto JSON'
  const id = typeof raw.id === 'string' && ID.test(raw.id) ? raw.id : undefined
  if (!id) return '"id": minúsculas, números y guiones (máx. 40)'
  const label = text(raw.label, 40)
  if (!label) return '"label": texto de hasta 40 caracteres'
  const description = text(raw.description, 120) ?? ''
  const author = text(raw.author, 40)

  if (!isRecord(raw.water)) return '"water": { "top", "bottom" }'
  const top = raw.water.top
  const bottom = raw.water.bottom
  if (typeof top !== 'string' || !COLOR.test(top)) return '"water.top": color #rrggbb'
  if (typeof bottom !== 'string' || !COLOR.test(bottom)) return '"water.bottom": color #rrggbb'
  const dots = typeof raw.dots === 'string' && COLOR.test(raw.dots) ? raw.dots : '#ffffff'
  const bubble = typeof raw.bubble === 'string' && COLOR.test(raw.bubble) ? raw.bubble : dots

  if (!isRecord(raw.tiles)) return '"tiles": { "<letra>": "#rrggbb" }'
  const tiles: Record<string, string> = {}
  for (const [key, color] of Object.entries(raw.tiles)) {
    if (key.length !== 1 || key === '.') return `"tiles.${key}": la clave es una sola letra (no ".")`
    if (typeof color !== 'string' || !COLOR.test(color)) return `"tiles.${key}": color #rrggbb`
    tiles[key] = color
  }

  const glyphs: Record<string, string> = { ...DEFAULT_GLYPHS }
  if (raw.glyphs !== undefined) {
    if (!isRecord(raw.glyphs)) return '"glyphs": { "<letra>": "caracteres" }'
    for (const [key, set] of Object.entries(raw.glyphs)) {
      if (typeof set !== 'string' || !set.length || set.length > 8 || !GLYPH.test(set)) {
        return `"glyphs.${key}": de 1 a 8 caracteres imprimibles de ancho 1`
      }
      glyphs[key] = set
    }
  }

  const sprites: Sprites = { ...DEFAULT_SPRITES }
  if (raw.sprites !== undefined) {
    if (!isRecord(raw.sprites)) return '"sprites": { "big", "small", "floor" }'
    if (raw.sprites.big !== undefined) {
      const big = frames(raw.sprites.big, 'sprites.big')
      if (typeof big === 'string') return big
      sprites.big = big
    }
    if (raw.sprites.small !== undefined) {
      const small = frames(raw.sprites.small, 'sprites.small')
      if (typeof small === 'string') return small
      sprites.small = small
    }
    if (raw.sprites.floor !== undefined) {
      const floor = rows(raw.sprites.floor, 'sprites.floor')
      if (typeof floor === 'string') return floor
      sprites.floor = floor
    }
  }

  return { id, label, description, author, water: { top, bottom }, dots, bubble, tiles, glyphs, sprites, source }
}
