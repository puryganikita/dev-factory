---
name: code-pipeline-orchestration
description: Оркестрирует конвейер реализации code-factory. Определяет маршрут по TASK_TYPE, управляет параллельным dispatch инженеров и разработчиков волнами по <=4, обрабатывает блокеры, активирует domain-specific скиллы. Используй при вызове любого агента code-factory или при запросе "запусти конвейер code-factory".
---

# Оркестрация конвейера code-factory

## Структура конвейера

```
Пользователь → @task_analyst → final_analyst_output.md + requirements_lock.md + design_context/
                                   ↓
               @architect → architect_output.md
                  ↓
               [if STATUS: NEEDS_CLARIFICATION → @task_analyst → пользователь → @task_analyst → @architect]
                  ↓
               @engineer_[high|medium|low] × N   (параллельно, волны по <=4)
                                   ↓
               @developer_[high|medium|low] × N  (параллельно, волны по <=4)
                                   ↓
               @judge → judge_output.md + librarian_suggestions.md
                  ↓
               [if FAIL → оркестратор/пользователь с конкретными нарушениями]
                  ↓ (PASS)
               [подтверждение пользователя]
               @librarian       (обновляет knowledge base)
                                   ↓
               [TASK_TYPE: complex-feature]
               @writer → writer_output.md
```

## Главное правило — оркестратор НЕ выполняет работу

Ты — диспетчер. Твоя единственная функция — вызывать агентов и передавать им параметры.
Каждый агент самодостаточен: он сам читает файлы, сам собирает контекст.

**Запрещено:**
- Использовать MCP-инструменты
- Читать файлы проекта (кроме output-файлов агентов для определения маршрута)
- Создавать, редактировать или удалять файлы
- Собирать контекст для агентов

**Первое действие** после получения задачи — вызов `@task_analyst`.

## Что передавать каждому агенту

| Агент | Что передавать |
|-------|----------------|
| `@task_analyst` | GitHub issue URL (или текст задачи) + путь к папке задачи |
| `@architect` | Путь к папке задачи (агент сам читает requirements_lock.md) |
| `@engineer_[level]` | Путь к папке задачи + task_id (агент сам читает requirements_lock.md) |
| `@developer_[level]` | Путь к папке задачи + task_id + (опционально) `input_file` |
| `@judge` | Только путь к папке задачи (агент сам читает requirements_lock.md) |
| `@librarian` | Путь к папке задачи + список подтверждённых правил |
| `@writer` | Только путь к папке задачи |

**`input_file` для developer** — передаётся только в простых маршрутах (`simple-style`, `simple-bugfix`),
где инженер не запускается. В этом случае: `input_file: final_analyst_output.md`.

**`task_id` в простых маршрутах** — при `simple-style` / `simple-bugfix` нет `ENGINEER_TASKS`,
поэтому `task_id` формируется оркестратором как `main`.

## Маршруты конвейера по TASK_TYPE

Читай `TASK_TYPE` из `final_analyst_output.md` и выбирай маршрут:

| TASK_TYPE | Маршрут |
|-----------|---------|
| `simple-style` | `@task_analyst` → `@developer_low(input_file: final_analyst_output.md)` → `@judge` |
| `simple-bugfix` | `@task_analyst` → `@developer_medium(input_file: final_analyst_output.md)` → `@judge` |
| `refactor` | `@task_analyst` → `@architect` → parallel engineers → **parallel developers (если есть TODO)** → `@judge` |
| `new-component` | `@task_analyst` → `@architect` → parallel engineers → parallel developers → `@judge` |
| `feature-with-api` | полный конвейер |
| `complex-feature` | полный конвейер + `@writer` |

## Маппинг complexity → модель инженера/разработчика

### Инженеры — complexity из ENGINEER_TASKS

| complexity | engineer |
|-----------|----------|
| `high` | `@engineer_high` |
| `medium` | `@engineer_medium` |
| `low` | `@engineer_low` |

**Защитный override — использовать `@engineer_medium` вместо `@engineer_low` если:**
- Затронуто > 3 файлов в `files_scope`
- Изменяется `package.json` / build-конфиг
- Затрагиваются shared-модули, используемые в > 5 местах

### Разработчики — complexity из DEVELOPER_TASKS

| complexity | developer |
|-----------|-----------|
| `high` | `@developer_high` |
| `medium` | `@developer_medium` |
| `low` | `@developer_low` |

## Параллельный запуск

