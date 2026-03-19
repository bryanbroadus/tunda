# Tunda

> Stock management, POS, credit tracking & accounting for small businesses in Uganda.

## Structure

```
tunda/
├── apps/
│   ├── web/        # Next.js web app (App Router + Tailwind)
│   └── mobile/     # Expo mobile app (coming soon)
├── packages/
│   └── db/         # Supabase migrations & seed data
└── README.md
```

## Stack

- **DB / Auth / Backend**: Supabase (PostgreSQL + Edge Functions + Auth)
- **Web**: Next.js 15 (App Router) → Vercel
- **Mobile**: Expo (React Native)
- **SMS**: Africa's Talking
- **Styling**: Tailwind CSS

## Getting Started

```bash
cd apps/web
cp .env.example .env.local
# fill in Supabase keys
npm install
npm run dev
```

## Build by Kazimedia (kazimedia.co)
