import readline from 'readline'

// ─── ANSI Colors & Styles ────────────────────────────────────────────────────

const ESC = '\x1b['
const RESET = `${ESC}0m`

export const c = {
  bold:    (s) => `${ESC}1m${s}${RESET}`,
  dim:     (s) => `${ESC}2m${s}${RESET}`,
  italic:  (s) => `${ESC}3m${s}${RESET}`,
  cyan:    (s) => `${ESC}36m${s}${RESET}`,
  magenta: (s) => `${ESC}35m${s}${RESET}`,
  green:   (s) => `${ESC}32m${s}${RESET}`,
  yellow:  (s) => `${ESC}33m${s}${RESET}`,
  red:     (s) => `${ESC}31m${s}${RESET}`,
  blue:    (s) => `${ESC}34m${s}${RESET}`,
  gray:    (s) => `${ESC}90m${s}${RESET}`,
  white:   (s) => `${ESC}97m${s}${RESET}`,
  bgCyan:  (s) => `${ESC}46m${ESC}30m${s}${RESET}`,
  bgMag:   (s) => `${ESC}45m${ESC}97m${s}${RESET}`,
}

// ─── Symbols ─────────────────────────────────────────────────────────────────

export const sym = {
  check:   c.green('✓'),
  cross:   c.red('✗'),
  info:    c.cyan('ℹ'),
  warn:    c.yellow('⚠'),
  arrow:   c.cyan('❯'),
  dot:     c.gray('·'),
  pointer: c.cyan('▸'),
  line:    c.gray('─'),
}

// ─── Banner ──────────────────────────────────────────────────────────────────

const LOGO_LINES = [
  '  ██████╗ ███████╗██╗   ██╗',
  '  ██╔══██╗██╔════╝██║   ██║',
  '  ██║  ██║█████╗  ██║   ██║',
  '  ██║  ██║██╔══╝  ╚██╗ ██╔╝',
  '  ██████╔╝███████╗ ╚████╔╝ ',
  '  ╚═════╝ ╚══════╝  ╚═══╝  ',
  '',
  '  ███████╗ █████╗  ██████╗████████╗ ██████╗ ██████╗ ██╗   ██╗',
  '  ██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝',
  '  █████╗  ███████║██║        ██║   ██║   ██║██████╔╝ ╚████╔╝ ',
  '  ██╔══╝  ██╔══██║██║        ██║   ██║   ██║██╔══██╗  ╚██╔╝  ',
  '  ██║     ██║  ██║╚██████╗   ██║   ╚██████╔╝██║  ██║   ██║   ',
  '  ╚═╝     ╚═╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ',
]

const GRADIENT = [
  `${ESC}36m`,   // cyan
  `${ESC}36m`,
  `${ESC}96m`,   // bright cyan
  `${ESC}96m`,
  `${ESC}35m`,   // magenta
  `${ESC}35m`,
  `${ESC}95m`,   // bright magenta
  `${ESC}95m`,
  `${ESC}35m`,
  `${ESC}35m`,
  `${ESC}96m`,
  `${ESC}96m`,
  `${ESC}36m`,
  `${ESC}36m`,
]

