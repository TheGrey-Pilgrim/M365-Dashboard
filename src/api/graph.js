// Vercel Serverless Function · Point d'entrée Graph API
// Appelé par React via fetch('/api/graph?endpoint=...')

export default async function handler(req, res) {
  // ── 1. Lire les variables d'environnement (serveur uniquement) ──
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;

  // ── 2. Obtenir un token OAuth2 (client_credentials flow) ──
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
      })
    }
  );
  const { access_token } = await tokenRes.json();

  // ── 3. Appeler Graph API avec le token ──
  const endpoint = req.query.endpoint || 'subscribedSkus';
  const graphRes = await fetch(
    `https://graph.microsoft.com/v1.0/${endpoint}`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  const data = await graphRes.json();

  // ── 4. Retourner les données au frontend ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(data);
}
