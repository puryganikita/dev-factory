import fs from 'fs'
import path from 'path'
import { select, step, success, info, warn, createSpinner, c, box, nl } from './ui.mjs'
import { loadManifest, saveManifest, collectAllKnownFiles, cleanOldFiles, cleanOldSkills, copyAgents, copySkills } from './helpers.mjs'

const VERSION_MAP = {
  'just-do-it': 'just-do-it',
  'analytics-factory': 'analytics-factory',
  'code-factory': 'code-factory',
  full: 'all-in',
}

export async function runInit({ REPO_ROOT, PROJECT_ROOT }) {
  const CURSOR_DIR = path.join(PROJECT_ROOT, '.cursor')
  const FACTORY_DIR = path.join(PROJECT_ROOT, 'ai-dev-factory')
  const DIST = path.join(REPO_ROOT, 'dist')

  // ── Step 1: Select version ──────────────────────────────────────────────

  step(1, 3, 'Выбор варианта установки')
  nl()

  const version = await select('Какой инструмент установить?', [
    { value: 'full',               label: 'full',               desc: '— все инструменты' },
    { value: 'just-do-it',         label: 'just-do-it',         desc: '— простой конвейер (analyst → architect → engineer → developer)' },
    { value: 'code-factory',       label: 'code-factory',       desc: '— конвейер реализации (task_analyst → architect → engineers → developers)' },
    { value: 'analytics-factory',  label: 'analytics-factory',  desc: '— аналитика и декомпозиция (analyst → design/component → final → board)' },
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

  const allKnown = collectAllKnownFiles(DIST)
  cleanOldFiles(agentsDest, allKnown.agents)
  cleanOldSkills(skillsDest, allKnown.skills)

  const copiedAgents = copyAgents(path.join(srcDir, 'agents'), agentsDest)
  const copiedSkills = copySkills(path.join(srcDir, 'skills'), skillsDest)

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

