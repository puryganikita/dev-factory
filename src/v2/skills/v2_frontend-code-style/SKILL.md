---
name: v2-frontend-code-style
description: "Domain-specific скилл: стандарты стиля кода для фронтенда. Активируется только при TASK_DOMAIN: frontend или fullstack. Стрелочные функции, React-хуки через React.*, импорт React, типизация props. Применять при написании, ревью или рефакторинге фронтенд-кода, React-компонентов, TypeScript-файлов в frontend/."
---

# Стиль кода — Frontend

> **Domain-specific скилл.** Применяется только при `TASK_DOMAIN: frontend` или `fullstack`.

## Функции: только стрелочные

Обычные `function`-декларации запрещены. Всегда стрелочные функции.

```typescript
// ✅
const handleClick = () => { ... }
const fetchData = async (id: string) => { ... }
const MyComponent = (props: Props) => { ... }

// ❌
function handleClick() { ... }
async function fetchData(id: string) { ... }
```

## React хуки: через React.*

Все хуки вызываются через неймспейс `React.`, не через именованный импорт.

```typescript
// ✅
import React from 'react'

const [value, setValue] = React.useState('')
const ref = React.useRef(null)
const data = React.useMemo(() => compute(), [dep])
const cb = React.useCallback(() => handler(), [dep])
React.useEffect(() => { ... }, [dep])
const ctx = React.useContext(MyContext)

// ❌
import { useState, useEffect } from 'react'
const [value, setValue] = useState('')
```

## Импорт React

Только дефолтный импорт:

```typescript
// ✅
import React from 'react'

// ❌
import { useState, useEffect } from 'react'
import * as React from 'react'
```

## Типизация

- Props — отдельный `type` или `interface`, не инлайн
- `any` запрещён — используй `unknown` и сужай
- `const` по умолчанию, `let` только при переназначении

```typescript
// ✅
type ButtonProps = {
  label: string
  onClick: () => void
  disabled?: boolean
}

const Button = (props: ButtonProps) => { ... }

// ❌
const Button = (props: { label: string; onClick: () => void }) => { ... }
```
