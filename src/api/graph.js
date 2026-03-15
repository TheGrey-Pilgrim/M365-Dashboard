// ─── api/graph.js · Vercel Serverless Function ────────────────────────────────
// Pont sécurisé entre React et Microsoft Graph API
// Credentials lus depuis les variables d'environnement Vercel (jamais exposés)
//
// Usage depuis React :
//   fetch('/api/graph?endpoint=subscribedSkus')
//   fetch('/api/graph?endpoint=users')
//   fetch('/api/graph?endpoint=reports/getEmailActivityUserDetail(period=\'D30\')')
// ──────────────────────────────────────────────────────────────────────────────

// ── Cache en mémoire (survit entre les appels tant que la fonction est chaude) ──
// TTL : 1 heure — évite de saturer Graph API sur les rafraîchissements fréquents
const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// ── Obtenir un token OAuth2 via client_credentials ─────────────────────────────
async function getAccessToken(tenantId, clientId, clientSecret) {
  const cacheKey = `token_${tenantId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     clientId,
        client_secret: clientSecret,
        scope:         'https://graph.microsoft.com/.default',
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Token error: ${err.error} — ${err.error_description}`);
  }

  const { access_token, expires_in } = await res.json();
  // Cache le token avec une marge de 5 min avant expiration réelle
  const ttl = (expires_in - 300) * 1000;
  cache.set(cacheKey, { data: access_token, ts: Date.now() - (CACHE_TTL_MS - ttl) });
  return access_token;
}

// ── Appel Graph API avec pagination automatique ────────────────────────────────
// Suit les @odata.nextLink jusqu'à épuisement — gère les tenants > 100 objets
async function fetchGraphAllPages(token, endpoint) {
  let url = endpoint.startsWith('https://')
    ? endpoint
    : `https://graph.microsoft.com/v1.0/${endpoint}`;

  const allValues = [];
  let lastResponse = null;
  let pageCount = 0;
  const MAX_PAGES = 20; // sécurité anti-boucle infinie

  while (url && pageCount < MAX_PAGES) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ConsistencyLevel: 'eventual', // requis pour certains endpoints filtrés
      },
    });

    if (res.status === 429) {
      // Rate limiting — attendre le délai indiqué par Microsoft
      const retryAfter = parseInt(res.headers.get('Retry-After') || '10', 10);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      continue; // réessayer la même URL
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(`Graph API ${res.status}: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    lastResponse = data;

    // Accumuler les valeurs paginées si présentes
    if (Array.isArray(data.value)) {
      allValues.push(...data.value);
    }

    // Suivre le nextLink si présent
    url = data['@odata.nextLink'] || null;
    pageCount++;
  }

  // Si la réponse contient un tableau .value, retourner l'ensemble fusionné
  if (allValues.length > 0) {
    return { ...lastResponse, value: allValues, _pageCount: pageCount };
  }

  // Sinon retourner la réponse telle quelle (ex: objet unique, CSV, etc.)
  return lastResponse;
}

// ── Endpoint spéciaux : rapports CSV → conversion JSON ────────────────────────
// Les endpoints /reports/get* retournent du CSV par défaut
// On détecte et parse automatiquement
function csvToJson(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/['"]/g, '').trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.replace(/['"]/g, '').trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
  });
}

async function fetchReport(token, endpoint) {
  const url = `https://graph.microsoft.com/v1.0/${endpoint}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json', // demander JSON si possible
    },
  });

  if (res.status === 302 || res.redirected) {
    // Certains endpoints redirigent vers une URL de téléchargement
    const redirectUrl = res.url || res.headers.get('Location');
    if (redirectUrl) {
      const redirectRes = await fetch(redirectUrl);
      const text = await redirectRes.text();
      return { value: csvToJson(text) };
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Report ${res.status}: ${err.error?.message || res.statusText}`);
  }

  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = await res.json();
    // Parfois Graph retourne un objet avec une URL de téléchargement
    if (data['@odata.context'] && !data.value) {
      return { value: [] };
    }
    return data;
  }

  // Réponse CSV
  const text = await res.text();
  return { value: csvToJson(text) };
}

// ── Handler principal ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS — autoriser les appels depuis le frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint, nocache } = req.query;

  if (!endpoint) {
    return res.status(400).json({
      error: 'Paramètre "endpoint" manquant',
      exemples: [
        '/api/graph?endpoint=subscribedSkus',
        '/api/graph?endpoint=users',
        '/api/graph?endpoint=reports/getEmailActivityUserDetail(period=\'D30\')',
      ],
    });
  }

  // ── Lire les credentials depuis les variables d'environnement ──
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;

  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    return res.status(500).json({
      error: 'Variables d\'environnement Azure manquantes',
      manquantes: [
        !AZURE_TENANT_ID    && 'AZURE_TENANT_ID',
        !AZURE_CLIENT_ID    && 'AZURE_CLIENT_ID',
        !AZURE_CLIENT_SECRET && 'AZURE_CLIENT_SECRET',
      ].filter(Boolean),
    });
  }

  // ── Vérifier le cache (sauf si ?nocache=1) ──
  const cacheKey = `graph_${endpoint}`;
  if (!nocache) {
    const cached = getCached(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }
  }

  try {
    // ── 1. Obtenir le token ──
    const token = await getAccessToken(AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET);

    // ── 2. Appeler Graph API selon le type d'endpoint ──
    let data;
    const isReport = endpoint.includes('reports/get');

    if (isReport) {
      data = await fetchReport(token, endpoint);
    } else {
      data = await fetchGraphAllPages(token, endpoint);
    }

    // ── 3. Mettre en cache et retourner ──
    setCache(cacheKey, data);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(data);

  } catch (err) {
    console.error('[Graph API Error]', err.message);
    return res.status(500).json({
      error: err.message,
      endpoint,
      hint: err.message.includes('403')
        ? 'Vérifier que le consentement admin a été accordé dans Azure AD'
        : err.message.includes('401')
        ? 'Token invalide ou expiré — vérifier les variables d\'environnement'
        : 'Voir les logs Vercel pour plus de détails',
    });
  }
}
