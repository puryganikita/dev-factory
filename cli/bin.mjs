#!/usr/bin/env node

import path from 'path'
import { fileURLToPath } from 'url'
import { banner, select, c, nl, divider } from './ui.mjs'
import { runInit } from './init.mjs'
import { runClean } from './clean.mjs'
import { runExtension } from './extension.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const PROJECT_ROOT = process.cwd()

banner()

const scenario = await select('Что делаем?', [
  { value: 'init',      label: 'Init',      desc: '— Инициализация dev-factory в проекте' },
  { value: 'clean',     label: 'Clean',     desc: '— Устранение конфликтов в .cursor' },
  { value: 'extension', label: 'Extension', desc: '— Установка расширения' },
])

divider()

switch (scenario.value) {
  case 'init':
    await runInit({ REPO_ROOT, PROJECT_ROOT })
    break
  case 'clean':
    await runClean({ REPO_ROOT, PROJECT_ROOT })
    break
  case 'extension':
    await runExtension({ REPO_ROOT, PROJECT_ROOT })
    break
}

nl()
console.log(`  ${c.dim('Спасибо за использование')} ${c.bold(c.cyan('Dev Factory'))}${c.dim('!')}`)
nl()
