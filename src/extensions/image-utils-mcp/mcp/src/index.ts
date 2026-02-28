/**
 * Image Utils MCP Server
 *
 * Implements MCP (Model Context Protocol) over stdio using JSON-RPC 2.0.
 * No external dependencies — runs with plain Node.js.
 *
 * Utility server for saving base64-encoded images to disk.
 * Used by design_analyst to persist Figma screenshots and by other agents
 * that need to write binary image data received from MCP tools.
 *
 * Tools:
 *   save_base64_image — decodes base64 string and writes binary file to disk
 */

import fs from 'fs/promises'
import path from 'path'
import readline from 'readline'

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
    name: 'save_base64_image',
    description:
      'Декодирует base64-строку и сохраняет как бинарный файл на диск. ' +
      'Используй для сохранения скриншотов, полученных из Figma MCP или других источников. ' +
      'Автоматически создаёт промежуточные директории.',
    inputSchema: {
      type: 'object',
      properties: {
        base64: {
          type: 'string',
          description:
            'Base64-строка с данными изображения (без префикса data:image/...;base64,). ' +
            'Если префикс присутствует, он будет автоматически удалён.',
        },
        filePath: {
          type: 'string',
          description:
            'Путь для сохранения файла. Может быть абсолютным или относительным (от cwd). ' +
            'Например: ai/tasks/task-01-feature/design_context/button_screenshot.png',
        },
      },
      required: ['base64', 'filePath'],
    },
  },
]

// ─── Tool Handlers ───────────────────────────────────────────────────────────

async function saveBase64Image(args: unknown) {
  const { base64, filePath } = args as { base64: string; filePath: string }

  if (!base64 || !filePath) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Both "base64" and "filePath" are required.' }],
    }
  }

  const cleaned = base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '')

  const absolutePath = path.resolve(process.cwd(), filePath)

  await fs.mkdir(path.dirname(absolutePath), { recursive: true })

  const buffer = Buffer.from(cleaned, 'base64')
  await fs.writeFile(absolutePath, buffer)

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          saved: true,
          absolutePath,
          sizeBytes: buffer.length,
        }),
      },
    ],
  }
}

// ─── Request Dispatcher ──────────────────────────────────────────────────────

async function handleRequest(req: JsonRpcRequest) {
  const id = req.id ?? null

  switch (req.method) {
    case 'initialize': {
      ok(id, {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'image-utils', version: '1.0.0' },
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
      const { name, arguments: toolArgs } = req.params as { name: string; arguments: unknown }
      try {
        if (name === 'save_base64_image') {
          const result = await saveBase64Image(toolArgs)
          ok(id, result)
        } else {
          err(id, -32601, `Unknown tool: ${name}`)
        }
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

process.stderr.write('Image Utils MCP server running on stdio\n')
