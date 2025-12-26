# Gen-PM Core Rules

## 1. Tech Stack
*   **Core**: React 19 + Vite + TypeScript.
*   **UI**: Tailwind CSS + Lucide React.
*   **Data**: IndexedDB (`idb`) accessed via `services/db.ts`.
*   **AI**: Google GenAI via `services/geminiService.ts`.

## 2. Architecture & Data
*   **Database First**: All data persistence MUST use `db.ts`. **Do not** write raw IDB logic in components.
*   **Single Source of Types**: Define all shared interfaces in `types.ts`. Avoid `any`.
*   **Localization**: Use `useLanguage()` hook. Add strings to `LanguageContext.tsx`. **No hardcoded text**.
*   **Components**: Keep them flat in `/components`. logical heavy-lifting belongs in `/services`.

## 3. Coding Standards
*   **Naming**:
    *   `PascalCase` for Components & Files (`SuperTable.tsx`).
    *   `camelCase` for Functions & vars (`handleSave`).
*   **Styles**: Mobile-first Tailwind. Use "Premium" aesthetics (soft shadows `shadow-lg`, rounded corners `rounded-xl`).
*   **Events**: Handlers = `handleAction`; Props = `onAction`.

## 4. AI Service
*   **Output**: Always prompt for **Strict JSON**.
*   **Error Handling**: Wrap all calls in `try/catch` with safe fallbacks.

## 5. Workflow
1.  **Modify Types**: Update `types.ts` first.
2.  **Update DB**: Handle migration in `db.ts` if needed.
3.  **Build UI**: Create/Update component in `components/`.
4.  **Register View**: Update `App.tsx` router/sidebar.

## 6. Best Practices & Optimization
*   **Split Early**: Components > 400 lines should be refactored. Extract sub-views (e.g., `TableBuilder.tsx`) to improve maintainability.
*   **Performance**: Use `useMemo` for heavy calculations (lists > 50 items, complex logic) and `useCallback` for stable handlers.
*   **Defensive Coding**: Always safeguard against `null`/`undefined` data from DB or AI. Provide default values (e.g., `projects?.map(...) ?? []`).
