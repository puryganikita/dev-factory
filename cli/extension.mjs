import fs from 'fs'
import path from 'path'
import { select, step, success, info, warn, input, createSpinner, c, box, nl, divider } from './ui.mjs'
import { loadManifest, saveManifest, readJson, writeJson } from './helpers.mjs'

export async function runExtension({ REPO_ROOT, PROJECT_ROOT }) {
  const CURSOR_DIR = path.join(PROJECT_ROOT, '.cursor')
  const FACTORY_DIR = path.join(PROJECT_ROOT, 'ai-dev-factory')
  const DIST = path.join(REPO_ROOT, 'dist')
  const EXT_DIR = path.join(DIST, 'extensions')

  while (true) {
    const action = await select('Расширения — что делаем?', [
      { value: 'install',   label: 'Install',   desc: '— Установить расширение' },
      { value: 'uninstall', label: 'Uninstall', desc: '— Удалить установленное расширение' },
      { value: 'back',      label: 'Back',      desc: '— Назад в главное меню' },
    ])

    if (action.value === 'back') return

    divider()

    if (action.value === 'install') {
      await installExtension({ EXT_DIR, CURSOR_DIR, FACTORY_DIR })
    } else if (action.value === 'uninstall') {
      await uninstallExtension({ CURSOR_DIR, FACTORY_DIR })
    }

    nl()
    divider()
  }
}

// ── Install Extension ────────────────────────────────────────────────────────

