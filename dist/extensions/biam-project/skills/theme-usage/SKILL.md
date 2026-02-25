---
name: theme-usage
description: Правила работы с дизайн-токенами темы и утилитарными CSS-классами. Применять при любом создании, редактировании или ревью компонентов, виджетов или view-файлов, где используются цвета, отступы, скругления, типографика или утилитарные CSS-классы темы.
---

# Работа с токенами темы и утилитарными классами

## Правила использования токенов

**Запрещено:**
- Хардкодить цвета (`#262626`, `rgba(...)`, `hsl(...)`)
- Хардкодить числовые значения отступов (`padding: 16px`, `gap: 8px`)
- Хардкодить значения скруглений (`border-radius: 8px`)
- Импортировать CSS-переменные из файлов темы напрямую
- Использовать Tailwind-классы цветов вместо токенов (`bg-blue-500`, `text-gray-400`)

**Разрешено:**
- Утилитарные классы: `.bg-primary`, `.text-muted-foreground`, `.typography-heading2`, `.p-spacing-md`, `.rounded-radius-lg`
- CSS-переменные в inline styles: `var(--primary)`, `var(--spacing-md)`, `var(--radius-lg)`
- className из kit-компонентов, которые уже используют токены внутри

## Ключевые правила по группам токенов

- **Цвета (brand, surface, border, focus, chart, sidebar)** — HSL токены, используются как `hsl(var(--primary))` в CSS и `.bg-primary`, `.text-primary`, `.border-primary` в className
- **Цвета (semantic, neutral, overlay)** — hex/rgba, используются как `var(--semantic-success)` напрямую без `hsl()`, и `.bg-semantic-success`, `.text-neutral-500`, `.bg-overlay-backdrop` в className
- **Типографика** — использовать `.typography-{name}` классы или kit-компонент `Typography` с `variant`
- **Отступы** — использовать `.p-spacing-{name}`, `.m-spacing-{name}`, `.gap-spacing-{name}` или `var(--spacing-{name})` для направленных отступов
- **Скругления** — использовать `.rounded-radius-{name}` или `var(--radius-{name})`

## Сопоставление с Figma

При работе с Figma-макетами:
- **Hex-цвет в Figma** → найди в колонке «Значение в Figma» документации группы
- **Имя переменной Figma** (`general/accent`, `neutral/800`) → найди в колонке «Figma-имя»
- **Стиль текста Figma** (`heading 2`, `paragraph small/regular`) → ищи в группе `typography`
- **Отступ в Figma** (`semantic/md` = 16px) → ищи в группе `spacing`
- **Скругление в Figma** (`semantic/rounded-lg` = 8px) → ищи в группе `radius`
