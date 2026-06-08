export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, requester } = req.body;
  if (requester?.toLowerCase() !== "herbertdinho") {
    return res.status(403).json({ error: "Ikke tilgang" });
  }

  const SUPABASE_URL = "https://bbhjaijltanclqwrbwhi.supabase.co";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    // 1. Find user id from profiles
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=id`, {
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` }
    });
    const profiles = await profileRes.json();
    if (!profiles?.length) return res.status(404).json({ error: "Bruker ikke funnet" });
    const userId = profiles[0].id;

    // 2. Delete picks, winner_picks, profiles
    await fetch(`${SUPABASE_URL}/rest/v1/picks?username=eq.${encodeURIComponent(username)}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` }
    });
    await fetch(`${SUPABASE_URL}/rest/v1/winner_picks?username=eq.${encodeURIComponent(username)}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` }
    });
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` }
    });

    // 3. Delete from Supabase Auth
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` }
    });

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