async function installExtension({ EXT_DIR, CURSOR_DIR, FACTORY_DIR }) {
  if (!fs.existsSync(EXT_DIR)) {
    warn('Папка dist/extensions/ не найдена')
    return
  }

  // ── Step 1: List extensions ───────────────────────────────────────────────

  step(1, 3, 'Выбор расширения')
  nl()

  const extensions = fs.readdirSync(EXT_DIR).filter((f) => {
    return fs.statSync(path.join(EXT_DIR, f)).isDirectory()
  })

  if (extensions.length === 0) {
    info('Нет доступных расширений')
    return
  }

  const options = extensions.map((name) => {
    const extPath = path.join(EXT_DIR, name)
    const hasMcp = fs.existsSync(path.join(extPath, 'mcp'))
    const hasSkills = fs.existsSync(path.join(extPath, 'skills'))

    const parts = []
    if (hasMcp) parts.push('MCP')
    if (hasSkills) parts.push('skills')
    let desc = `— ${parts.join(' + ')}`

    const readme = path.join(extPath, 'README.md')
    if (fs.existsSync(readme)) {
      const firstLine = fs.readFileSync(readme, 'utf8').split('\n').find(l => l.startsWith('# '))
      if (firstLine) {
        desc = `— ${firstLine.replace(/^#\s*/, '')}` + ` (${parts.join(' + ')})`
      }
    }

    return { value: name, label: name, desc }
  })

  const chosen = await select('Какое расширение установить?', options)
  const extName = chosen.value
  const extPath = path.join(EXT_DIR, extName)

  // ── Step 2: Install ───────────────────────────────────────────────────────

  step(2, 3, `Установка ${c.cyan(extName)}`)

  const spinner = createSpinner('Устанавливаю...').start()

  const hasMcpDir = fs.existsSync(path.join(extPath, 'mcp'))
  const hasMcpJson = fs.existsSync(path.join(extPath, 'mcp.json'))
  const hasSkills = fs.existsSync(path.join(extPath, 'skills'))

  const installedSkills = []
  const installedMcpServers = []
  const copiedMcpScripts = []

  // ── Skills ────────────────────────────────────────────────────────────────

  if (hasSkills) {
    const skillsSrc = path.join(extPath, 'skills')
    const skillsDest = path.join(CURSOR_DIR, 'skills')

    for (const folder of fs.readdirSync(skillsSrc)) {
      const skillFile = path.join(skillsSrc, folder, 'SKILL.md')
      if (!fs.existsSync(skillFile)) continue
      const destFolder = path.join(skillsDest, folder)
      fs.mkdirSync(destFolder, { recursive: true })
      fs.copyFileSync(skillFile, path.join(destFolder, 'SKILL.md'))
      installedSkills.push(folder)
    }
  }

  // ── MCP ───────────────────────────────────────────────────────────────────

  if (hasMcpDir && hasMcpJson) {
    fs.mkdirSync(FACTORY_DIR, { recursive: true })

    const extMcpConfig = readJson(path.join(extPath, 'mcp.json'))
    if (extMcpConfig && extMcpConfig.mcpServers) {
      const cursorMcpPath = path.join(CURSOR_DIR, 'mcp.json')
      const cursorMcp = readJson(cursorMcpPath, { mcpServers: {} })
      if (!cursorMcp.mcpServers) cursorMcp.mcpServers = {}

      const mcpSrcScript = path.join(extPath, 'mcp', 'src', 'index.ts')

      for (const [serverName, serverConfig] of Object.entries(extMcpConfig.mcpServers)) {
        const scriptName = `${serverName}-mcp.ts`
        const destScript = path.join(FACTORY_DIR, scriptName)

        if (fs.existsSync(mcpSrcScript)) {
          fs.copyFileSync(mcpSrcScript, destScript)
          copiedMcpScripts.push(scriptName)
        }

        const safePath = FACTORY_DIR.replace(/\\/g, '/')
        const resolved = JSON.parse(
          JSON.stringify(serverConfig).replace(
            /<AI_DEV_FACTORY_DIR>/g,
            safePath,
          ),
        )
        cursorMcp.mcpServers[serverName] = resolved
        installedMcpServers.push(serverName)
      }

      writeJson(cursorMcpPath, cursorMcp)
    }
  }

  spinner.succeed(`Расширение ${c.cyan(extName)} установлено`)

  // ── Report ────────────────────────────────────────────────────────────────

  nl()
  if (installedSkills.length > 0) {
    info(`Скиллы: ${installedSkills.map(s => c.cyan(s)).join(', ')}`)
  }
  if (installedMcpServers.length > 0) {
    info(`MCP-серверы: ${installedMcpServers.map(s => c.cyan(s)).join(', ')}`)
  }
  if (copiedMcpScripts.length > 0) {
    info(`MCP-скрипты: ${copiedMcpScripts.map(s => c.cyan(`ai-dev-factory/${s}`)).join(', ')}`)
  }

  // ── Step 3: Config ────────────────────────────────────────────────────────

  step(3, 3, 'Конфигурация')

  if (hasMcpDir) {
    const configPath = path.join(FACTORY_DIR, 'dev-factory.config.json')
    const config = readJson(configPath, { extensions: {} })
    if (!config.extensions) config.extensions = {}

    if (!config.extensions[extName]) {
      nl()
      info(`Расширение ${c.cyan(extName)} использует MCP-сервер, которому нужен путь до документации.`)
      nl()

      const docsDir = await input(
        `Путь до документации для ${c.cyan(extName)} (относительно корня проекта):`,
        `./docs/${extName}`,
      )

      config.extensions[extName] = { docsDir }
      writeJson(configPath, config)
      nl()
      success(`Конфиг обновлён: ${c.cyan('ai-dev-factory/dev-factory.config.json')}`)
    } else {
      info(`Секция ${c.cyan(extName)} уже есть в конфиге — не перезаписываю`)
    }
  } else {
    info('Расширение без MCP — конфигурация не требуется')
  }

  // ── Update manifest ───────────────────────────────────────────────────────

  const manifest = loadManifest(CURSOR_DIR)
  if (!manifest.extensions) manifest.extensions = {}
  manifest.extensions[extName] = {
    installedAt: new Date().toISOString(),
    mcpServers: installedMcpServers,
    skills: installedSkills,
    mcpScripts: copiedMcpScripts,
  }
  saveManifest(CURSOR_DIR, manifest)

  // ── Summary ───────────────────────────────────────────────────────────────

  nl()
  const summaryLines = [c.bold(`Расширение ${extName} установлено!`), '']
  if (installedSkills.length > 0)
    summaryLines.push(`${c.gray('Скиллы:')}      ${installedSkills.join(', ')}`)
  if (installedMcpServers.length > 0)
    summaryLines.push(`${c.gray('MCP:')}         ${installedMcpServers.join(', ')}`)
  if (copiedMcpScripts.length > 0)
    summaryLines.push(`${c.gray('Скрипты:')}     ${copiedMcpScripts.map(s => `ai-dev-factory/${s}`).join(', ')}`)
  if (hasMcpDir)
    summaryLines.push('', c.dim('Перезапусти Cursor для активации MCP-сервера'))

  box(summaryLines)
}

