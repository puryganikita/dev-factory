import fs from 'fs'
import path from 'path'
import { step, success, info, warn, createSpinner, c, box, nl } from './ui.mjs'
import {
  loadManifest, saveManifest, collectAllKnownFiles, readJson, writeJson,
  cleanOldFiles, cleanOldSkills, copyAgents, copySkills,
} from './helpers.mjs'

export async function runUpdate({ REPO_ROOT, PROJECT_ROOT }) {
  const CURSOR_DIR = path.join(PROJECT_ROOT, '.cursor')
  const FACTORY_DIR = path.join(PROJECT_ROOT, 'ai-dev-factory')
  const DIST = path.join(REPO_ROOT, 'dist')
  const EXT_DIR = path.join(DIST, 'extensions')

  const manifest = loadManifest(CURSOR_DIR)

  const hasCore = !!manifest.version
  const extNames = Object.keys(manifest.extensions || {})
  const hasExtensions = extNames.length > 0

  if (!hasCore && !hasExtensions) {
    warn('Ничего не установлено — сначала выполни Init или установи расширение')
    return
  }

  const totalSteps = (hasCore ? 1 : 0) + (hasExtensions ? 1 : 0) + 1
  let currentStep = 0

  // ── Update core ───────────────────────────────────────────────────────────

  let copiedAgents = []
  let copiedSkills = []

  if (hasCore) {
    currentStep++
    step(currentStep, totalSteps, `Обновление core (${c.cyan(manifest.version)})`)

    const srcDir = path.join(DIST, manifest.version)

    if (!fs.existsSync(srcDir)) {
      warn(`Dist-директория не найдена: ${srcDir} — пропускаю core`)
    } else {
      const spinner = createSpinner('Обновляю агентов и скиллы...').start()

      const agentsDest = path.join(CURSOR_DIR, 'agents')
      const skillsDest = path.join(CURSOR_DIR, 'skills')

      const allKnown = collectAllKnownFiles(DIST)
      cleanOldFiles(agentsDest, allKnown.agents)
      cleanOldSkills(skillsDest, allKnown.skills)

      copiedAgents = copyAgents(path.join(srcDir, 'agents'), agentsDest)
      copiedSkills = copySkills(path.join(srcDir, 'skills'), skillsDest)

      manifest.agents = copiedAgents
      manifest.skills = copiedSkills
      manifest.installedAt = new Date().toISOString()

      spinner.succeed('Core обновлён')
      nl()
      info(`Агенты: ${c.bold(String(copiedAgents.length))} файлов`)
      info(`Скиллы: ${c.bold(String(copiedSkills.length))} папок`)
    }
  }

  // ── Update extensions ─────────────────────────────────────────────────────

  const updatedExtensions = []

  if (hasExtensions) {
    currentStep++
    step(currentStep, totalSteps, `Обновление расширений (${c.cyan(String(extNames.length))})`)

    for (const extName of extNames) {
      const extPath = path.join(EXT_DIR, extName)

      if (!fs.existsSync(extPath)) {
        nl()
        warn(`Расширение ${c.cyan(extName)} не найдено в dist/extensions/ — пропускаю`)
        continue
      }

      const spinner = createSpinner(`Обновляю ${extName}...`).start()

      const hasSkillsDir = fs.existsSync(path.join(extPath, 'skills'))
      const hasMcpDir = fs.existsSync(path.join(extPath, 'mcp'))
      const hasMcpJson = fs.existsSync(path.join(extPath, 'mcp.json'))

      const installedSkills = []
      const installedMcpServers = []
      const copiedMcpScripts = []

      // Re-copy skills
      if (hasSkillsDir) {
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

      // Re-copy MCP scripts and update mcp.json entries
      if (hasMcpDir && hasMcpJson) {
        fs.mkdirSync(FACTORY_DIR, { recursive: true })

        const extMcpConfig = readJson(path.join(extPath, 'mcp.json'))
        if (extMcpConfig?.mcpServers) {
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
              JSON.stringify(serverConfig).replace(/<AI_DEV_FACTORY_DIR>/g, safePath),
            )
            cursorMcp.mcpServers[serverName] = resolved
            installedMcpServers.push(serverName)
          }

          writeJson(cursorMcpPath, cursorMcp)
        }
      }

      // Update manifest entry (preserve installedAt from original install)
      if (!manifest.extensions) manifest.extensions = {}
      manifest.extensions[extName] = {
        installedAt: manifest.extensions[extName]?.installedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mcpServers: installedMcpServers,
        skills: installedSkills,
        mcpScripts: copiedMcpScripts,
      }

      spinner.succeed(`${extName} обновлён`)
      updatedExtensions.push(extName)
    }
  }

  // ── Save manifest ─────────────────────────────────────────────────────────

  currentStep++
  step(currentStep, totalSteps, 'Сохранение')

  saveManifest(CURSOR_DIR, manifest)
  success(`Манифест обновлён`)

  // ── Summary ───────────────────────────────────────────────────────────────

  nl()
  const lines = [c.bold('Обновление завершено!'), '']

  if (hasCore) {
    lines.push(`${c.gray('Core:')}          ${c.cyan(manifest.version)}`)
    lines.push(`${c.gray('Агенты:')}        ${c.bold(String(copiedAgents.length))}`)
    lines.push(`${c.gray('Скиллы:')}        ${c.bold(String(copiedSkills.length))}`)
  }

  if (updatedExtensions.length > 0) {
    lines.push(`${c.gray('Расширения:')}    ${updatedExtensions.map(s => c.cyan(s)).join(', ')}`)
  }

  lines.push('', c.dim('Пользовательские настройки (dev-factory.config.json) сохранены'))

  if (updatedExtensions.length > 0) {
    lines.push(c.dim('Перезапусти Cursor для применения изменений MCP'))
  }

  box(lines)
}
