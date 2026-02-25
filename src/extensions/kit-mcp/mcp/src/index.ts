/**
 * Kit Docs MCP Server
 *
 * Implements MCP (Model Context Protocol) over stdio using JSON-RPC 2.0.
 * No external dependencies — runs with plain Node.js.
 *
 * Reads docs directory from dev-factory.config.json located next to this script
 * (both are placed in ai-dev-factory/ by the installer).
 *
 * Expected docs structure:
 *   overview.md          — registry of all components (## Name + description)
 *   {ComponentName}.md   — full documentation per component
 *
 * Tools:
 *   list_kit_components   — returns overview.md (registry of all components)
 *   get_kit_component_doc — returns full documentation for a specific component
 *   search_kit_components — searches components by keyword
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'

// ─── Config ─────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_NAME = 'dev-factory.config.json'
const EXTENSION_KEY = 'kit-mcp'

let DOCS_DIR: string

async function loadConfig(): Promise<void> {
  // Config lives next to the script in ai-dev-factory/
  const configPath = path.resolve(__dirname, CONFIG_NAME)

  let raw: string
  try {
    raw = await fs.readFile(configPath, 'utf-8')
  } catch {
    process.stderr.write(
      `[kit-docs] Config not found: ${configPath}\n` +
        `Run the dev-factory installer to generate the config.\n`,
    )
    process.exit(1)
  }

  const config = JSON.parse(raw)
  const docsDir = config?.extensions?.[EXTENSION_KEY]?.docsDir

  if (!docsDir) {
    process.stderr.write(
      `[kit-docs] Missing "extensions.${EXTENSION_KEY}.docsDir" in ${CONFIG_NAME}\n`,
    )
    process.exit(1)
  }

  // docsDir is relative to the project root (cwd)
  DOCS_DIR = path.resolve(process.cwd(), docsDir)

  try {
    await fs.access(DOCS_DIR)
  } catch {
    process.stderr.write(
      `[kit-docs] Docs directory not found: ${DOCS_DIR}\n` +
        `Ensure the path in ${configPath} is correct relative to project root.\n`,
    )
    process.exit(1)
  }
}

// ─── JSON-RPC Types ──────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: number | string | null
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

function send(msg: JsonRpcResponse) {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

function ok(id: number | string | null, result: unknown) {
  send({ jsonrpc: '2.0', id, result })
}

function err(id: number | string | null, code: number, message: string) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'list_kit_components',
    description:
      'Возвращает реестр всех UI-компонентов с кратким описанием каждого. Используй как первый шаг для понимания доступных компонентов.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_kit_component_doc',
    description:
      'Возвращает полную документацию по конкретному UI-компоненту: props, область применения, примеры использования. Принимает точное имя компонента.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'Точное имя компонента с заглавной буквы, например: Button, TextField, Accordion',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'search_kit_components',
    description:
      'Поиск UI-компонентов по ключевому слову. Ищет по названию и описанию компонентов. Возвращает список совпадений с кратким описанием.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Ключевое слово для поиска, например: "кнопка", "форма", "таблица", "Button"',
        },
      },
      required: ['query'],
    },
  },
]

// ─── Tool Handlers ───────────────────────────────────────────────────────────

async function listKitComponents() {
  const content = await fs.readFile(path.join(DOCS_DIR, 'overview.md'), 'utf-8')
  return { content: [{ type: 'text', text: content }] }
}

async function getKitComponentDoc(args: unknown) {
  const { name } = args as { name: string }
  const filePath = path.join(DOCS_DIR, `${name}.md`)

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return { content: [{ type: 'text', text: content }] }
  } catch {
    const overview = await fs.readFile(path.join(DOCS_DIR, 'overview.md'), 'utf-8')
    const names = [...overview.matchAll(/^## (\w+)/gm)].map((m) => m[1])
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Компонент "${name}" не найден. Доступные компоненты: ${names.join(', ')}`,
        },
      ],
    }
  }
}

async function searchKitComponents(args: unknown) {
  const { query } = args as { query: string }
  const overview = await fs.readFile(path.join(DOCS_DIR, 'overview.md'), 'utf-8')
  const lower = query.toLowerCase()

  const sections = overview.split(/^## /m).filter(Boolean)
  const matches = sections.filter((section) => section.toLowerCase().includes(lower))

  if (matches.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `По запросу "${query}" ничего не найдено. Используй list_kit_components для просмотра всех компонентов.`,
        },
      ],
    }
  }

  const result = `# Результаты поиска по запросу "${query}"\n\n## ${matches.join('\n## ')}`
  return { content: [{ type: 'text', text: result }] }
}

// ─── Request Dispatcher ──────────────────────────────────────────────────────

async function handleRequest(req: JsonRpcRequest) {
  const id = req.id ?? null

  switch (req.method) {
    case 'initialize': {
      ok(id, {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'kit-docs', version: '1.0.0' },
        capabilities: { tools: {} },
      })
      break
    }

    case 'initialized':
      break

    case 'tools/list': {
      ok(id, { tools: TOOLS })
      break
    }

    case 'tools/call': {
      const { name, arguments: args } = req.params as { name: string; arguments: unknown }
      try {
        let result: unknown
        if (name === 'list_kit_components') result = await listKitComponents()
        else if (name === 'get_kit_component_doc') result = await getKitComponentDoc(args)
        else if (name === 'search_kit_components') result = await searchKitComponents(args)
        else {
          err(id, -32601, `Unknown tool: ${name}`)
          break
        }
        ok(id, result)
      } catch (e) {
        err(id, -32603, e instanceof Error ? e.message : String(e))
      }
      break
    }

    case 'ping': {
      ok(id, {})
      break
    }

    default: {
      if (id !== null && id !== undefined) {
        err(id, -32601, `Method not found: ${req.method}`)
      }
    }
  }
}

// ─── stdio Transport ─────────────────────────────────────────────────────────

await loadConfig()

const rl = readline.createInterface({ input: process.stdin, terminal: false })

rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let req: JsonRpcRequest
  try {
    req = JSON.parse(trimmed) as JsonRpcRequest
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
    return
  }
  handleRequest(req).catch((e) => {
    err(req.id ?? null, -32603, e instanceof Error ? e.message : String(e))
  })
})

process.stderr.write(`Kit Docs MCP server running on stdio (docs: ${DOCS_DIR})\n`)
