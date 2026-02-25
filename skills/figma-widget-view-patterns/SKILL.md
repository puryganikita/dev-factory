---
name: figma-widget-view-patterns
description: Паттерны создания View-компонентов виджетов — маппинг элементов Figma на kit-компоненты из useKit(). Применять при создании, ревью или рефакторинге view-файлов виджетов в frontend/src/widgets/instances/*/views/.
---

# Паттерны View-компонентов виджетов

## Архитектурный инвариант

Виджет **не знает свой KIT**. Все UI-компоненты получаются исключительно через `useKit()`.
Использование сырого HTML (`<button>`, `<input>`, `<select>`) вместо kit-компонентов —
критическое нарушение, делающее виджет несовместимым с системой KITs и Themes.

## Доступные kit-компоненты

Полный список компонентов из `useKit()` (контракт в `kits/root_contracts/kit-components.ts`):

| Компонент | Назначение | Ключевые props |
|-----------|-----------|----------------|
| `Card` | Контейнер-карточка | `title`, `description`, `renderContent`, `renderFooter`, `renderAction` |
| `Button` | Кнопка/действие | `label`, `kind`, `onClick`, `isDisabled`, `isLoading`, `children` |
| `Badge` | Статус/метка/тег | `label`, `kind` |
| `TextField` | Поле ввода | `label`, `value`, `onChange`, `error`, `multiline` |
| `Select` | Выпадающий список | `options`, `value`, `onChange`, `placeholder` |
| `Checkbox` | Чекбокс | `label`, `isChecked`, `onChange` |
| `Progress` | Прогресс-бар | `value`, `max`, `label` |
| `Tooltip` | Тултип | `content`, `children`, `position` |
| `Avatar` | Аватар | `src`, `alt`, `fallback`, `dimension` |
| `Accordion` | Аккордеон | `items`, `kind` |
| `Collapsible` | Раскрывающийся блок | `renderTrigger`, `renderContent` |
| `Calendar` | Календарь | `selectedDate`, `onSelect` |
| `DatePicker` | Выбор даты | `value`, `onChange`, `label` |
| `ThemeProvider` | Провайдер темы | `theme`, `children` |

## Маппинг элементов Figma на kit-компоненты

| Элемент в Figma | Kit-компонент | Когда использовать |
|-----------------|---------------|--------------------|
| Карточка / контейнер с фоном, border, border-radius, padding | `Card` | Всегда для внешнего контейнера виджета |
| Кнопка / действие / ссылка-действие | `Button` | Любой кликабельный элемент-действие |
| Статус / метка / тег / бейдж | `Badge` | Индикаторы состояния, категории, теги |
| Поле ввода / текстовое поле | `TextField` | Любое поле для ввода текста |
| Чекбокс / переключатель | `Checkbox` | Бинарный выбор |
| Выпадающий список / дропдаун | `Select` | Выбор из списка |
| Прогресс-бар / индикатор прогресса | `Progress` | Отображение прогресса |

## Что разрешено без kit-компонентов

- `<div>` — layout-контейнеры (flex, grid, позиционирование)
- `<span>` — текстовые элементы (заголовки, описания, числовые значения)
- Иконки из `lucide-react` — иконки не входят в kit-контракт
- Skeleton-блоки — простые `<div>` с `background` для loading state (но обёрнутые в `Card`)

## Что ЗАПРЕЩЕНО

- `<button>` — заменяй на `Button` из `useKit()`
- `<input>`, `<textarea>` — заменяй на `TextField` из `useKit()`
- `<select>` — заменяй на `Select` из `useKit()`
- Сырой `<div>` как внешний контейнер виджета с `background`, `border`, `border-radius` — заменяй на `Card`
- Прямой импорт из UI-библиотек (`import { Card } from 'shadcn/ui'`)

## Эталонный пример: view-only виджет с карточкой и кнопками

```typescript
import { useKit } from '../../../../lib/kit-context'
import type { AlertCardSdkSchema } from '../sdk-schema.ts'

export const AlertCardDefaultView = (props: AlertCardSdkSchema) => {
  const { Card, Button, Badge } = useKit()

  if (props.isLoading) {
    return (
      <Card
        renderContent={() => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ width: '100%', height: '24px', background: '#262626', borderRadius: '4px' }} />
            <div style={{ width: '60%', height: '21px', background: '#262626', borderRadius: '4px' }} />
          </div>
        )}
      />
    )
  }

  return (
    <Card
      renderAction={() => <Badge label="Важно" kind="danger" />}
      renderContent={() => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontSize: '16px', fontWeight: 500, color: 'white' }}>
            {props.title || '—'}
          </span>
          <span style={{ fontSize: '14px', color: '#737373' }}>
            {props.description || '—'}
          </span>
        </div>
      )}
      renderFooter={() => (
        <div style={{ display: 'flex', gap: '16px' }}>
          <Button label={props.primaryActionLabel} kind="primary" />
          <Button label={props.secondaryActionLabel} kind="bordered" />
        </div>
      )}
    />
  )
}
```

## Эталонный пример: виджет-контейнер с children

```typescript
import React from 'react'
import { useKit } from '../../../../lib/kit-context'
import type { SectionSdkSchema } from '../sdk-schema.ts'

type Props = SectionSdkSchema & { children?: React.ReactNode }

export const SectionDefaultView = (props: Props) => {
  const { Card } = useKit()

  return (
    <Card
      title={props.title}
      renderContent={() => (
        <div style={{ display: 'flex', gap: '16px' }}>
          {props.children}
        </div>
      )}
    />
  )
}
```

## Эталонный пример: виджет с формой

```typescript
import { useKit } from '../../../../lib/kit-context'
import type { FormWidgetSdkSchema } from '../sdk-schema.ts'

export const FormWidgetDefaultView = (props: FormWidgetSdkSchema) => {
  const { Card, TextField, Button } = useKit()

  return (
    <Card
      title={props.title}
      renderContent={() => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <TextField label="Имя" value={props.name} onChange={props.onNameChange} />
          <TextField label="Описание" value={props.description} onChange={props.onDescriptionChange} multiline rows={3} />
        </div>
      )}
      renderFooter={() => (
        <Button label="Сохранить" kind="primary" onClick={props.onSave} isLoading={props.isSaving} />
      )}
    />
  )
}
```
