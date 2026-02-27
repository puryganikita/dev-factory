# image-utils-mcp

Утилитарный MCP-сервер для сохранения base64-изображений на диск.

## Установка

Используй инсталлер:

```bash
npx github:puryganikita/dev-factory
# Выбери: Extension → image-utils-mcp
```

Инсталлер автоматически:
- Скопирует MCP-скрипт в `ai-dev-factory/image-utils-mcp.ts`
- Добавит сервер `image-utils` в `.cursor/mcp.json`
- Скопирует скилл `image-utils-usage` в `.cursor/skills/`

Конфигурация не требуется — сервер утилитарный.

## Инструменты MCP

| Инструмент | Описание |
|---|---|
| `save_base64_image` | Декодирует base64-строку и сохраняет как бинарный файл на диск |

## Зачем нужен

Cursor-агент не имеет нативного инструмента для записи бинарных файлов.
Когда Figma MCP `get_screenshot` возвращает скриншот как base64 image content,
этот MCP-сервер позволяет сохранить его на диск как файл.
