import { atom, read, update } from 'claude-code'
import type { CoreEngineInterface, Register } from 'claude-code'

import { parseTheme } from './theme'
import type { Theme } from './theme'

type Dollar = CoreEngineInterface

const PANE = 'chat-theme'
const STORE_KEY = 'theme'
const DEFAULT_THEME = 'laguna'
const theme = atom({ plugin: 'chat-themes', key: 'theme' } as const, DEFAULT_THEME)

// Temas cargados: los que trae el mod (themes/) y los de la persona
// (~/.claude/chat-themes/). Uno de la persona con el mismo id gana.
let themes = new Map<string, Theme>()
let loadErrors: string[] = []

const loadDir = async ($: Dollar, dir: string, source: Theme['source']) => {
  if (!(await $.fs.exists(dir))) return
  for (const entry of await $.fs.list(dir)) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    try {
      const parsed = parseTheme(JSON.parse(await $.fs.read(`${dir}/${entry.name}`)), source)
      if (typeof parsed === 'string') loadErrors.push(`${entry.name}: ${parsed}`)
      else themes.set(parsed.id, parsed)
    } catch (error) {
      loadErrors.push(`${entry.name}: ${error instanceof Error ? error.message : 'JSON inválido'}`)
    }
  }
}

const userDir = async ($: Dollar) => {
  const home = await $.env.get('HOME')
  return home ? `${home}/.claude/chat-themes` : undefined
}

const loadThemes = async ($: Dollar) => {
  themes = new Map()
  loadErrors = []
  await loadDir($, `${$.plugin.root}/themes`, 'builtin')
  const dir = await userDir($)
  if (dir) await loadDir($, dir, 'user')
}

const themeOf = (id: string): Theme | undefined => themes.get(id) ?? themes.get(DEFAULT_THEME)

const hex = (color: string): number => parseInt(color.slice(1), 16)
const toHex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`
const mix = (a: string, b: string, t: number): string => {
  const x = hex(a)
  const y = hex(b)
  const ch = (shift: number) =>
    Math.round(((x >> shift) & 255) * (1 - t) + ((y >> shift) & 255) * t)
  return toHex((ch(16) << 16) | (ch(8) << 8) | ch(0))
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Carácter estable para cada tesela, para que el mosaico no parpadee.
const glyphAt = (t: Theme, key: string, x: number, y: number): string => {
  const set = [...(t.glyphs[key] ?? key)]
  return set[(x * 7 + y * 13) % set.length] ?? key
}

// ---------------------------------------------------------------------------
// Escritorio: un SVG que se anima solo (SMIL), sin temporizadores.
// ---------------------------------------------------------------------------

const CELL = 10
const W = 420
const H = 640

const tilesSvg = (rows: string[], t: Theme): string => {
  let out = ''
  rows.forEach((row, y) => {
    ;[...row].forEach((key, x) => {
      const fill = t.tiles[key]
      if (!fill) return
      out +=
        `<rect x="${x * CELL}" y="${y * CELL}" width="9" height="9" rx="1.6" fill="${fill}"/>` +
        `<text x="${x * CELL + 4.5}" y="${y * CELL + 7}" fill="${mix(fill, '#000000', 0.45)}">${xml(glyphAt(t, key, x, y))}</text>`
    })
  })
  return out
}

// Dos fotogramas que se alternan para el aleteo.
const flapping = (id: string, period: string) =>
  `<use href="#${id}0"><animate attributeName="opacity" values="1;0" dur="${period}" calcMode="discrete" repeatCount="indefinite"/></use>` +
  `<use href="#${id}1" opacity="0"><animate attributeName="opacity" values="0;1" dur="${period}" calcMode="discrete" repeatCount="indefinite"/></use>`

type Swimmer = {
  sprite: 'big' | 'small'
  y: number
  scale: number
  dur: number
  begin: number
  isLeftward?: boolean
}

const SWIMMERS: Swimmer[] = [
  { sprite: 'big', y: 110, scale: 1.4, dur: 34, begin: 0 },
  { sprite: 'big', y: 330, scale: 0.9, dur: 26, begin: -14, isLeftward: true },
  { sprite: 'big', y: 470, scale: 1.9, dur: 48, begin: -30 },
  { sprite: 'small', y: 240, scale: 1, dur: 16, begin: -3, isLeftward: true },
  { sprite: 'small', y: 258, scale: 1, dur: 16, begin: -3.6, isLeftward: true },
  { sprite: 'small', y: 226, scale: 0.9, dur: 16, begin: -4.4, isLeftward: true },
  { sprite: 'small', y: 410, scale: 1.2, dur: 20, begin: -9 },
  { sprite: 'small', y: 426, scale: 1, dur: 20, begin: -9.8 },
]

const swimmerSvg = (t: Theme) => (s: Swimmer, i: number): string => {
  const cols = Math.max(...t.sprites[s.sprite][0].map(row => row.length))
  const width = cols * CELL * s.scale
  const [from, to] = s.isLeftward ? [W + 20, -width - 20] : [-width - 20, W + 20]
  const flip = s.isLeftward ? `translate(${width} 0) scale(-1 1)` : ''
  const bob = s.sprite === 'big' ? 10 : 5
  return (
    `<g><animateTransform attributeName="transform" type="translate" values="${from} ${s.y};${to} ${s.y}" dur="${s.dur}s" begin="${s.begin}s" repeatCount="indefinite"/>` +
    `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -${bob};0 0" dur="${3 + (i % 3)}s" repeatCount="indefinite"/>` +
    `<g transform="${flip} scale(${s.scale})">${flapping(s.sprite, s.sprite === 'big' ? '1.6s' : '0.5s')}</g></g></g>`
  )
}

