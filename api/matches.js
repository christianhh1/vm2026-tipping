export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  try {
    const response = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches",
      { headers: { "X-Auth-Token": "b95ea5b1e87a4e59bb5fc1ca2d3dc4c3" } }
    );
    if (!response.ok) throw new Error(`API svarte med status ${response.status}`);
    const data = await response.json();

    const matches = data.matches.map((m) => ({
      id: m.id,
      home: m.homeTeam.name || m.homeTeam.shortName || "TBD",
      away: m.awayTeam.name || m.awayTeam.shortName || "TBD",
      homeFlagUrl: m.homeTeam.crest || "",
      awayFlagUrl: m.awayTeam.crest || "",
      kickoff: m.utcDate,
      status:
        m.status === "FINISHED" ? "FINISHED"
        : m.status === "IN_PLAY" || m.status === "PAUSED" ? "LIVE"
        : "SCHEDULED",
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      group: m.group ? m.group.replace("GROUP_", "") : null,
      round: stageToRound(m.utcDate),
      matchday: m.matchday ?? null,
    }));

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

  // Finale: 19 juli
  if (month === 7 && day === 19) return "final";
  // Semifinale: 14-15 juli
  if (month === 7 && day >= 14 && day <= 15) return "semi";
  // Kvartfinale: 9-11 juli
  if (month === 7 && day >= 9 && day <= 11) return "qf";
  // 8-delsfinale: 4-7 juli
  if (month === 7 && day >= 4 && day <= 7) return "r8";
  // 16-delsfinale: 28 juni - 3 juli
  if ((month === 6 && day >= 28) || (month === 7 && day <= 3)) return "r16";
  // Gruppespill: 11-27 juni
  return "group";
}
