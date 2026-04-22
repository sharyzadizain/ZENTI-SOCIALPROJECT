# Volunteer App (Nuxt + Tailwind + Strapi)

Приложение уже подключено к Strapi и включает:
- onboarding (`/`, `/onboarding/name`, `/onboarding/invite`, `/onboarding/gosuslugi`)
- регистрацию и вход по email/паролю (`/auth/email`)
- рабочие экраны с данными из БД (`/home`, `/stats`, `/profile`)

## Что нужно в `.env`

```bash
NUXT_PUBLIC_STRAPI_URL="http://localhost:1337"
```

## Что создать в Strapi

Минимально нужно 2 коллекции + встроенный `Users & Permissions -> User`.

### 1) `volunteer-profile` (Collection Type)

Поля:
- `user` - relation `one-to-one` с `Users-Permissions -> User` (обязательно, уникально)
- `firstName` - text
- `lastName` - text
- `phone` - text
- `emailDisplay` - email
- `gosuslugiVerified` - boolean (default `false`)
- `soundEnabled` - boolean (default `true`)
- `deedsCount` - integer (default `0`)
- `totalHours` - integer (default `0`)
- `peopleNeedHelp` - integer (default `500`)
- `quoteText` - text

Зачем эти поля:
- `deedsCount` - сколько добрых дел сделал пользователь (карточка "Кол-во подвигов").
- `totalHours` - суммарное время помощи в часах (карточка "Общее время").
- `peopleNeedHelp` - число на главном экране "нуждаются в помощи".
- `quoteText` - текст в профиле "Что про тебя думают?".

### 2) `volunteer-achievement` (Collection Type)

Поля:
- `volunteer` - relation `many-to-one` с `volunteer-profile`
- `title` - text
- `icon` - media (single image)
- `receivedAt` - date

## Важные настройки прав (Strapi)

`Settings -> Users & Permissions Plugin -> Roles`

### `Public`
- `Auth -> register` (ON)
- `Auth -> login` (ON)

### `Authenticated`
- `volunteer-profile`: `find`, `findOne`, `create`, `update` (ON)
- `volunteer-achievement`: `find`, `findOne` (ON)

Без этих прав фронт не сможет создать профиль после регистрации и загрузить статистику.

## Что уже реализовано во фронте

- После регистрации создается `volunteer-profile` для текущего пользователя.
- `home` читает `firstName`, `peopleNeedHelp`, `quoteText`.
- Кнопка "Помочь сейчас" обновляет `deedsCount`, `totalHours`, `peopleNeedHelp` в БД.
- `stats` показывает `deedsCount`, `totalHours` и список `volunteer-achievement`.
- `profile` позволяет редактировать профиль и переключать `soundEnabled`.
- Есть logout и навигация между окнами через нижнее меню.

## Запуск

```bash
npm install
npm run dev
```