const bubblesSvg = (t: Theme): string => {
  let out = ''
  for (let i = 0; i < 14; i++) {
    const x = (i * 97) % W
    const r = 2 + (i % 4)
    const dur = 7 + (i % 5) * 1.7
    out +=
      `<circle cx="${x}" r="${r}" fill="none" stroke="${t.bubble}" stroke-width="1.2" opacity="0">` +
      `<animate attributeName="cy" values="${H + 10};-10" dur="${dur}s" begin="-${i * 1.3}s" repeatCount="indefinite"/>` +
      `<animate attributeName="cx" values="${x};${x + 8};${x - 6};${x}" dur="${dur / 2}s" repeatCount="indefinite"/>` +
      `<animate attributeName="opacity" values="0;.8;.8;0" dur="${dur}s" begin="-${i * 1.3}s" repeatCount="indefinite"/></circle>`
  }
  return out
}

const causticsSvg = (t: Theme): string => {
  let out = ''
  for (let i = 0; i < 6; i++) {
    const x = 40 + ((i * 131) % (W - 80))
    const y = 60 + ((i * 89) % 260)
    out +=
      `<ellipse cx="${x}" cy="${y}" rx="${70 + i * 12}" ry="${22 + i * 4}" fill="${t.dots}" opacity=".06">` +
      `<animate attributeName="opacity" values=".03;.16;.03" dur="${5 + i}s" repeatCount="indefinite"/>` +
      `<animate attributeName="rx" values="${70 + i * 12};${90 + i * 12};${70 + i * 12}" dur="${7 + i}s" repeatCount="indefinite"/></ellipse>`
  }
  return out
}

const raysSvg = (t: Theme): string =>
  [40, 150, 280, 360]
    .map(
      (x, i) =>
        `<polygon points="${x},0 ${x + 40},0 ${x + 110},${H} ${x + 30},${H}" fill="${t.dots}" opacity=".08">` +
        `<animate attributeName="opacity" values=".02;.12;.02" dur="${6 + i * 2}s" repeatCount="indefinite"/></polygon>`,
    )
    .join('')

const floorSvg = (t: Theme): string => {
  const rows = t.sprites.floor.length
  return [
    { x: 20, s: 1.1 },
    { x: 250, s: 1 },
    { x: 330, s: 1.3 },
  ]
    .map(
      (c, i) =>
        `<g transform="translate(${c.x} ${H - rows * CELL * c.s - 4}) scale(${c.s})"><g>` +
        `<animateTransform attributeName="transform" type="rotate" values="-2 70 ${rows * CELL};2 70 ${rows * CELL};-2 70 ${rows * CELL}" dur="${5 + i}s" repeatCount="indefinite"/>` +
        `<use href="#floor"/></g></g>`,
    )
    .join('')
}

