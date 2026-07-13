# UNY CBT Trainer

Aplikasi latihan CBT (Computer Based Test) untuk persiapan ujian masuk UNY (Universitas Negeri Yogyakarta). Dilengkapi dengan bank soal berkualitas tinggi dan fitur analisis berbasis AI (Gemini).

## Run & Operate

- `pnpm --filter @workspace/uny-cbt run dev` — jalankan frontend (port dinamis dari $PORT)
- `pnpm --filter @workspace/api-server run dev` — jalankan API server (port 8080)
- `pnpm run typecheck` — full typecheck semua package
- `pnpm run build` — typecheck + build semua package
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks dan Zod schemas dari OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run generate-questions` — generate soal baru via Gemini API
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `GEMINI_API_KEY` — Gemini API key untuk fitur AI

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Wouter (routing) + TanStack Query
- API: Express 5
- AI: Google Gemini (gemini-2.5-flash) via GEMINI_API_KEY
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- UI: Tailwind CSS v4 + shadcn/ui components

## Where things live

- `artifacts/uny-cbt/src/` — React frontend
  - `src/lib/types.ts` — semua TypeScript types (Question, ExamResult, ActiveExam, dll)
  - `src/lib/storage.ts` — localStorage CRUD helpers
  - `src/lib/engine.ts` — exam engine (pickFromSection, createActiveExam, scoreExam)
  - `src/lib/analysis.ts` — statistics & analysis (aggregate, computeReadiness, computePriorities)
  - `src/lib/format.ts` — formatting helpers (fmtClock, fmtMinutes, fmtDate)
  - `src/data/questions.ts` — bank soal (~400+ soal)
  - `src/pages/` — halaman-halaman app (dashboard, exam, results, review, progress, setup)
- `artifacts/api-server/src/routes/ai/` — AI backend routes
- `artifacts/api-server/src/lib/gemini.ts` — Gemini client
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `scripts/src/generate-questions.ts` — script generate soal via Gemini

## Sections & Subskills

- **TPA** (Tes Potensi Akademik): Analogi Verbal, Silogisme, Deret Angka, Logika Analitik
- **Literasi Indonesia**: Ide Pokok, Makna Kata & Istilah, Simpulan Bacaan, Fakta & Opini
- **Literasi Inggris**: Main Idea, Inference, Vocabulary in Context, Detail Information
- **Matematika**: Aljabar, Aritmetika Sosial, Geometri & Pengukuran, Data & Statistika

## Exam Modes

- **Mini TO**: 12 soal (3/seksi), 15 menit
- **Full TO**: 40 soal (10/seksi), 50 menit
- **Per Materi**: 10 soal dari seksi/subskill tertentu, durasi adaptif
- **Review Kesalahan**: sampai 15 soal yang pernah salah, durasi adaptif

## AI Features

- `POST /api/ai/analyze` — analisis hasil ujian, rekomendasi belajar
- `POST /api/ai/explain` — penjelasan mendalam per soal
- `POST /api/ai/generate-questions` — generate soal baru on-demand

## Architecture decisions

- **Offline-first frontend**: semua state ujian disimpan di localStorage (tidak perlu login/server saat ujian)
- **AI sebagai enhancement**: fitur AI bersifat opsional dan tidak menghalangi penggunaan inti app
- **Bank soal static**: soal di-bake ke dalam frontend sebagai TypeScript file (fast load, no DB query)
- **Gemini langsung**: menggunakan GEMINI_API_KEY user langsung ke Google API (bukan proxy Replit)
- **Wouter routing**: lightweight router, compatible dengan Vite base path routing

## User preferences

- Bahasa antarmuka: Indonesia
- Target pengguna: calon mahasiswa UNY yang mempersiapkan ujian masuk
- Mobile-first design

## Gotchas

- Jalankan `pnpm --filter @workspace/api-spec run codegen` setelah mengubah OpenAPI spec
- Script generate-questions bisa jalan lama (~5-10 menit) karena 48 batch Gemini API calls
- Soal yang di-generate disimpan di `src/data/questions.ts` sebagai sourceType: "uny_like"
- GEMINI_API_KEY harus tersedia di environment saat menjalankan API server dan generate-questions script

## Pointers

- Lihat `pnpm-workspace` skill untuk workspace structure dan TypeScript setup
- Lihat `.local/skills/ai-integrations-gemini/SKILL.md` untuk Gemini integration details
