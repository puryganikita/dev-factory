import fs from 'fs'
import path from 'path'
import { select, step, success, info, warn, input, createSpinner, c, box, nl } from './ui.mjs'
import { loadManifest, saveManifest, collectAllKnownFiles, cleanOldFiles, cleanOldSkills, copyAgents, copySkills, readJson, writeJson } from './helpers.mjs'

const VERSION_MAP = {
  'just-do-it': 'just-do-it',
  'analytics-factory': 'analytics-factory',
  'code-factory': 'code-factory',
  factories: 'factories',
  full: 'all-in',
}

const INCLUDES_ANALYTICS = new Set(['analytics-factory', 'factories', 'full'])

export async function runInit({ REPO_ROOT, PROJECT_ROOT }) {
  const CURSOR_DIR = path.join(PROJECT_ROOT, '.cursor')
  const FACTORY_DIR = path.join(PROJECT_ROOT, 'ai-dev-factory')
  const DIST = path.join(REPO_ROOT, 'dist')

  const needsAnalyticsConfig = (value) => INCLUDES_ANALYTICS.has(value)
  const totalSteps = 3 // may become 4 if analytics config needed

  // ── Step 1: Select version ──────────────────────────────────────────────

  step(1, '3–4', 'Выбор варианта установки')
  nl()

  const version = await select('Какой инструмент установить?', [
    { value: 'full',               label: 'full',               desc: '— все инструменты' },
    { value: 'factories',          label: 'factories',          desc: '— analytics-factory + code-factory (без just-do-it)' },
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

  step(2, '3–4', 'Установка агентов и скиллов')

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

  step(3, '3–4', 'Конфигурация')

  fs.mkdirSync(FACTORY_DIR, { recursive: true })
  const configPath = path.join(FACTORY_DIR, 'dev-factory.config.json')

  let config
  if (fs.existsSync(configPath)) {
    config = readJson(configPath, { version: distKey, extensions: {} })
    config.version = distKey
    info(`${c.cyan('ai-dev-factory/dev-factory.config.json')} обновлён (version: ${distKey})`)
  } else {
    config = { version: distKey, extensions: {} }
    success(`Создан ${c.cyan('ai-dev-factory/dev-factory.config.json')}`)
  }

  writeJson(configPath, config)

  // Save manifest
  const manifest = loadManifest(CURSOR_DIR)
  manifest.version = distKey
  manifest.installedAt = new Date().toISOString()
  manifest.agents = copiedAgents
  manifest.skills = copiedSkills
  saveManifest(CURSOR_DIR, manifest)
  success(`Манифест сохранён в ${c.cyan('.cursor/.dev-factory-manifest.json')}`)

  // ── Step 4 (conditional): Analytics GitHub config ───────────────────────

  if (needsAnalyticsConfig(version.value)) {
    step(4, 4, 'Настройка GitHub для board_manager')
    nl()

    info('analytics-factory использует board_manager для создания задач в GitHub Projects V2.')
    info('Укажи репозиторий и номер проекта (можно изменить позже в конфиге).')
    nl()

    const currentOwnerRepo = config.github?.ownerRepo || ''
    const currentProjectNumber = config.github?.projectNumber || ''

    const ownerRepo = await input(
      `owner/repo ${c.gray('(например: myorg/myrepo)')}:`,
      currentOwnerRepo,
    )

    const projectNumber = await input(
      `project number ${c.gray('(номер GitHub Projects V2 board)')}:`,
      currentProjectNumber,
    )

    if (ownerRepo || projectNumber) {
      if (!config.github) config.github = {}
      if (ownerRepo) config.github.ownerRepo = ownerRepo
      if (projectNumber) config.github.projectNumber = projectNumber
      writeJson(configPath, config)
      nl()
      success(`GitHub-настройки сохранены в ${c.cyan('ai-dev-factory/dev-factory.config.json')}`)
    } else {
      nl()
      info('GitHub-настройки пропущены — можно указать позже в конфиге или при запуске board_manager')
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  nl()
  const summaryLines = [
    c.bold('Установка завершена!'),
    '',
    `${c.gray('Вариант:')}   ${c.cyan(version.label)}`,
    `${c.gray('Агенты:')}    ${c.bold(String(copiedAgents.length))}`,
    `${c.gray('Скиллы:')}    ${c.bold(String(copiedSkills.length))}`,
    `${c.gray('Конфиг:')}    ${c.cyan('ai-dev-factory/dev-factory.config.json')}`,
  ]

  if (config.github?.ownerRepo) {
    summaryLines.push(`${c.gray('GitHub:')}    ${c.cyan(config.github.ownerRepo)} / Project #${c.cyan(config.github.projectNumber || '?')}`)
  }

  box(summaryLines)
}