export function banner(version = '1.0.0') {
  console.log()
  for (let i = 0; i < LOGO_LINES.length; i++) {
    const color = GRADIENT[i % GRADIENT.length]
    console.log(`${color}${LOGO_LINES[i]}${RESET}`)
  }
  console.log()
  console.log(`  ${c.gray(`v${version}`)}  ${c.dim('Agent orchestration system for Cursor IDE')}`)
  console.log(`  ${c.gray('─'.repeat(60))}`)
  console.log()
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function createSpinner(text) {
  let i = 0
  let timer = null

  return {
    start() {
      process.stdout.write('\x1b[?25l') // hide cursor
      timer = setInterval(() => {
        const frame = c.cyan(SPINNER_FRAMES[i % SPINNER_FRAMES.length])
        process.stdout.write(`\r  ${frame} ${text}`)
        i++
      }, 80)
      return this
    },
    succeed(msg) {
      clearInterval(timer)
      process.stdout.write(`\r  ${sym.check} ${msg || text}\x1b[K\n`)
      process.stdout.write('\x1b[?25h') // show cursor
    },
    fail(msg) {
      clearInterval(timer)
      process.stdout.write(`\r  ${sym.cross} ${msg || text}\x1b[K\n`)
      process.stdout.write('\x1b[?25h')
    },
    stop() {
      clearInterval(timer)
      process.stdout.write(`\r\x1b[K`)
      process.stdout.write('\x1b[?25h')
    },
  }
}

// ─── Select Menu ─────────────────────────────────────────────────────────────

export async function select(question, options) {
  return new Promise((resolve) => {
    let selected = 0

    const render = () => {
      // Move cursor up to redraw
      if (selected !== -1) {
        process.stdout.write(`\x1b[${options.length}A`)
      }
      for (let i = 0; i < options.length; i++) {
        const prefix = i === selected ? `  ${c.cyan('▸')} ` : '    '
        const label = i === selected
          ? c.bold(c.cyan(options[i].label))
          : c.dim(options[i].label)
        const desc = options[i].desc ? c.gray(` ${options[i].desc}`) : ''
        process.stdout.write(`${prefix}${label}${desc}\x1b[K\n`)
      }
    }

    console.log(`  ${c.bold(question)}\n`)
    // Print initial options
    for (let i = 0; i < options.length; i++) {
      const prefix = i === selected ? `  ${c.cyan('▸')} ` : '    '
      const label = i === selected
        ? c.bold(c.cyan(options[i].label))
        : c.dim(options[i].label)
      const desc = options[i].desc ? c.gray(` ${options[i].desc}`) : ''
      console.log(`${prefix}${label}${desc}`)
    }

    const stdin = process.stdin
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    const onKey = (key) => {
      if (key === '\x1b[A' || key === 'k') {
        // Up
        selected = (selected - 1 + options.length) % options.length
        render()
      } else if (key === '\x1b[B' || key === 'j') {
        // Down
        selected = (selected + 1) % options.length
        render()
      } else if (key === '\r' || key === '\n') {
        // Enter
        stdin.setRawMode(false)
        stdin.pause()
        stdin.removeListener('data', onKey)
        console.log()
        resolve(options[selected])
      } else if (key === '\x03') {
        // Ctrl+C
        process.stdout.write('\x1b[?25h')
        process.exit(0)
      }
    }

    stdin.on('data', onKey)
  })
}

// ─── Confirm ─────────────────────────────────────────────────────────────────

export async function confirm(question, defaultYes = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const hint = defaultYes ? `${c.bold('Y')}/n` : `y/${c.bold('N')}`

  return new Promise((resolve) => {
    rl.question(`  ${c.bold(question)} ${c.gray(`(${hint})`)} `, (answer) => {
      rl.close()
      const a = answer.trim().toLowerCase()
      if (a === '') resolve(defaultYes)
      else resolve(a === 'y' || a === 'yes')
    })
  })
}

// ─── Text Input ──────────────────────────────────────────────────────────────

export async function input(question, defaultValue = '') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const hint = defaultValue ? c.gray(` (${defaultValue})`) : ''

  return new Promise((resolve) => {
    rl.question(`  ${c.bold(question)}${hint} `, (answer) => {
      rl.close()
      resolve(answer.trim() || defaultValue)
    })
  })
}

// ─── Messages ────────────────────────────────────────────────────────────────

export function success(msg) { console.log(`  ${sym.check} ${msg}`) }
export function error(msg)   { console.log(`  ${sym.cross} ${c.red(msg)}`) }
export function info(msg)    { console.log(`  ${sym.info} ${msg}`) }
export function warn(msg)    { console.log(`  ${sym.warn} ${c.yellow(msg)}`) }

// ─── Step ────────────────────────────────────────────────────────────────────

export function step(current, total, msg) {
  console.log(`\n  ${c.bgCyan(` ${current}/${total} `)} ${c.bold(msg)}`)
}

// ─── Box ─────────────────────────────────────────────────────────────────────

export function box(lines, { padding = 1, borderColor = c.cyan } = {}) {
  const stripped = (s) => s.replace(/\x1b\[[0-9;]*m/g, '')
  const maxLen = Math.max(...lines.map(l => stripped(l).length))
  const w = maxLen + padding * 2
  const pad = ' '.repeat(padding)
  const hr = '─'.repeat(w)

  console.log(`  ${borderColor('╭' + hr + '╮')}`)
  for (let i = 0; i < padding; i++) {
    console.log(`  ${borderColor('│')}${' '.repeat(w)}${borderColor('│')}`)
  }
  for (const line of lines) {
    const s = stripped(line)
    const right = ' '.repeat(Math.max(0, maxLen - s.length))
    console.log(`  ${borderColor('│')}${pad}${line}${right}${pad}${borderColor('│')}`)
  }
  for (let i = 0; i < padding; i++) {
    console.log(`  ${borderColor('│')}${' '.repeat(w)}${borderColor('│')}`)
  }
  console.log(`  ${borderColor('╰' + hr + '╯')}`)
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function divider() {
  console.log(`\n  ${c.gray('─'.repeat(60))}\n`)
}

// ─── Newline ─────────────────────────────────────────────────────────────────

export function nl() { console.log() }
