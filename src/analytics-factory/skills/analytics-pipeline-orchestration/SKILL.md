---
name: analytics-pipeline-orchestration
description: Оркестрирует аналитический конвейер analytics-factory. Начинает с сегментации, запускает analyst и requirements_lock_agent параллельно, управляет циклом вопросов к пользователю, маршрутизирует по домену, координирует feedback loops (analytics_judge → final_analyst, final_analyst → analyst), передаёт результаты в board_manager. Используй при вызове любого агента analytics-factory или при запросе "запусти аналитику".
---

# Оркестрация аналитического конвейера

## Структура конвейера

```
Пользователь → @segment_analyst → segment_analyst_output.md (SEGMENT_MODE + USER_LANGUAGE)
                    ↓
         [SEGMENT_MODE: single]
            @analyst ‖ @requirements_lock_agent   (параллельно)
                ↓              ↓
            analyst_output.md  requirements_lock.md
                ↓
            [if STATUS: questions_pending → цикл вопросов → повтор @analyst]
                ↓
                [ANALYSIS_MODE: full, TASK_DOMAIN: frontend/fullstack]
                @design_analyst ‖ @component_analyst   (параллельно)
                                ↓
                [ANALYSIS_MODE: full, TASK_DOMAIN: backend/infra/other]
                @component_analyst                     (только один)
                                ↓
                @final_analyst → final_analyst_output.md + subtasks/
                ↓
            [if STATUS: needs_clarification → маршрут к @analyst → цикл вопросов → повтор @final_analyst]
                ↓
            @analytics_judge → analytics_judge_output.md
                ↓
            [if FAIL → маршрут к @final_analyst → повтор @analytics_judge]
                ↓ (PASS)
            @board_manager → board_output.md (issues в GitHub Projects V2)

         [SEGMENT_MODE: multi]
            Для КАЖДОГО сегмента ПАРАЛЛЕЛЬНО:
              @analyst ‖ @requirements_lock_agent → маршрутизация → @final_analyst → @analytics_judge
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
`analyst_output.md`, `final_analyst_output.md`, `analytics_judge_output.md`) — оркестратор читает их для определения следующего шага маршрута.

## Что передавать каждому агенту

| Агент | Что передавать |
|-------|----------------|
| `@segment_analyst` | Задачу пользователя дословно + путь к папке задачи |
| `@analyst` (при single) | Задачу пользователя дословно + путь к папке задачи |
| `@analyst` (при multi) | Путь к папке сегмента + «Задача для аналитика» + «Границы контекста» из segment_analyst_output.md |
| `@analyst` (повторный, с ответами) | Путь к папке задачи + ответы пользователя на вопросы |
| `@requirements_lock_agent` | Задачу пользователя дословно + путь к папке задачи |
| `@design_analyst` | Только путь к папке задачи (или папке сегмента при multi) |
| `@component_analyst` | Только путь к папке задачи (или папке сегмента при multi) |
| `@final_analyst` | Только путь к папке задачи (или папке сегмента при multi) |
| `@analytics_judge` | Только путь к папке задачи (или папке сегмента при multi) |
| `@board_manager` | Путь к корневой папке задачи + owner/repo + project_number + github_method (`gh` или `mcp`) |

При создании агента, открывай ему доступ до папки .cursor/skills (открывай доступ ко всем skills) - агент сам определит какие skills он должен использовать.

## Этап 0: Сегментация

**Первое действие** после получения задачи — вызов `@segment_analyst`.

После завершения прочитай `segment_analyst_output.md` и определи `SEGMENT_MODE`.

### SEGMENT_MODE: single

Конвейер работает как обычно — переходи к Этапу 1 с путём к папке задачи.

### SEGMENT_MODE: multi

1. Создай папки для каждого сегмента: `ai/tasks/task-<NN>-<name>/segments/segment-NN-<name>/`
2. Запусти `@analyst` и `@requirements_lock_agent` **параллельно** для каждого сегмента
3. После завершения — обработай цикл вопросов (Этап 1.1) для каждого сегмента
4. Маршрутизируй по стандартным правилам (Этап 2), подставляя путь к папке сегмента
5. После завершения всех сегментов — один запуск `@board_manager` с путём к корневой папке задачи

## Этап 1: Классификация и фиксация требований

**Параллельный запуск:** `@analyst` и `@requirements_lock_agent` запускаются одновременно.

После завершения обоих:
1. Прочитай `analyst_output.md` — проверь `STATUS`
2. Если `STATUS: questions_pending` → переходи к Этапу 1.1 (цикл вопросов)
3. Если `STATUS: ok` → определи `ANALYSIS_MODE` и переходи далее

### Этап 1.1: Цикл вопросов к пользователю

Если `analyst_output.md` содержит `STATUS: questions_pending`:

1. Прочитай секцию `QUESTIONS_FOR_USER` из `analyst_output.md`
2. Задай вопросы пользователю через AskQuestion (используй скилл `asking-questions-to-user`)
3. Передай ответы пользователя обратно `@analyst`
4. Повтори: прочитай обновлённый `analyst_output.md`
5. Если снова `questions_pending` — повтори (максимум 3 раунда)
6. После 3 раундов — продолжи с тем, что есть

**Счётчик:** `analyst_question_rounds = 0`. Инкрементируй при каждом раунде. Стоп при >= 3.

## Этап 2: Доменная маршрутизация [full analysis]

Определи `ANALYSIS_MODE`:
- `ANALYSIS_MODE: simple` → переходи сразу к Этапу 3 (final_analyst)
- `ANALYSIS_MODE: full` → запусти доменных аналитиков

Состав [full analysis] зависит от `TASK_DOMAIN`:

| TASK_DOMAIN | [full analysis] |
|-------------|-----------------|
| `frontend` | `@design_analyst` ‖ `@component_analyst` → `@final_analyst` |
| `fullstack` | `@design_analyst` ‖ `@component_analyst` → `@final_analyst` |
| `backend` | `@component_analyst` → `@final_analyst` (design_analyst пропускается) |
| `infra` | `@component_analyst` → `@final_analyst` (design_analyst пропускается) |
| `other` | `@component_analyst` → `@final_analyst` (design_analyst пропускается) |

## Этап 3: Финальный анализ и декомпозиция

Запусти `@final_analyst`.

После завершения прочитай `final_analyst_output.md` — проверь `STATUS`:

- `STATUS: ok` → переходи к Этапу 4 (analytics_judge)
- `STATUS: needs_clarification` → feedback loop к analyst:
  1. Прочитай `QUESTIONS_FOR_USER` из `final_analyst_output.md`
  2. Маршрутизируй к `@analyst` — он задаст вопросы пользователю
  3. После получения ответов — перезапусти `@final_analyst`
  4. Максимум 2 итерации этого цикла

**Счётчик:** `final_analyst_clarification_rounds = 0`. Инкрементируй при каждом цикле. Стоп при >= 2.

## Этап 4: Валидация аналитики (analytics_judge)

Запусти `@analytics_judge`.

После завершения прочитай `analytics_judge_output.md`:

- **Вердикт: ПРОШЁЛ** → переходи к Этапу 5 (board_manager)
- **Вердикт: НЕ ПРОШЁЛ** → feedback loop к final_analyst:
  1. Передай `analytics_judge_output.md` с конкретными нарушениями в `@final_analyst`
  2. Final_analyst исправляет декомпозицию
  3. Перезапусти `@analytics_judge`
  4. Максимум 2 итерации этого цикла

**Счётчик:** `judge_feedback_rounds = 0`. Инкрементируй при каждом цикле. Стоп при >= 2.
При превышении лимита — сообщи пользователю о нерешённых нарушениях и предложи продолжить или остановиться.

## Этап 5: Board Manager — завершение конвейера

`@board_manager` запускается **всегда** в конце конвейера (и при simple, и при full, и при single, и при multi).

При `SEGMENT_MODE: multi` — `@board_manager` получает путь к **корневой** папке задачи.

### Перед запуском board_manager — выбор метода доступа к GitHub

Оркестратор **обязан** определить метод доступа к GitHub перед запуском board_manager.
Для этого выполни два шага:

**Шаг 1: Проверь доступность методов**
- **gh CLI:** выполни `gh auth status` через Shell. Если exit code 0 — gh доступен и авторизован.
- **GitHub MCP:** проверь наличие MCP-сервера с GitHub-инструментами среди доступных MCP.

**Шаг 2: Спроси пользователя**

Задай пользователю вопрос с результатами проверки (через AskQuestion).

Если доступен только один метод — всё равно спроси подтверждение.
Если оба недоступны — сообщи пользователю и предложи инструкции по настройке.

### Параметры для board_manager

- **owner/repo** — из конфига `ai-dev-factory/dev-factory.config.json` или от пользователя
- **project_number** — из конфига или от пользователя
- **github_method** — `gh` или `mcp`

## Параллельный запуск

**Параллельный запуск = несколько вызовов Task в ОДНОМ ответе агента.**

```
← один ответ содержит:
  @analyst (папка=ai/tasks/task-01/)
  @requirements_lock_agent (папка=ai/tasks/task-01/)