const sceneSvg = (t: Theme): string => {
  const defs =
    `<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.water.top}"/><stop offset="1" stop-color="${t.water.bottom}"/></linearGradient>` +
    `<pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r=".9" fill="${t.dots}" opacity=".35"/></pattern>` +
    `<g id="big0">${tilesSvg(t.sprites.big[0], t)}</g><g id="big1">${tilesSvg(t.sprites.big[1], t)}</g>` +
    `<g id="small0">${tilesSvg(t.sprites.small[0], t)}</g><g id="small1">${tilesSvg(t.sprites.small[1], t)}</g>` +
    `<g id="floor">${tilesSvg(t.sprites.floor, t)}</g>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">` +
    `<defs>${defs}</defs>` +
    `<rect width="${W}" height="${H}" fill="url(#water)"/>` +
    `<rect width="${W}" height="${H}" fill="url(#dots)"/>` +
    raysSvg(t) +
    causticsSvg(t) +
    `<g font-family="ui-monospace,Menlo,monospace" font-size="8" font-weight="700" text-anchor="middle">` +
    SWIMMERS.map(swimmerSvg(t)).join('') +
    floorSvg(t) +
    `</g>` +
    bubblesSvg(t) +
    `</svg>`
  )
}

// ---------------------------------------------------------------------------
// Terminal: una rejilla de celdas repintada con $.ui.blit.
// ---------------------------------------------------------------------------

const RASTER_KEY = 'scene'
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const base64 = (bytes: Uint8Array): string => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? B64[n & 63]! : '='
  }
  return out
}
let size = { columns: 0, rows: 0 }
let timer: { cancel: () => void } | undefined
let startedAt = 0

const frameCells = (th: Theme, t: number, columns: number, rows: number): string => {
  const words = new Uint32Array(columns * rows * 3)
  const put = (x: number, y: number, ch: string, fg: number, bg: number) => {
    if (x < 0 || y < 0 || x >= columns || y >= rows) return
    const i = (y * columns + x) * 3
    words[i] = ch.codePointAt(0) ?? 32
    words[i + 1] = fg
    words[i + 2] = bg
  }
  const waterAt = (y: number) => mix(th.water.top, th.water.bottom, y / Math.max(1, rows - 1))
  const sparkle = hex(mix(th.water.top, th.dots, 0.5))
  for (let y = 0; y < rows; y++) {
    const water = hex(waterAt(y))
    for (let x = 0; x < columns; x++) {
      const isDot = (x * 31 + y * 17 + Math.floor(t * 2)) % 23 === 0
      put(x, y, isDot ? '·' : ' ', sparkle, water)
    }
  }
  const stamp = (sprite: string[], ox: number, oy: number, isLeftward: boolean) => {
    sprite.forEach((row, y) => {
      ;[...row].forEach((key, x) => {
        const fill = th.tiles[key]
        if (!fill) return
        const cx = isLeftward ? ox + row.length - 1 - x : ox + x
        put(cx, oy + y, glyphAt(th, key, x, y), hex(mix(fill, '#000000', 0.45)), hex(fill))
      })
    })
  }
  const lane = (speed: number, width: number, offset: number) =>
    Math.floor(((t * speed + offset) % (columns + width * 2)) - width)
  const isFlapped = Math.floor(t * 1.5) % 2 === 1
  const [bigA, bigB] = th.sprites.big
  const [smallA, smallB] = th.sprites.small
  const small = Math.floor(t * 4) % 2 === 1 ? smallB : smallA
  stamp(isFlapped ? bigB : bigA, lane(4, 16, 0), 1 + Math.round(Math.sin(t) * 0.6), false)
  stamp(isFlapped ? bigA : bigB, columns - lane(3, 16, 25), Math.max(0, rows - bigA.length - 2), true)
  stamp(small, columns - lane(7, 7, 10), Math.floor(rows / 2), true)
  stamp(small, columns - lane(7, 7, 14), Math.floor(rows / 2) + 3, true)
  stamp(th.sprites.floor, 2, rows - th.sprites.floor.length, false)
  for (let i = 0; i < 6; i++) {
    const by = rows - 1 - Math.floor((t * 3 + i * 5) % rows)
    put((i * 13 + 5) % columns, by, 'o', hex(th.bubble), hex(waterAt(by)))
  }
  return base64(new Uint8Array(words.buffer))
}

// ---------------------------------------------------------------------------

const stopTimer = () => {
  timer?.cancel()
  timer = undefined
}

const applyTheme = async ($: Dollar, t: Theme) => {
  await update($, theme, () => t.id)
  await $.store.set(STORE_KEY, t.id)
  await $.ui.open({ id: PANE, title: t.label })
}

const turnOff = async ($: Dollar) => {
  stopTimer()
  await $.store.set(STORE_KEY, null)
  await $.ui.close({ id: PANE })
}

