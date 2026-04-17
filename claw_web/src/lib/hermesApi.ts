let _token: string | null = null
let _tokenPromise: Promise<string> | null = null

async function fetchToken() {
  const cached = localStorage.getItem('hermes_session_token')
  if (cached) return cached
  const resp = await fetch('/api/session-token')
  if (!resp.ok) throw new Error('Unauthorized')
  const data = (await resp.json()) as { token: string }
  localStorage.setItem('hermes_session_token', data.token)
  return data.token
}

export async function getHermesSessionToken() {
  if (_token) return _token
  if (_tokenPromise) return _tokenPromise
  _tokenPromise = fetchToken()
    .then((t) => {
      _token = t
      return t
    })
    .catch((e) => {
      _tokenPromise = null
      _token = null
      throw e
    })
  return _tokenPromise
}

export async function hermesFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  const token = await getHermesSessionToken()
  headers.set('authorization', `Bearer ${token}`)
  const resp = await fetch(path, { ...init, headers })
  if (resp.status !== 401) return resp

  localStorage.removeItem('hermes_session_token')
  _token = null
  _tokenPromise = null

  const headers2 = new Headers(init?.headers)
  const token2 = await getHermesSessionToken()
  headers2.set('authorization', `Bearer ${token2}`)
  return fetch(path, { ...init, headers: headers2 })
}
