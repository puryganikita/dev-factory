# theme-mcp

MCP-сервер для работы с документацией дизайн-токенов и утилитарных CSS-классов.

## Установка

Используй инсталлер:

```bash
npx github:puryganikita/dev-factory
# Выбери: Extension → theme-mcp
```

Инсталлер автоматически:
- Скопирует MCP-скрипт в `ai-dev-factory/theme-docs-mcp.ts`
- Добавит сервер `theme-docs` в `.cursor/mcp.json`
- Скопирует скилл `theme-tokens-usage` в `.cursor/skills/`
- Попросит указать путь до документации и сохранит в `ai-dev-factory/dev-factory.config.json`

## Ручная настройка

### Конфиг

В `ai-dev-factory/dev-factory.config.json` укажи путь до папки с документацией:

```json
{
  "extensions": {
    "theme-mcp": {
      "docsDir": "./path/to/theme-docs"
    }
  }
}
```

`docsDir` — относительный путь от корня проекта.

## Формат документации

MCP ожидает папку с `.md`-файлами следующей структуры:

```
docs/
├── overview.md        — реестр всех групп токенов
├── brand.md           — документация группы brand
├── spacing.md         — документация группы spacing
├── typography.md      — документация группы typography
└── ...
```

### overview.md

Реестр групп токенов. Каждая группа — отдельная секция с заголовком `## name`:

```markdown
## brand

Основные цвета бренда: primary, secondary, accent и их производные.

## spacing

Токены отступов: xs, sm, md, lg, xl, 2xl. Используются для padding, margin, gap.

## typography

Стили текста: heading1–heading4, paragraph, caption и их варианты.

## utilities

Утилитарные CSS-классы, объединяющие несколько токенов.
```

MCP использует заголовки `## name` для парсинга списка групп и поиска.

### {groupName}.md

Полная документация по группе токенов. Имя файла должно **точно совпадать** с именем в заголовке `## name` из `overview.md`.

Рекомендуемое содержание:
- CSS-переменные (имя, значение)
- Утилитарные className (имя класса, что делает)
- Figma-маппинг (имя в Figma → токен в коде)
- Примеры использования
- Ограничения / что запрещено

## Инструменты MCP

| Инструмент | Описание |
|---|---|
| `list_theme_token_groups` | Возвращает `overview.md` целиком — реестр всех групп токенов |
| `get_theme_token_group_doc` | Возвращает `{name}.md` — полную документацию по группе |
| `search_theme_tokens` | Поиск по ключевому слову в `overview.md` |