**Параллельный запуск = несколько вызовов Task в ОДНОМ ответе.**
**Лимит: не более 4 subagents в одном ответе.** При N > 4 — разбить на волны.

## Алгоритм параллельного dispatch

### Шаг 1 — Инженеры
1. Прочитать `ENGINEER_TASKS` из `architect_output.md`
2. Выделить задачи с `dependencies: []` → первая группа
3. Разбить на волны по <=4
4. После завершения — проверить `*_blocker.md`:
   - Если есть блокер — передать `@architect` на доработку, вернуться к шагу 1
   - Если нет — перейти к разработчикам
5. Для задач с `dependencies: [id]` — дождаться завершения зависимой задачи

### Шаг 2 — Разработчики
6. Прочитать `DEVELOPER_TASKS` из `architect_output.md`
7. Запустить `@developer_[level]` для каждой task_id
8. Разбить на волны по <=4
9. Developer для task_id запускается только после завершения engineer для той же task_id

### Шаг 3 — Финал
10. После всех developers → `@judge`
11. После подтверждения пользователя → `@librarian`
12. Если `TASK_TYPE: complex-feature` → `@writer`

## Feedback loops

### Architect → Task Analyst → Пользователь

Если `architect_output.md` содержит `STATUS: NEEDS_CLARIFICATION`:

1. Прочитай `architect_questions.md` из папки задачи
2. Передай task_analyst на перевод вопросов пользователю
3. Task_analyst задаёт вопросы пользователю через AskQuestion
4. Task_analyst сохраняет ответы в `architect_answers.md`
5. Перезапусти `@architect` с указанием на `architect_answers.md`

**Счётчик:** `architect_clarification_rounds = 0`. Инкрементируй при каждом цикле. Стоп при >= 2.

### Judge FAIL → Оркестратор/Пользователь

Если `judge_output.md` содержит вердикт `НЕ ПРОШЁЛ`:

1. Прочитай конкретные нарушения из `judge_output.md`
2. Сообщи пользователю о нарушениях
3. Предложи варианты: исправить вручную / перезапустить конвейер / продолжить

Автоматический перезапуск конвейера НЕ выполняется — решение за пользователем.

## Активация domain-specific скиллов

### Базовая карта (core)

| TASK_DOMAIN | Активные domain-specific скиллы |
|-------------|--------------------------------|
| `frontend` | `frontend-code-style` |
| `fullstack` | `frontend-code-style` (для frontend-части) |
| `backend` | backend-specific скиллы (когда будут добавлены) |
| `infra` / `other` | нет domain-specific скиллов |

### Расширение карты через extension-скиллы

Базовая карта выше — не финальная. Расширения могут добавлять дополнительные
domain-specific скиллы. Перед передачей скиллов саб-агенту:

1. Найди все доступные скиллы с суффиксом `-orchestration-ext` в имени
   (например, `biam-project-orchestration-ext`, `kit-mcp-orchestration-ext`)
2. Прочитай каждый такой скилл — он содержит таблицу дополнительных скиллов по доменам
3. Объедини все таблицы с базовой картой
4. Передай саб-агенту полный набор скиллов для его `TASK_DOMAIN`

**Универсальные скиллы (всегда активны):**
- `architecture-principles`
- `engineering-from-architecture`
- `doc-style`
- `asking-questions-to-user`

## Агент вне конвейера: mentor

`@mentor` — **самостоятельный агент**, не входит в цепочку конвейера.
Вызывается **только пользователем напрямую**.

## Что считается командой продолжить

✅ "запусти архитектора", "теперь инженеры", "следующий", "продолжай"

❌ Молчание — не команда
❌ Логическая очевидность следующего шага — не команда
❌ Завершение предыдущего агента — не команда

**Исключение: полный прогон** — если пользователь сказал "запусти весь конвейер":
- Выполняй все шаги автоматически
- Продолжай следующий только если предыдущий завершился успешно

## Формат сообщения после каждого агента

**После task_analyst:**
```
✅ @task_analyst завершил работу
📄 ai/tasks/task-<NN>-<название>/final_analyst_output.md
📁 design_context/ (N файлов контекста, figma_nodes.md) — если есть
TASK_TYPE: [значение]
TASK_DOMAIN: [значение]
⏸ Жду следующей команды.
```

**После параллельной волны:**
```
✅ Волна 1 завершена (3/3 инженеров)
📄 engineer_tasks/auth-hook_output.md
📄 engineer_tasks/user-card_output.md
📄 engineer_tasks/loading-state_output.md
⏸ Жду следующей команды.
```