// ── Uninstall Extension ──────────────────────────────────────────────────────

async function uninstallExtension({ CURSOR_DIR, FACTORY_DIR }) {
  const manifest = loadManifest(CURSOR_DIR)
  const installed = Object.keys(manifest.extensions || {})

  if (installed.length === 0) {
    info('Нет установленных расширений')
    return
  }

  // ── Step 1: Select ────────────────────────────────────────────────────────

  step(1, 2, 'Выбор расширения для удаления')
  nl()

  const options = installed.map((name) => {
    const ext = manifest.extensions[name]
    const parts = []
    if (ext.skills?.length) parts.push(`skills: ${ext.skills.length}`)
    if (ext.mcpServers?.length) parts.push(`MCP: ${ext.mcpServers.join(', ')}`)
    return { value: name, label: name, desc: parts.length ? `— ${parts.join(', ')}` : '' }
  })

  const chosen = await select('Какое расширение удалить?', options)
  const extName = chosen.value
  const ext = manifest.extensions[extName]

  // ── Step 2: Remove ────────────────────────────────────────────────────────

  step(2, 2, `Удаление ${c.cyan(extName)}`)

  const spinner = createSpinner('Удаляю...').start()

  let removedSkills = 0
  let removedMcp = 0
  let removedScripts = 0

  // Remove skills
  if (ext.skills) {
    const skillsDir = path.join(CURSOR_DIR, 'skills')
    for (const skill of ext.skills) {
      const skillPath = path.join(skillsDir, skill)
      if (fs.existsSync(skillPath)) {
        fs.rmSync(skillPath, { recursive: true })
        removedSkills++
      }
    }
  }

  // Remove MCP server entries from .cursor/mcp.json
  if (ext.mcpServers) {
    const cursorMcpPath = path.join(CURSOR_DIR, 'mcp.json')
    const cursorMcp = readJson(cursorMcpPath)
    if (cursorMcp?.mcpServers) {
      for (const server of ext.mcpServers) {
        if (cursorMcp.mcpServers[server]) {
          delete cursorMcp.mcpServers[server]
          removedMcp++
        }
      }
      writeJson(cursorMcpPath, cursorMcp)
    }
  }

  // Remove MCP scripts from ai-dev-factory/
  if (ext.mcpScripts) {
    for (const script of ext.mcpScripts) {
      const scriptPath = path.join(FACTORY_DIR, script)
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath)
        removedScripts++
      }
    }
  }

  // Remove extension config from dev-factory.config.json
  const configPath = path.join(FACTORY_DIR, 'dev-factory.config.json')
  const config = readJson(configPath)
  if (config?.extensions?.[extName]) {
    delete config.extensions[extName]
    writeJson(configPath, config)
  }

  // Remove from manifest
  delete manifest.extensions[extName]
  saveManifest(CURSOR_DIR, manifest)

  spinner.succeed(`Расширение ${c.cyan(extName)} удалено`)

  // ── Summary ───────────────────────────────────────────────────────────────

  nl()
  box([
    c.bold(`Расширение ${extName} удалено!`),
    '',
    `${c.gray('Скиллов удалено:')}      ${c.bold(String(removedSkills))}`,
    `${c.gray('MCP-серверов удалено:')} ${c.bold(String(removedMcp))}`,
    `${c.gray('Скриптов удалено:')}     ${c.bold(String(removedScripts))}`,
    '',
    c.dim('Перезапусти Cursor для применения изменений'),
  ])
}
