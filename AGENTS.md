# AGENTS.md — Mobile Agent Execution Rules (React Native / Expo + TypeScript)

These rules apply to any AI agent modifying or operating in `App_uas/` (mobile app).

## 0) Goal
Ship stable mobile features fast with safe auth, consistent UI, and no regression in navigation or offline behavior.

## 1) No Guessing
If a screen behavior, validation rule, API contract, or navigation flow is ambiguous:
- Ask a clarification OR
- Implement the safest placeholder and mark it clearly as `TODO` / `PENDIENTE`.

## 2) Must Not Break (Critical)
- Do NOT break navigation routes/params.
- Do NOT change token storage logic (SecureStore/AsyncStorage) without migrating safely.
- Do NOT change API client behavior globally without verifying all calls.

## 3) Environment & Secrets
- Never hardcode API URLs, tokens, or keys.
- Use `.env` (Expo) and provide `.env.example`.
- Do not commit `.env`.

Minimum config (example):
- `EXPO_PUBLIC_API_BASE_URL`

## 4) API Client Rules
- All network calls must go through a single API helper (e.g., `api.ts`).
- Always include auth token when required.
- Handle errors with user-friendly messages (Alert/Toast).
- Never log tokens.

## 5) UI/UX Standards
- Keep Spanish labels consistent.
- Use existing components/styles; avoid creating random new patterns.
- Loading states: always show `saving/loading` and disable buttons while saving.

## 6) Data Safety
- Validate all user inputs (numbers, required fields).
- Prevent crashes: always null-check route params (`bateria?._id` etc.).
- When updating state after API calls, keep types consistent.

## 7) Testing & Run
- Any change must compile with TypeScript.
- Verify at least:
  - app starts
  - login works (if touched)
  - the modified screen navigates correctly

## 8) Control de Versionamiento (Obligatorio)

- El agente NO está autorizado a ejecutar:
  - git commit
  - git push
  - git checkout
  - git merge
  - git rebase
  - creación de ramas

- El agente solo puede:
  - Modificar archivos necesarios dentro del alcance del spec
  - Crear archivos nuevos si el spec lo requiere
  - Mostrar claramente qué archivos fueron modificados

- El control total de Git es responsabilidad exclusiva del desarrollador humano.

- Cuando la tarea esté finalizada, el agente debe indicar:

  "Cambios listos para revisión y commit manual."

  ## 🔐 Protección de Configuración y Producción

- No modificar archivos de configuración de Expo sin instrucción explícita.
- No alterar `app.json` o `app.config.js` salvo que el spec lo indique claramente.
- No cambiar configuración de build (EAS) sin autorización explícita.
- No introducir dependencias nuevas sin justificarlo en el mensaje final.