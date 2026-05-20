# React + TypeScript + Vite

## Run (Desktop)

```sh
cd app
pnpm install
pnpm tauri dev
```

## Run (Docker + Compose)

This repo includes a Compose-based dev environment at the repo root. It’s useful on Ubuntu when host tooling (e.g. Snap) interferes with GTK/WebKit runtime linking.

One-time: allow local Docker containers to connect to your X server:

```sh
xhost +local:docker
```

Then start dev (from the repo root):

```sh
docker compose up --build
```

Notes:
- The Vite dev server is exposed on `http://localhost:5173/`.
- Close the app window to stop the container, or `Ctrl+C` in the Compose terminal.

### Linux prerequisites (Tauri)

On Debian/Ubuntu you will likely need:

```sh
sudo apt update
sudo apt install -y pkg-config libgtk-3-dev libcairo2-dev librsvg2-dev libayatana-appindicator3-dev

# WebKit2GTK dev package name varies by Ubuntu version:
sudo apt install -y libwebkit2gtk-4.0-dev || sudo apt install -y libwebkit2gtk-4.1-dev
```

If `apt update` fails with a “Hash Sum mismatch” for a third-party repo (e.g. Cursor), temporarily disable that repo in `/etc/apt/sources.list.d/` and retry.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