const listText = () =>
  [...themes.values()]
    .map(t => `${t.id} — ${t.label}${t.author ? ` (por ${t.author})` : ''}: ${t.description}`)
    .join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await loadThemes($)
    const saved = await $.store.get(STORE_KEY)
    const savedTheme = typeof saved === 'string' ? themes.get(saved) : undefined
    if (savedTheme) await update($, theme, () => savedTheme.id)
    await $.command.register({
      name: 'tema',
      description: 'Tema animado del chat: /tema <id> | lista | recargar | off',
    })
    await $.tool.register({
      name: 'set_chat_theme',
      description:
        'Aplica un tema animado al chat de la persona (un panel con una escena ASCII animada junto a la conversación). ' +
        `Temas instalados ahora: ${[...themes.keys()].join(', ')}. "off" lo cierra. ` +
        'Para crear uno nuevo, escribe un JSON en ~/.claude/chat-themes/<id>.json siguiendo el formato del README del mod chat-themes y luego llama a esta herramienta con su id.',
      inputSchema: {
        type: 'object',
        properties: { theme: { type: 'string', description: 'id del tema, o "off"' } },
        required: ['theme'],
      },
      isDeferred: false,
    })
    if (savedTheme) void $.ui.open({ id: PANE, title: savedTheme.label })

    return next(e)
  })

  on('command.run', { command: 'tema' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off') {
      await turnOff($)
      return { text: 'Tema quitado.' }
    }
    if (arg === 'lista' || arg === 'list') return { text: listText() }
    if (arg === 'recargar' || arg === 'reload') {
      await loadThemes($)
      const errors = loadErrors.length ? `\nCon errores:\n${loadErrors.join('\n')}` : ''
      return { text: `${themes.size} temas cargados.${errors}` }
    }
    const t = themes.get(arg || (await read($, theme)))
    if (!t) return { text: `No encuentro ese tema. Instalados:\n${listText()}` }
    await applyTheme($, t)
    return { text: `Tema aplicado: ${t.label}` }
  })

  on('tool.call', { tool: 'mcp__chat-themes__set_chat_theme' }, async ($, e) => {
    const wanted = String((e as unknown as { theme?: unknown }).theme ?? '').toLowerCase()
    if (wanted === 'off') {
      await turnOff($)
      return { result: 'Tema quitado.' }
    }
    // Un tema recién escrito por el modelo se lee aquí sin reiniciar.
    if (!themes.has(wanted)) await loadThemes($)
    const t = themes.get(wanted)
    if (!t) {
      const why = loadErrors.find(line => line.startsWith(`${wanted}.json`))
      return { deny: why ?? `Tema desconocido. Instalados: ${[...themes.keys()].join(', ')}` }
    }
    await applyTheme($, t)
    return { result: `Aplicado: ${t.label} — ${t.description}` }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    stopTimer()
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const currentId = await read($, theme)
    const t = themeOf(currentId)
    if (!t) return <Text dimColor>No hay temas cargados. Prueba /tema recargar.</Text>

    const picker = (
      <Box flexDirection="row" gap={1} flexWrap="wrap">
        {[...themes.values()].map(one => (
          <Button
            key={`theme-${one.id}`}
            label={one.id === t.id ? `✓ ${one.label}` : one.label}
            variant={one.id === t.id ? 'primary' : undefined}
            onPress={async () => {
              await update($, theme, () => one.id)
              await $.store.set(STORE_KEY, one.id)
            }}
          />
        ))}
      </Box>
    )
    const credit = `${t.description}${t.author ? ` · por ${t.author}` : ''}`

    if ('Svg' in els) {
      const { Svg } = els
      return (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>{credit}</Text>
          <Svg source={sceneSvg(t)} alt={`${t.label}: escena animada`} isInteractive />
          {picker}
        </Box>
      )
    }

    if ('Raster' in els) {
      const { Raster } = els
      const columns = Math.max(20, Math.min(160, e.props.bodyColumns))
      const rows = Math.max(12, Math.min(24, e.props.scroll.bodyRows - 3))
      size = { columns, rows }
      if (!timer) {
        startedAt = await $.clock.now()
        timer = $.clock.every(120, async () => {
          const elapsed = ((await $.clock.now()) - startedAt) / 1000
          const now = themeOf(await read($, theme))
          if (!now) return
          try {
            await $.ui.blit({ requestId: PANE, key: RASTER_KEY, cells: frameCells(now, elapsed, size.columns, size.rows) })
          } catch {
            stopTimer()
          }
        })
      }
      return (
        <Box flexDirection="column">
          <Raster key={RASTER_KEY} columns={columns} rows={rows} cells={frameCells(t, 0, columns, rows)} />
          {picker}
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Text>{t.label}</Text>
        <Text dimColor>{credit}</Text>
        {picker}
      </Box>
    )
  })
}

