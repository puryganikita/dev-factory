import fs from 'fs'
import path from 'path'
import { select, step, success, info, warn, input, createSpinner, c, box, nl } from './ui.mjs'
import { loadManifest, saveManifest, readJson, writeJson } from './helpers.mjs'

export async function runExtension({ REPO_ROOT, PROJECT_ROOT }) {
  const CURSOR_DIR = path.join(PROJECT_ROOT, '.cursor')
  const FACTORY_DIR = path.join(PROJECT_ROOT, 'ai-dev-factory')
  const DIST = path.join(REPO_ROOT, 'dist')
  const EXT_DIR = path.join(DIST, 'extensions')

  if (!fs.existsSync(EXT_DIR)) {
    warn('Папка dist/extensions/ не найдена')
    return
  }

  // ── Step 1: List extensions ─────────────────────────────────────────────

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

  // ── Step 2: Install ─────────────────────────────────────────────────────

  step(2, 3, `Установка ${c.cyan(extName)}`)

  const spinner = createSpinner('Устанавливаю...').start()

  const hasMcpDir = fs.existsSync(path.join(extPath, 'mcp'))
  const hasMcpJson = fs.existsSync(path.join(extPath, 'mcp.json'))
  const hasSkills = fs.existsSync(path.join(extPath, 'skills'))

  const installedSkills = []
  const installedMcpServers = []
  const copiedMcpScripts = []

  // ── Skills ──────────────────────────────────────────────────────────────

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

  // ── MCP ─────────────────────────────────────────────────────────────────

  if (hasMcpDir && hasMcpJson) {
    fs.mkdirSync(FACTORY_DIR, { recursive: true })

    const extMcpConfig = readJson(path.join(extPath, 'mcp.json'))
    if (extMcpConfig && extMcpConfig.mcpServers) {
      const cursorMcpPath = path.join(CURSOR_DIR, 'mcp.json')
      const cursorMcp = readJson(cursorMcpPath, { mcpServers: {} })
      if (!cursorMcp.mcpServers) cursorMcp.mcpServers = {}

      // Copy MCP script to ai-dev-factory/ and wire up .cursor/mcp.json
      const mcpSrcScript = path.join(extPath, 'mcp', 'src', 'index.ts')

      for (const [serverName, serverConfig] of Object.entries(extMcpConfig.mcpServers)) {
        const scriptName = `${serverName}-mcp.ts`
        const destScript = path.join(FACTORY_DIR, scriptName)

        // Copy the MCP server script into ai-dev-factory/
        if (fs.existsSync(mcpSrcScript)) {
          fs.copyFileSync(mcpSrcScript, destScript)
          copiedMcpScripts.push(scriptName)
        }

        // Replace placeholder with absolute path to ai-dev-factory/
        const resolved = JSON.parse(
          JSON.stringify(serverConfig).replace(
            /<AI_DEV_FACTORY_DIR>/g,
            FACTORY_DIR,
          ),
        )
        cursorMcp.mcpServers[serverName] = resolved
        installedMcpServers.push(serverName)
      }

      writeJson(cursorMcpPath, cursorMcp)
    }
  }

  spinner.succeed(`Расширение ${c.cyan(extName)} установлено`)

  // ── Report ──────────────────────────────────────────────────────────────

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

  // ── Step 3: Config ──────────────────────────────────────────────────────

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

  // ── Update manifest ─────────────────────────────────────────────────────

  const manifest = loadManifest(CURSOR_DIR)
  if (!manifest.extensions) manifest.extensions = {}
  manifest.extensions[extName] = {
    installedAt: new Date().toISOString(),
    mcpServers: installedMcpServers,
    skills: installedSkills,
    mcpScripts: copiedMcpScripts,
  }
  saveManifest(CURSOR_DIR, manifest)

  // ── Summary ─────────────────────────────────────────────────────────────

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
