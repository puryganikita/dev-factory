---
name: image-utils-usage
description: Сохранение base64-изображений на диск через MCP image-utils. Применять при получении скриншотов из Figma MCP (get_screenshot) или любых других base64-изображений, которые нужно сохранить как файл.
---

# Сохранение изображений на диск (image-utils MCP)

## Когда использовать

Используй MCP `image-utils` каждый раз, когда получаешь base64-изображение
(например, из Figma MCP `get_screenshot`) и нужно сохранить его как файл на диске.

## Инструмент

### `save_base64_image`

Декодирует base64-строку и сохраняет как бинарный файл. Автоматически создаёт директории.

```json
{
  "server": "image-utils",
  "toolName": "save_base64_image",
  "arguments": {
    "base64": "<base64-строка без префикса data:image/...;base64,>",
    "filePath": "ai/tasks/task-01-feature/design_context/button_screenshot.png"
  }
}
```

**Параметры:**
- `base64` — чистая base64-строка. Если содержит префикс `data:image/png;base64,` — он будет автоматически удалён.
- `filePath` — путь для сохранения (абсолютный или относительный от корня проекта).

## Рабочий процесс

1. Получи скриншот из Figma MCP: `get_screenshot(nodeId)`
2. Извлеки base64-данные из ответа
3. Сохрани через `save_base64_image` с путём в `design_context/`
