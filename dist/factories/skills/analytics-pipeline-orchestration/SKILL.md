---
name: analytics-pipeline-orchestration
description: Оркестрирует аналитический конвейер analytics-factory. Начинает с сегментации задания, затем маршрутизирует по типу задачи и домену, управляет параллельным запуском аналитиков (в том числе параллельно по сегментам), передаёт результаты в board_manager для создания задач в GitHub Projects V2. Используй при вызове любого агента analytics-factory или при запросе "запусти аналитику".
---

# Оркестрация аналитического конвейера

## Структура конвейера

```
Пользователь → @segment_analyst → segment_analyst_output.md (SEGMENT_MODE)
                    ↓
         [SEGMENT_MODE: single]
            @analyst → analyst_output.md (TASK_TYPE + TASK_DOMAIN + ANALYSIS_MODE)
                                ↓
                [ANALYSIS_MODE: full, TASK_DOMAIN: frontend/fullstack]
                @design_analyst ‖ @component_analyst   (параллельно)
                                ↓
                [ANALYSIS_MODE: full, TASK_DOMAIN: backend/infra/other]
                @component_analyst                     (только один)
                                ↓
                @final_analyst → final_analyst_output.md + subtasks/
                                ↓
                [ANALYSIS_MODE: simple]
                analyst сам пишет final_analyst_output.md
                                ↓
            @board_manager → board_output.md (issues в GitHub Projects V2)

         [SEGMENT_MODE: multi]
            Для КАЖДОГО сегмента ПАРАЛЛЕЛЬНО:
              @analyst → маршрутизация → @final_analyst
            (путь = папка сегмента)
                                ↓
            @board_manager → board_output.md (parent issues + sub-issues)
```

## Главное правило — оркестратор НЕ выполняет работу

Ты — диспетчер. Твоя единственная функция — вызывать агентов и передавать им параметры.
Каждый агент самодостаточен: он сам читает файлы, сам собирает контекст, сам использует MCP.

**Запрещено:**
- Использовать MCP-инструменты (Figma, браузер, БД, документация и др.)
- Читать файлы проекта (кроме output-файлов агентов для определения маршрута)
- Создавать, редактировать или удалять файлы (кроме создания папок сегментов при multi)
- Собирать контекст для агентов — каждый агент сам получает нужный ему контекст
- Выполнять подготовительные действия перед вызовом первого агента
- Анализировать код проекта, дизайн, API или любые артефакты

**Первое действие** после получения задачи — вызов `@segment_analyst`.

**Единственное исключение для чтения файлов:** output-файлы агентов (`segment_analyst_output.md`,
`analyst_output.md`, `final_analyst_output.md`) — оркестратор читает их для определения следующего шага маршрута.

## Что передавать каждому агенту

| Агент | Что передавать |
|-------|----------------|
| `@segment_analyst` | Задачу пользователя дословно + путь к папке задачи |
| `@analyst` (при single) | Задачу пользователя дословно + путь к папке задачи |
| `@analyst` (при multi) | Путь к папке сегмента + «Задача для аналитика» + «Границы контекста» из segment_analyst_output.md |
| `@design_analyst` | Только путь к папке задачи (или папке сегмента при multi) |
| `@component_analyst` | Только путь к папке задачи (или папке сегмента при multi) |
| `@final_analyst` | Только путь к папке задачи (или папке сегмента при multi) |
| `@board_manager` | Путь к корневой папке задачи + owner/repo + project_number + github_method (`gh` или `mcp`) |

При создании агента, открывай ему доступ до папки .cursor/skills (открывай доступ ко всем skills) - агент сам определит какие skills он должен использовать.

## Этап 0: Сегментация

**Первое действие** после получения задачи — вызов `@segment_analyst`.

После завершения прочитай `segment_analyst_output.md` и определи `SEGMENT_MODE`:

### SEGMENT_MODE: single

Конвейер работает как обычно — переходи к Этапу 1 с путём к папке задачи.

### SEGMENT_MODE: multi

1. Создай папки для каждого сегмента: `ai/tasks/task-<NN>-<name>/segments/segment-NN-<name>/`
2. Запусти `@analyst` **параллельно** для каждого сегмента — каждому передай:
   - Путь к папке сегмента
   - «Задача для аналитика» из соответствующего сегмента в segment_analyst_output.md
   - «Границы контекста» из соответствующего сегмента в segment_analyst_output.md
3. После завершения всех `@analyst` — для каждого сегмента прочитай его `analyst_output.md` и маршрутизируй по стандартным правилам (Этап 1), подставляя путь к папке сегмента
4. Параллельные этапы (design_analyst ‖ component_analyst) для разных сегментов можно запускать параллельно
5. После завершения всех сегментов — один запуск `@board_manager` с путём к корневой папке задачи

## Этап 1: Классификация (analyst)

При `SEGMENT_MODE: single` — вызови `@analyst` с задачей пользователя и путём к папке задачи.
При `SEGMENT_MODE: multi` — `@analyst` уже запущен на этапе 0.

После завершения прочитай `analyst_output.md` и определи `ANALYSIS_MODE`:

- `ANALYSIS_MODE: simple` → `@analyst` сам написал `final_analyst_output.md` → переходи к Board Manager
- `ANALYSIS_MODE: full` → переходи к Этапу 2

## Этап 2: Доменная маршрутизация [full analysis]

