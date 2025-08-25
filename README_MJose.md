¡Listo! Aquí tienes el contenido para un archivo **`NOTAS.md`** pensado para tu “yo del futuro”. Puedes copiar/pegar tal cual.

---

# NOTAS — Alternar entre mini-plugin y `filemanager-webpack-plugin`

## Contexto

Al compilar apareció el error:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module .../node_modules/del/index.js ...
```

`filemanager-webpack-plugin` (CJS) hace `require('del')`, pero `del` en versiones recientes es **ESM-only**. Para evitar el choque CJS/ESM sin desinstalar nada, se añadió un **mini-plugin propio** que replica las tareas de copia/borrado y se dejó la opción de usar el plugin antiguo bajo demanda.

---

## Estado actual

* Por **defecto** se usa `FileOpsPlugin` (mini-plugin propio) → sin dependencias problemáticas.
* Si se define la variable de entorno `USE_FILEMANAGER=1`, se usa **`filemanager-webpack-plugin`**.
* Ambos caminos comparten exactamente las mismas tareas (`onStart`/`onEnd`).

Archivos relevantes:

* `webpack.config.js` (ya modificado para alternar según `USE_FILEMANAGER`)
* `build/file-ops.plugin.js` (mini-plugin)

---

## Mini-plugin (fuente)

**Ruta:** `build/file-ops.plugin.js`

```js
// CommonJS, sin deps externas (Node 20+)
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

async function safeRm(p) {
  try { await fsp.rm(p, { recursive: true, force: true }); }
  catch (e) { console.warn('[FileOps] rm warn:', p, e.message); }
}

async function safeCopy(src, dest) {
  try {
    const s = await fsp.stat(src).catch(() => null);
    if (!s) { console.warn('[FileOps] skip copy, no src:', src); return; }
    const destDir = s.isDirectory() ? dest : path.dirname(dest);
    await fsp.mkdir(destDir, { recursive: true });
    await fsp.cp(src, dest, { recursive: true, force: true, errorOnExist: false });
  } catch (e) {
    console.warn('[FileOps] cp warn:', src, '->', dest, e.message);
  }
}

async function runTasks(tasks = {}, { root, version }) {
  const resolveVars = p =>
    p.replace(/\$\{version\}/g, version).replace(/\%version\%/gi, version);
  const asAbs = p => path.isAbsolute(p) ? p : path.resolve(root, p);

  for (const rel of tasks.delete || []) {
    await safeRm(asAbs(resolveVars(rel)));
  }
  for (const item of tasks.copy || []) {
    const src = asAbs(resolveVars(item.source));
    const dst = asAbs(resolveVars(item.destination));
    await safeCopy(src, dst);
  }
}

class FileOpsPlugin {
  constructor({ onStart, onEnd, version, root = process.cwd() } = {}) {
    this.onStart = onStart;
    this.onEnd = onEnd;
    this.version = version;
    this.root = root;
  }
  apply(compiler) {
    compiler.hooks.beforeRun.tapPromise('FileOpsPlugin', () =>
      runTasks(this.onStart, { root: this.root, version: this.version })
    );
    compiler.hooks.watchRun.tapPromise('FileOpsPlugin', () =>
      runTasks(this.onStart, { root: this.root, version: this.version })
    );
    compiler.hooks.afterEmit.tapPromise('FileOpsPlugin', () =>
      runTasks(this.onEnd, { root: this.root, version: this.version })
    );
  }
}

module.exports = { FileOpsPlugin };
```

---

## `webpack.config.js`: cómo alterna

* **Por defecto**: usa `FileOpsPlugin` (mini-plugin).
* **Legacy**: si `USE_FILEMANAGER=1`, se hace `require('filemanager-webpack-plugin')` y se usa ese.

> Nota: No se requiere `filemanager-webpack-plugin` a menos que `USE_FILEMANAGER=1`, evitando que se evalúe `del` (ESM) y dispare el error.

---

## Cómo ejecutar

### A) Usar el mini-plugin (por defecto)

**Windows PowerShell / CMD / macOS / Linux**

```bash
npm run start
# o producción
# npx webpack --mode production
```

### B) Forzar `filemanager-webpack-plugin` (legacy)

**Windows PowerShell (solo esta sesión):**

```powershell
$env:USE_FILEMANAGER='1'
npm run start
# al terminar:
Remove-Item Env:\USE_FILEMANAGER
```

**Windows CMD (solo esta ventana):**

```cmd
set USE_FILEMANAGER=1
npm run start
```

**macOS / Linux (solo esta shell):**

```bash
export USE_FILEMANAGER=1
npm run start
# al terminar:
unset USE_FILEMANAGER
```

---

## Tareas que ejecutan ambos caminos

* `onStart` (en producción): borra `dist/`.
* `onEnd`:

  * borra: `dist/styles.min.js`, `dist/styles.js`, `dist/virtual-select.css`
  * copia:

    * `node_modules/tooltip-plugin/dist` → `docs/assets`
    * `dist` → `docs/assets`
    * `dist/virtual-select.min.js` → `dist-archive/virtual-select-${version}.min.js`
    * `dist/virtual-select.min.css` → `dist-archive/virtual-select-${version}.min.css`

> Asegúrate de que existan las rutas de origen (por ejemplo, `node_modules/tooltip-plugin/dist`) tras el build.

---

## Troubleshooting rápido

* **Sigue saliendo `ERR_REQUIRE_ESM`**
  Comprueba que *no* está definida `USE_FILEMANAGER`:

  * PowerShell: `Get-ChildItem Env:\USE_FILEMANAGER`
  * Bash: `echo $USE_FILEMANAGER`
* **`Cannot find module ./build/file-ops.plugin`**
  Verifica que el archivo `build/file-ops.plugin.js` existe y que la ruta en `require('./build/file-ops.plugin')` es correcta.
* **Copias que “no llegan”**
  Revisa que las fuentes existan y el build generó `dist/virtual-select.min.*`. El mini-plugin lo ejecuta en `afterEmit`.
* **Node demasiado viejo para algunas dependencias**
  Usa Node 20.10+ (ideal LTS reciente). Versiones 20.0.0 pueden disparar `EBADENGINE` en loaders/plugins.

---

## Alternativa (si algún día quieres volver a la lib antigua sí o sí)

* Puedes fijar `del` a CJS con `overrides` en `package.json`:

  ```json
  {
    "overrides": {
      "del": "6.1.1"
    }
  }
  ```

  Luego `npm install`. **No recomendado** si el mini-plugin ya te funciona.

---

## Git (sugerencia)

* Rama: `chore/build-file-ops-plugin`
* Commit: `build: usar mini-plugin por defecto y alternar via USE_FILEMANAGER`

---

Fin.
