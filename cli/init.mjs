import fs from 'fs'
import path from 'path'
import { select, step, success, info, warn, createSpinner, c, box, nl } from './ui.mjs'
import { loadManifest, saveManifest, collectAllKnownFiles } from './helpers.mjs'

const VERSION_MAP = {
  full: 'all-in',
  v1: 'v1',
  v2: 'v2',
}

export async function runInit({ REPO_ROOT, PROJECT_ROOT }) {
  const CURSOR_DIR = path.join(PROJECT_ROOT, '.cursor')
  const FACTORY_DIR = path.join(PROJECT_ROOT, 'ai-dev-factory')
  const DIST = path.join(REPO_ROOT, 'dist')

  // ── Step 1: Select version ──────────────────────────────────────────────

  step(1, 3, 'Выбор варианта установки')
  nl()

  const version = await select('Какую версию core установить?', [
    { value: 'full', label: 'full (v1 + v2)', desc: '— все агенты и скиллы' },
    { value: 'v1',   label: 'v1',             desc: '— базовый набор' },
    { value: 'v2',   label: 'v2',             desc: '— расширенный набор' },
  ])

  const distKey = VERSION_MAP[version.value]
  const srcDir = path.join(DIST, distKey)

  if (!fs.existsSync(srcDir)) {
    throw new Error(`Dist directory not found: ${srcDir}`)
  }

  // ── Step 2: Install agents & skills ─────────────────────────────────────

  step(2, 3, 'Установка агентов и скиллов')

  const spinner = createSpinner('Копирование файлов...').start()

  const agentsDest = path.join(CURSOR_DIR, 'agents')
  const skillsDest = path.join(CURSOR_DIR, 'skills')
  fs.mkdirSync(agentsDest, { recursive: true })
  fs.mkdirSync(skillsDest, { recursive: true })

  // Clean up old dev-factory files from all versions
  const allKnown = collectAllKnownFiles(DIST)
  cleanOldFiles(agentsDest, allKnown.agents)
  cleanOldSkills(skillsDest, allKnown.skills)

  // Copy agents (flat .md files)
  const agentsSrc = path.join(srcDir, 'agents')
  const copiedAgents = []
  if (fs.existsSync(agentsSrc)) {
    for (const f of fs.readdirSync(agentsSrc)) {
      if (!f.endsWith('.md')) continue
      fs.copyFileSync(path.join(agentsSrc, f), path.join(agentsDest, f))
      copiedAgents.push(f)
    }
  }

  // Copy skills (<name>/SKILL.md structure)
  const skillsSrc = path.join(srcDir, 'skills')
  const copiedSkills = []
  if (fs.existsSync(skillsSrc)) {
    for (const folder of fs.readdirSync(skillsSrc)) {
      const skillFile = path.join(skillsSrc, folder, 'SKILL.md')
      if (!fs.existsSync(skillFile)) continue
      const destFolder = path.join(skillsDest, folder)
      fs.mkdirSync(destFolder, { recursive: true })
      fs.copyFileSync(skillFile, path.join(destFolder, 'SKILL.md'))
      copiedSkills.push(folder)
    }
  }

  spinner.succeed('Файлы скопированы')

  nl()
  info(`Агенты: ${c.bold(String(copiedAgents.length))} файлов → ${c.cyan('.cursor/agents/')}`)
  info(`Скиллы: ${c.bold(String(copiedSkills.length))} папок → ${c.cyan('.cursor/skills/')}`)

  // ── Step 3: Config & manifest ───────────────────────────────────────────

  step(3, 3, 'Конфигурация')

  // Create ai-dev-factory/ directory and config
  fs.mkdirSync(FACTORY_DIR, { recursive: true })
  const configPath = path.join(FACTORY_DIR, 'dev-factory.config.json')

  if (fs.existsSync(configPath)) {
    info(`${c.cyan('ai-dev-factory/dev-factory.config.json')} уже существует — не перезаписываю`)
  } else {
    const config = { version: version.value === 'full' ? 'all-in' : version.value, extensions: {} }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
    success(`Создан ${c.cyan('ai-dev-factory/dev-factory.config.json')}`)
  }

  // Save manifest
  const manifest = loadManifest(CURSOR_DIR)
  manifest.version = distKey
  manifest.installedAt = new Date().toISOString()
  manifest.agents = copiedAgents
  manifest.skills = copiedSkills
  saveManifest(CURSOR_DIR, manifest)
  success(`Манифест сохранён в ${c.cyan('.cursor/.dev-factory-manifest.json')}`)

  // ── Summary ─────────────────────────────────────────────────────────────

  nl()
  box([
    c.bold('Установка завершена!'),
    '',
    `${c.gray('Версия:')}    ${c.cyan(version.label)}`,
    `${c.gray('Агенты:')}    ${c.bold(String(copiedAgents.length))}`,
    `${c.gray('Скиллы:')}    ${c.bold(String(copiedSkills.length))}`,
    `${c.gray('Конфиг:')}    ${c.cyan('ai-dev-factory/dev-factory.config.json')}`,
  ])
}

function cleanOldFiles(dir, knownSet) {
  if (!fs.existsSync(dir)) return
  for (const f of fs.readdirSync(dir)) {
    if (knownSet.has(f)) {
      fs.unlinkSync(path.join(dir, f))
    }
  }
}

function cleanOldSkills(dir, knownSet) {
  if (!fs.existsSync(dir)) return
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f)
    if (knownSet.has(f) && fs.statSync(full).isDirectory()) {
      fs.rmSync(full, { recursive: true })
    }
  }
}
