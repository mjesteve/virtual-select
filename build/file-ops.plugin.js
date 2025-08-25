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
    // Asegura carpeta destino si es copia a archivo
    const destDir = s.isDirectory() ? dest : path.dirname(dest);
    await fsp.mkdir(destDir, { recursive: true });
    await fsp.cp(src, dest, { recursive: true, force: true, errorOnExist: false });
  } catch (e) {
    console.warn('[FileOps] cp warn:', src, '->', dest, e.message);
  }
}

async function runTasks(tasks = {}, { root, version }) {
  const resolve = p =>
    p.replace(/\$\{version\}/g, version).replace(/\%version\%/gi, version);
  const asAbs = p => path.isAbsolute(p) ? p : path.resolve(root, p);

  // delete
  for (const rel of tasks.delete || []) {
    await safeRm(asAbs(resolve(rel)));
  }
  // copy
  for (const item of tasks.copy || []) {
    const src = asAbs(resolve(item.source));
    const dst = asAbs(resolve(item.destination));
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
    // Equivalente a onStart (build y watch)
    compiler.hooks.beforeRun.tapPromise('FileOpsPlugin', () =>
      runTasks(this.onStart, { root: this.root, version: this.version })
    );
    compiler.hooks.watchRun.tapPromise('FileOpsPlugin', () =>
      runTasks(this.onStart, { root: this.root, version: this.version })
    );

    // Equivalente a onEnd
    compiler.hooks.afterEmit.tapPromise('FileOpsPlugin', () =>
      runTasks(this.onEnd, { root: this.root, version: this.version })
    );
  }
}

module.exports = { FileOpsPlugin };
