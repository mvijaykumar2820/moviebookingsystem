cat > api/omdb.js <<'JS'
export default async function handler(req, res) {
  try {
    const key = process.env.OMDB_API_KEY;
    if (!key) return res.status(500).json({ error: "OMDB key not configured" });

    const { t, i, s, page } = req.query;
    const params = new URLSearchParams({ apikey: key });
    if (t) params.set("t", t);
    if (i) params.set("i", i);
    if (s) params.set("s", s);
    if (page) params.set("page", page);

    const url = `https://www.omdbapi.com/?${params.toString()}`;
    const omdbRes = await fetch(url);
    const data = await omdbRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Proxy error" });
  }
}
JS