export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
 
  try {
    const response = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches",
      {
        headers: {
          "X-Auth-Token": "b95ea5b1e87a4e59bb5fc1ca2d3dc4c3",
        },
      }
    );
 
    if (!response.ok) {
      throw new Error(`API svarte med status ${response.status}`);
    }
 
    const data = await response.json();
 
    const matches = data.matches.map((m) => ({
      id: m.id,
      home: m.homeTeam.name || m.homeTeam.shortName || "TBD",
      away: m.awayTeam.name || m.awayTeam.shortName || "TBD",
      homeFlagUrl: m.homeTeam.crest || "",
      awayFlagUrl: m.awayTeam.crest || "",
      kickoff: m.utcDate,
      status:
        m.status === "FINISHED"
          ? "FINISHED"
          : m.status === "IN_PLAY" || m.status === "PAUSED"
          ? "LIVE"
          : "SCHEDULED",
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      group: m.group ? m.group.replace("GROUP_", "") : null,
      round: stageToRound(m.stage),
      matchday: m.matchday ?? null,
    }));
 
    res.status(200).json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
 
function stageToRound(stage) {
  if (!stage) return "group";
  const s = stage.toUpperCase();
  if (s.includes("GROUP")) return "group";
  if (s.includes("ROUND_OF_16") || s.includes("LAST_16")) return "r16";
  if (s.includes("ROUND_OF_32")) return "r8";
  if (s.includes("QUARTER")) return "qf";
  if (s.includes("SEMI")) return "semi";
  if (s === "FINAL") return "final";
  return "group";
}