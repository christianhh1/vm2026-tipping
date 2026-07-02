const SUPABASE_URL = "https://bbhjaijltanclqwrbwhi.supabase.co";
const SUPABASE_KEY = "sb_publishable_MQ6-ownm4rac2Bi0wswAAQ_Y3DBS0kD";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "no-store");

  try {
    // Hent kamper fra football-data.org
    const apiRes = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches",
      { headers: { "X-Auth-Token": "b95ea5b1e87a4e59bb5fc1ca2d3dc4c3" } }
    );
    if (!apiRes.ok) throw new Error(`API svarte med status ${apiRes.status}`);
    const data = await apiRes.json();

    // Hent manuelle overstyringer fra Supabase
    const manualRes = await fetch(
      `${SUPABASE_URL}/rest/v1/manual_results?select=match_id,home_score,away_score,status,qualifier`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const manualData = await manualRes.json();
    const manualMap = {};
    (manualData || []).forEach(r => { manualMap[r.match_id] = r; });

    const matches = data.matches.map((m) => {
      const override = manualMap[m.id];
      return {
        id: m.id,
        home: m.homeTeam.name || m.homeTeam.shortName || "TBD",
        away: m.awayTeam.name || m.awayTeam.shortName || "TBD",
        homeFlagUrl: m.homeTeam.crest || "",
        awayFlagUrl: m.awayTeam.crest || "",
        kickoff: m.utcDate,
        status: override
          ? (override.status || "FINISHED")
          : m.status === "FINISHED" ? "FINISHED"
          : m.status === "IN_PLAY" || m.status === "PAUSED" ? "LIVE"
          : "SCHEDULED",
        homeScore: override ? override.home_score : (m.score?.fullTime?.home ?? null),
        awayScore: override ? override.away_score : (m.score?.fullTime?.away ?? null),
        qualifier: override ? (override.qualifier || null) : null,
        group: m.group ? m.group.replace("GROUP_", "") : null,
        round: stageToRound(m.utcDate),
        matchday: m.matchday ?? null,
      };
    });

    res.status(200).json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function stageToRound(date) {
  if (!date) return "group";
  const d = new Date(date);
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hour = d.getUTCHours();

  if (month === 7 && day >= 18) return "final";
  if (month === 7 && day >= 14 && day <= 15) return "semi";
  if (month === 7 && day >= 9 && day <= 12) return "qf";
  if (month === 7 && day === 4 && hour >= 12) return "r8";
  if (month === 7 && day >= 5 && day <= 7) return "r8";
  if (month === 6 && day === 28 && hour >= 18) return "r16";
  if (month === 6 && day >= 29) return "r16";
  if (month === 7 && day <= 3) return "r16";
  if (month === 7 && day === 4 && hour < 12) return "r16";
  return "group";
}
