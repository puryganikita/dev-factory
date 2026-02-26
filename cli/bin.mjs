#!/usr/bin/env node

import path from 'path'
import { fileURLToPath } from 'url'
import { banner, select, c, nl, divider } from './ui.mjs'
import { runInit } from './init.mjs'
import { runClean } from './clean.mjs'
import { runExtension } from './extension.mjs'
import { runUpdate } from './update.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const PROJECT_ROOT = process.cwd()

banner()

const ctx = { REPO_ROOT, PROJECT_ROOT }

while (true) {
  const scenario = await select('Что делаем?', [
    { value: 'init',      label: 'Init',      desc: '— Инициализация dev-factory в проекте' },
    { value: 'clean',     label: 'Clean',     desc: '— Устранение конфликтов в .cursor' },
    { value: 'extension', label: 'Extension', desc: '— Расширения' },
    { value: 'update',    label: 'Update',    desc: '— Обновление установленных компонентов' },
    { value: 'exit',      label: 'Exit',      desc: '— Выход' },
  ])

  if (scenario.value === 'exit') break

  divider()

  switch (scenario.value) {
    case 'init':
      await runInit(ctx)
      break
    case 'clean':
      await runClean(ctx)
      break
    case 'extension':
      await runExtension(ctx)
      break
    case 'update':
      await runUpdate(ctx)
      break
  }

  nl()
  divider()
}

nl()
console.log(`  ${c.dim('Спасибо за использование')} ${c.bold(c.cyan('Dev Factory'))}${c.dim('!')}`)
nl()
