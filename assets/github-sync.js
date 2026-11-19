/* MatchPoint Club 2.2: GitHub repository JSON storage for GitHub Pages.
   Tokens remain in JS memory only; never commit credentials to the repository.
   Uses GitHub's optimistic SHA check to prevent silent lost updates. */
(() => {
  'use strict';
  const SETTINGS_KEY = 'matchpoint_github_repository_v1';
  const MAX_BYTES = 900000; // GitHub Contents API inline response limit is 1 MB.
  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8', { fatal: true });

  function encodeUTF8Base64(text) {
    const bytes = enc.encode(text);
    if (bytes.length > MAX_BYTES) throw new Error('El archivo de datos supera 900 KB. GitHub JSON ya no es apropiado para este volumen.');
    let binary = '';
    for (let i = 0; i < bytes.length; i += 16384) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
    }
    return btoa(binary);
  }
  function decodeUTF8Base64(text) {
    const binary = atob(String(text).replace(/\s/g, ''));
    if (binary.length > MAX_BYTES) throw new Error('El archivo remoto supera el límite de 900 KB.');
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return dec.decode(bytes);
  }
  function validateConfig(cfg) {
    const repository = String(cfg.repository || '').trim();
    const branch = String(cfg.branch || '').trim();
    const path = String(cfg.path || '').trim() || 'data/matchpoint.json';
    const token = String(cfg.token || '').trim();
    if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(repository) || repository.endsWith('/.') || repository.endsWith('/..')) {
      throw new Error('Introduce el repositorio en formato usuario/repositorio.');
    }
    if (branch && (!/^[\w./-]{1,200}$/.test(branch) || branch.startsWith('/') || branch.includes('..') || branch.endsWith('/'))) {
      throw new Error('La rama de GitHub indicada no es válida.');
    }
    if (path.length > 200 || !/^[\w./-]+\.json$/i.test(path) || path.startsWith('/') || path.split('/').includes('..') || path.includes('//')) {
      throw new Error('Indica una ruta JSON válida, como data/matchpoint.json.');
    }
    if (!token || !/^github_pat_|^gh[pousr]_/.test(token)) {
      throw new Error('Introduce un token personal de GitHub válido (fine-grained recomendado).');
    }
    return { repository, branch, path, token };
  }
  function readSavedConfig() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return {
        repository: typeof parsed.repository === 'string' ? parsed.repository : '',
        branch: typeof parsed.branch === 'string' ? parsed.branch : '',
        path: typeof parsed.path === 'string' ? parsed.path : 'data/matchpoint.json'
      };
    } catch (_) { return { repository: '', branch: '', path: 'data/matchpoint.json' }; }
  }
  async function githubRequest(url, token, options = {}) {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    let body = {};
    try { body = await response.json(); } catch (_) { /* empty or invalid error */ }
    if (!response.ok) {
      let description = `GitHub devolvió HTTP ${response.status}.`;
      if (response.status === 401) description = 'Token de GitHub no válido o caducado.';
      else if (response.status === 403) description = 'Acceso denegado: verifica los permisos Contents (lectura/escritura), la organización y los límites de GitHub.';
      else if (response.status === 404) description = 'Repositorio, rama o archivo no encontrado, o sin permiso de acceso.';
      else if (response.status === 409) description = 'El archivo ha cambiado en GitHub desde su última lectura (conflicto de versiones).';
      else if (response.status === 422) description = 'GitHub no ha aceptado la escritura. Revisa la rama, la ruta y los permisos del repositorio.';
      else if (response.status === 413) description = 'El contenido supera el límite admitido por GitHub.';
      const error = new Error(description);
      error.status = response.status;
      error.githubMessage = typeof body.message === 'string' ? body.message : '';
      throw error;
    }
    return body;
  }

  class GitHubSync {
    constructor({ onRemoteData, onStatus, validateData, canAutoRefresh }) {
      this.onRemoteData = onRemoteData;
      this.onStatus = onStatus;
      this.validateData = validateData;
      this.canAutoRefresh = canAutoRefresh;
      this.config = readSavedConfig();
      this.token = ''; // Never persisted, logged, or embedded into a URL.
      this.sha = null;
      this.status = 'local';
      this.error = '';
      this.dirty = false;
      this.latestState = null;
      this.revision = 0;
      this.saving = false;
      this.loading = false;
      this.timer = null;
      this.lastSaved = null;
      this.interval = setInterval(() => {
        if (this.status === 'connected' && !this.dirty && !this.loading && this.canAutoRefresh()) {
          this.refresh({ automatic: true }).catch(() => {});
        }
      }, 60000);
    }
    view() {
      const labels = {
        local: 'Modo local · sin sincronizar', loading: 'Conectando con GitHub…',
        missing: 'Sin archivo remoto · crear base de datos',
        connected: this.dirty ? 'Pendiente de subir a GitHub' : 'Sincronizado con GitHub',
        saving: 'Guardando en GitHub…', conflict: 'Conflicto entre dispositivos',
        error: 'Error de sincronización · cambios locales pendientes'
      };
      return {
        status: this.status, label: labels[this.status] || labels.local,
        error: this.error, dirty: this.dirty, loading: this.loading, saving: this.saving,
        config: { ...this.config }, online: !!this.token,
        lastSaved: this.lastSaved,
      };
    }
    emit() { this.onStatus(this.view()); }
    setStatus(status, error = '') { this.status = status; this.error = error; this.emit(); }
    repoUrl() {
      const [owner, repo] = this.config.repository.split('/');
      return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    }
    contentUrl() {
      const path = this.config.path.split('/').map(encodeURIComponent).join('/');
      return `${this.repoUrl()}/contents/${path}?ref=${encodeURIComponent(this.config.branch)}`;
    }
    async readFile() {
      try {
        const json = await githubRequest(this.contentUrl(), this.token);
        if (json.type !== 'file' || !json.sha || typeof json.content !== 'string' || !json.content) {
          throw new Error('El archivo JSON es demasiado grande o GitHub no devuelve su contenido.');
        }
        const data = JSON.parse(decodeUTF8Base64(json.content));
        if (!this.validateData(data)) throw new Error('El JSON remoto no contiene una base de datos MatchPoint compatible.');
        return { data, sha: json.sha };
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    }
    async connect(values, { preserveLocalData = null } = {}) {
      if (this.loading || this.saving) throw new Error('Hay otra operación de GitHub en curso.');
      const cfg = validateConfig(values);
      this.loading = true;
      this.setStatus('loading');
      try {
        const [owner, repo] = cfg.repository.split('/');
        const info = await githubRequest(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, cfg.token);
        if (!info.default_branch || !info.private) {
          // Public data repositories expose all players; we disallow them deliberately.
          if (info.private !== true) throw new Error('Por seguridad, la base de datos debe estar en un repositorio PRIVADO.');
          throw new Error('No se pudo detectar la rama principal del repositorio.');
        }
        this.token = cfg.token;
        this.config = { repository: cfg.repository, branch: cfg.branch || info.default_branch, path: cfg.path };
        const result = await this.readFile();
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.config)); } catch (_) { /* optional */ }
        this.sha = result?.sha || null;
        this.dirty = false;
        this.latestState = null;
        if (result) {
          if (preserveLocalData) {
            // User explicitly keeps uncommitted local work; never overwrite it.
            this.latestState = JSON.parse(JSON.stringify(preserveLocalData));
            this.dirty = true;
            this.revision++;
            this.setStatus('conflict', 'Hay cambios en este dispositivo que no se han subido. Elige descargar GitHub o sobrescribir GitHub manualmente.');
          } else {
            this.onRemoteData(result.data);
            this.setStatus('connected');
          }
        } else {
          this.setStatus('missing');
        }
        return !!result;
      } catch (error) {
        this.token = '';
        this.sha = null;
        this.setStatus('local', error.message);
        throw error;
      } finally {
        this.loading = false;
        this.emit();
      }
    }
    onLocalChange(data) {
      // Keep a separate snapshot so later mutations cannot change a queued upload.
      this.latestState = JSON.parse(JSON.stringify(data));
      this.dirty = true;
      this.revision++;
      if (this.status === 'connected' || this.status === 'saving') this.scheduleFlush();
      this.emit();
    }
    scheduleFlush(delay = 400) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => { this.timer = null; this.flush().catch(() => {}); }, delay);
    }
    async writeFile(data, sha, message) {
      const content = encodeUTF8Base64(JSON.stringify(data, null, 2) + '\n');
      const body = { message, content, branch: this.config.branch };
      if (sha) body.sha = sha;
      const url = this.contentUrl().split('?')[0];
      const saved = await githubRequest(url, this.token, { method: 'PUT', body: JSON.stringify(body) });
      if (!saved.content?.sha) throw new Error('GitHub no ha confirmado la escritura. Comprueba el repositorio.');
      return saved.content.sha;
    }
    async flush() {
      if (this.saving || !this.token || !this.sha || !this.dirty || this.status === 'conflict' || this.status === 'error') return;
      this.saving = true;
      const targetRevision = this.revision;
      const snapshot = this.latestState;
      this.setStatus('saving');
      let success = false;
      try {
        this.sha = await this.writeFile(snapshot, this.sha, 'MatchPoint: actualizar datos del club');
        this.lastSaved = new Date();
        success = true;
      } catch (error) {
        const conflict = error.status === 409;
        this.setStatus(conflict ? 'conflict' : 'error', error.message);
      } finally {
        this.saving = false;
        if (success) {
          this.dirty = this.revision !== targetRevision;
          this.setStatus('connected');
          if (this.dirty) this.scheduleFlush(100);
        }
        this.emit();
      }
    }
    async initialize(data) {
      if (!this.token || this.status !== 'missing' || this.loading) throw new Error('Primero conecta con un repositorio privado sin datos.');
      this.loading = true;
      this.setStatus('loading');
      try {
        const newSha = await this.writeFile(data, null, 'MatchPoint: crear base de datos inicial');
        this.sha = newSha;
        this.dirty = false;
        this.latestState = null;
        this.lastSaved = new Date();
        this.setStatus('connected');
      } catch (error) {
        this.setStatus(error.status === 409 ? 'conflict' : 'missing', error.message);
        throw error;
      } finally { this.loading = false; this.emit(); }
    }
    async refresh({ automatic = false, discardLocal = false } = {}) {
      if (!this.token || this.loading || this.saving) return;
      if (automatic && (this.dirty || !this.canAutoRefresh())) return;
      this.loading = true;
      try {
        const result = await this.readFile();
        if (!result) {
          this.sha = null;
          this.setStatus('missing');
          return;
        }
        if (result.sha !== this.sha) {
          if (this.dirty && !discardLocal) {
            this.setStatus('conflict', 'Hay cambios locales y cambios nuevos en GitHub. Elige cómo resolverlos.');
            return;
          }
          this.onRemoteData(result.data);
          this.sha = result.sha;
        } else if (!automatic && discardLocal && this.dirty) {
          // An explicit reload always abandons local modifications.
          this.onRemoteData(result.data);
        }
        this.latestState = null;
        this.dirty = false;
        this.setStatus('connected');
      } catch (error) {
        this.setStatus('error', error.message);
        if (!automatic) throw error;
      } finally { this.loading = false; this.emit(); }
    }
    async forceUpload(data) {
      if (!this.token || this.saving || this.loading) throw new Error('Conecta antes de publicar los datos.');
      this.loading = true;
      this.setStatus('loading');
      try {
        // Read latest SHA before writing. Overwrite is only allowed after explicit confirmation.
        const current = await this.readFile();
        const sha = await this.writeFile(data, current?.sha || null, 'MatchPoint: sobrescritura manual confirmada');
        this.sha = sha;
        this.lastSaved = new Date();
        this.latestState = null;
        this.dirty = false;
        this.setStatus('connected');
      } catch (error) {
        this.setStatus(error.status === 409 ? 'conflict' : 'error', error.message);
        throw error;
      } finally { this.loading = false; this.emit(); }
    }
    retry() {
      if (!this.token || this.status !== 'error') return;
      this.setStatus('connected');
      if (this.dirty && this.sha) this.scheduleFlush(0);
      else this.refresh().catch(() => {});
    }
    disconnect() {
      if (this.saving || this.loading) throw new Error('Espera a que termine la operación en curso.');
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      this.token = '';
      this.sha = null;
      this.dirty = false;
      this.latestState = null;
      this.setStatus('local');
    }
  }
  window.MatchPointGitHubSync = GitHubSync;
})();