← оба запущены параллельно
```

```
← один ответ содержит:
  @design_analyst (папка=ai/tasks/task-01/)
  @component_analyst (папка=ai/tasks/task-01/)
← оба запущены параллельно
```

## Лимиты итераций (защита от бесконечных циклов)

| Цикл | Макс. итераций | При превышении |
|------|---------------|----------------|
| Вопросы analyst → пользователь | 3 | Продолжить с текущим состоянием |
| final_analyst NEEDS_CLARIFICATION → analyst | 2 | Продолжить с текущим состоянием |
| analytics_judge FAIL → final_analyst | 2 | Сообщить пользователю, предложить продолжить/остановить |

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
USER_LANGUAGE: [ru | en | ...]
Сегментов: N
⏸ Жду следующей команды.
```

**После analyst + requirements_lock_agent (параллельно):**
```
✅ @analyst и @requirements_lock_agent завершили работу
📄 analyst_output.md — STATUS: [ok | questions_pending], ANALYSIS_MODE: [simple | full]
📄 requirements_lock.md — MUST: N, MUST_NOT: M, API_SIGNATURES: K
[если questions_pending: ❓ Есть вопросы к пользователю (N вопросов)]
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
📄 final_analyst_output.md — STATUS: [ok | needs_clarification], подзадач: N
📁 subtasks/subtask-01-.../, subtasks/subtask-02-.../
[если needs_clarification: ❓ Есть вопросы к пользователю]
⏸ Жду следующей команды.
```

**После analytics_judge:**
```
✅ @analytics_judge завершил работу
📄 analytics_judge_output.md — Вердикт: [ПРОШЁЛ | НЕ ПРОШЁЛ]
[если НЕ ПРОШЁЛ: ❌ Нарушений: N — запускаю feedback loop к final_analyst]
⏸ Жду следующей команды.
```

**После board_manager:**
```
✅ @board_manager завершил работу
📄 board_output.md
🎯 Создано issues: N в <owner>/<repo> Project #<number>
✅ Аналитический конвейер завершён.
```
