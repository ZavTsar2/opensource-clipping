const CONNECTION_KEY = 'clip-studio-connection'

export function getConnection() {
  try {
    return JSON.parse(localStorage.getItem(CONNECTION_KEY)) || { url: '', token: '' }
  } catch {
    return { url: '', token: '' }
  }
}

export function saveConnection(connection) {
  localStorage.setItem(CONNECTION_KEY, JSON.stringify(connection))
}

function apiBase() {
  const { url } = getConnection()
  return `${url.replace(/\/$/, '')}/api`
}

function headers(extra = {}) {
  const { token } = getConnection()
  return {
    ...extra,
    Authorization: `Bearer ${token}`,
    'ngrok-skip-browser-warning': 'true',
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers: headers(options.headers),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || friendlyError(response.status))
  }
  return response
}

function friendlyError(status) {
  if (status === 401) return 'The notebook token was rejected. Check your connection settings.'
  if (status === 403) return 'This site is not allowed by the notebook CORS settings.'
  if (status === 503) return 'The notebook token is not configured yet.'
  return 'The notebook could not complete that request.'
}

export async function fetchJobs() {
  const res = await request('/jobs')
  return res.json()
}

export async function fetchJob(jobId) {
  const res = await request(`/jobs/${jobId}`)
  return res.json()
}

export async function createJob(payload) {
  const res = await request('/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function deleteJob(jobId) {
  const res = await request(`/jobs/${jobId}`, { method: 'DELETE' })
  return res.json()
}

export async function fetchHealth() {
  const res = await request('/health')
  return res.json()
}

export async function fetchMedia(path, onProgress) {
  const response = await request(normalizeMediaPath(path))
  const total = Number(response.headers.get('content-length')) || 0
  if (!response.body) return URL.createObjectURL(await response.blob())
  const reader = response.body.getReader(); const chunks = []; let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value); received += value.length
    onProgress?.(total ? Math.round((received / total) * 100) : null)
  }
  return URL.createObjectURL(new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' }))
}

function normalizeMediaPath(path) {
  if (path.startsWith('http')) {
    const connectionUrl = getConnection().url.replace(/\/$/, '')
    if (!path.startsWith(connectionUrl)) throw new Error('The notebook returned an untrusted media URL.')
    return path.slice(connectionUrl.length)
  }
  return path.startsWith('/api/') ? path.slice(4) : path
}
