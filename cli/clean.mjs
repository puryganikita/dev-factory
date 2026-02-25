import fs from 'fs'
import path from 'path'
import { step, success, info, warn, error, confirm, c, box, nl } from './ui.mjs'
import { loadManifest, saveManifest } from './helpers.mjs'

export async function runClean({ REPO_ROOT, PROJECT_ROOT }) {
  const CURSOR_DIR = path.join(PROJECT_ROOT, '.cursor')
  const manifest = loadManifest(CURSOR_DIR)

  const agentsDir = path.join(CURSOR_DIR, 'agents')
  const skillsDir = path.join(CURSOR_DIR, 'skills')

  // ── Step 1: Scan ────────────────────────────────────────────────────────

  step(1, 3, 'Сканирование .cursor/')

  const knownAgents = new Set(manifest.agents || [])
  const knownSkills = new Set(manifest.skills || [])

  // Collect extension-owned skills
  if (manifest.extensions) {
    for (const ext of Object.values(manifest.extensions)) {
      if (ext.skills) ext.skills.forEach(s => knownSkills.add(s))
    }
  }

  const foreignAgents = []
  const foreignSkills = []

  if (fs.existsSync(agentsDir)) {
    for (const f of fs.readdirSync(agentsDir)) {
      if (f.endsWith('.md') && !knownAgents.has(f)) {
        foreignAgents.push(f)
      }
    }
  }

  if (fs.existsSync(skillsDir)) {
    for (const f of fs.readdirSync(skillsDir)) {
      const full = path.join(skillsDir, f)
      if (fs.statSync(full).isDirectory() && !knownSkills.has(f)) {
        foreignSkills.push(f)
      }
    }
  }

  const totalForeign = foreignAgents.length + foreignSkills.length

  if (totalForeign === 0) {
    nl()
    success('Конфликтов не найдено — все файлы принадлежат dev-factory')
    return
  }

  // ── Step 2: Show ────────────────────────────────────────────────────────

  step(2, 3, 'Найденные сторонние файлы')
  nl()

  if (foreignAgents.length > 0) {
    info(`${c.bold('Agents')} (${foreignAgents.length}):`)
    for (const f of foreignAgents) {
      console.log(`    ${c.red('−')} ${c.dim('.cursor/agents/')}${f}`)
    }
  }

  if (foreignSkills.length > 0) {
    info(`${c.bold('Skills')} (${foreignSkills.length}):`)
    for (const f of foreignSkills) {
      console.log(`    ${c.red('−')} ${c.dim('.cursor/skills/')}${f}/`)
    }
  }

  nl()
  warn(`Будет удалено ${c.bold(String(totalForeign))} элементов`)
  nl()

  // ── Step 3: Confirm & delete ────────────────────────────────────────────

  const ok = await confirm('Удалить перечисленные файлы?')

  if (!ok) {
    nl()
    info('Отменено')
    return
  }

  step(3, 3, 'Удаление')

  let deleted = 0

  for (const f of foreignAgents) {
    fs.unlinkSync(path.join(agentsDir, f))
    deleted++
  }

  for (const f of foreignSkills) {
    fs.rmSync(path.join(skillsDir, f), { recursive: true })
    deleted++
  }

  success(`Удалено ${c.bold(String(deleted))} элементов`)

  nl()
  box([
    c.bold('Очистка завершена!'),
    '',
    `${c.gray('Удалено агентов:')} ${c.bold(String(foreignAgents.length))}`,
    `${c.gray('Удалено скиллов:')} ${c.bold(String(foreignSkills.length))}`,
  ])
}