Состав [full analysis] зависит от `TASK_DOMAIN`:

| TASK_DOMAIN | [full analysis] |
|-------------|-----------------|
| `frontend` | `@design_analyst` ‖ `@component_analyst` → `@final_analyst` |
| `fullstack` | `@design_analyst` ‖ `@component_analyst` → `@final_analyst` |
| `backend` | `@component_analyst` → `@final_analyst` (design_analyst пропускается) |
| `infra` | `@component_analyst` → `@final_analyst` (design_analyst пропускается) |
| `other` | `@component_analyst` → `@final_analyst` (design_analyst пропускается) |

## Параллельный запуск

**Параллельный запуск = несколько вызовов Task в ОДНОМ ответе агента.**

```
← один ответ содержит:
  @design_analyst (папка=ai/tasks/task-01/)
  @component_analyst (папка=ai/tasks/task-01/)
← оба запущены параллельно
```

При `SEGMENT_MODE: multi` параллелизм распространяется и на сегменты:

```
← один ответ содержит:
  @analyst (папка=segments/segment-01-homepage/)
  @analyst (папка=segments/segment-02-catalog/)
  @analyst (папка=segments/segment-03-profile/)
← все запущены параллельно
```

## Board Manager — завершение конвейера

`@board_manager` запускается **всегда** в конце конвейера (и при simple, и при full, и при single, и при multi).

При `SEGMENT_MODE: multi` — `@board_manager` получает путь к **корневой** папке задачи (не к папке сегмента). Он сам прочитает `segment_analyst_output.md` и обработает все сегменты.

### Перед запуском board_manager — выбор метода доступа к GitHub

Оркестратор **обязан** определить метод доступа к GitHub перед запуском board_manager.
Для этого выполни два шага:

**Шаг 1: Проверь доступность методов**
- **gh CLI:** выполни `gh auth status` через Shell. Если exit code 0 — gh доступен и авторизован.
- **GitHub MCP:** проверь наличие MCP-сервера с GitHub-инструментами среди доступных MCP (по наличию инструментов `create_issue` или аналогичных).

**Шаг 2: Спроси пользователя**

Задай пользователю вопрос с результатами проверки. Формат:

```
📋 Для создания задач на GitHub board нужно выбрать метод доступа:

1️⃣ gh CLI [✅ доступен / ❌ не найден]
   Требования: установлен gh (https://cli.github.com), авторизация через `gh auth login`

2️⃣ GitHub MCP [✅ доступен / ❌ не найден]
   Требования: подключён GitHub MCP-сервер в Cursor (Settings → Tools & MCP), авторизация пройдена на уровне MCP

Какой метод использовать?
```

Если доступен только один метод — всё равно спроси подтверждение.
Если оба недоступны — сообщи пользователю и предложи инструкции по настройке.

### Параметры для board_manager

Для запуска оркестратор должен знать:
- **owner/repo** — из конфига `ai-dev-factory/dev-factory.config.json` или от пользователя
- **project_number** — из конфига или от пользователя
- **github_method** — `gh` или `mcp` (из ответа пользователя на шаге выше)

Если конфиг не содержит owner/repo или project_number — спроси пользователя.

## Что считается командой продолжить

✅ "запусти аналитиков", "теперь финальный аналитик", "следующий", "продолжай", "создай задачи на доске"

❌ Молчание — не команда
❌ Логическая очевидность следующего шага — не команда
❌ Завершение предыдущего агента — не команда

**Исключение: полный прогон** — если пользователь сказал "запусти весь конвейер":
- Выполняй все шаги автоматически последовательно
- Продолжай следующий только если предыдущий завершился успешно (файл создан)

## Формат сообщения после каждого агента

**После segment_analyst:**
```
✅ @segment_analyst завершил работу
📄 ai/tasks/task-<NN>-<название>/segment_analyst_output.md
SEGMENT_MODE: [single | multi]
Сегментов: N
⏸ Жду следующей команды.
```

**После analyst (single):**
```
✅ @analyst завершил работу
📄 ai/tasks/task-<NN>-<название>/analyst_output.md
TASK_DOMAIN: [frontend | backend | fullstack | infra | other]
ANALYSIS_MODE: [simple | full]
⏸ Жду следующей команды.
```

**После analyst (multi — все сегменты):**
```
✅ @analyst завершил работу для N сегментов
📄 segments/segment-01-<name>/analyst_output.md — TASK_DOMAIN: ..., ANALYSIS_MODE: ...
📄 segments/segment-02-<name>/analyst_output.md — TASK_DOMAIN: ..., ANALYSIS_MODE: ...
...
⏸ Жду следующей команды.
```

**После параллельных аналитиков:**
```
✅ Параллельный анализ завершён (2/2 аналитиков)
📄 design_analyst_output.md + design_context/ (N файлов контекста, figma_nodes.md)
📄 component_analyst_output.md
⏸ Жду следующей команды.
```

**После final_analyst:**
```
✅ @final_analyst завершил работу
📄 final_analyst_output.md — подзадач: N
📁 subtasks/subtask-01-.../, subtasks/subtask-02-.../
⏸ Жду следующей команды.
```

**После board_manager:**
```
✅ @board_manager завершил работу
📄 board_output.md
🎯 Создано issues: N в <owner>/<repo> Project #<number>
✅ Аналитический конвейер завершён.
```
