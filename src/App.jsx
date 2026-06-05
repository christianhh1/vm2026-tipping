import { useState, useEffect, useRef } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://bbhjaijltanclqwrbwhi.supabase.co";
const SUPABASE_KEY = "sb_publishable_MQ6-ownm4rac2Bi0wswAAQ_Y3DBS0kD";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── MOCK MATCHES ─────────────────────────────────────────────────────────────
const MOCK_MATCHES = [
  { id: 1, home: "Mexico", away: "USA", homeFlagUrl: "https://flagcdn.com/w80/mx.png", awayFlagUrl: "https://flagcdn.com/w80/us.png", kickoff: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(), status: "SCHEDULED", homeScore: null, awayScore: null, group: "A", round: "group", matchday: 1 },
  { id: 2, home: "Canada", away: "Argentina", homeFlagUrl: "https://flagcdn.com/w80/ca.png", awayFlagUrl: "https://flagcdn.com/w80/ar.png", kickoff: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(), status: "SCHEDULED", homeScore: null, awayScore: null, group: "A", round: "group", matchday: 1 },
  { id: 3, home: "Brasil", away: "Frankrike", homeFlagUrl: "https://flagcdn.com/w80/br.png", awayFlagUrl: "https://flagcdn.com/w80/fr.png", kickoff: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), status: "FINISHED", homeScore: 2, awayScore: 1, group: "B", round: "group", matchday: 2 },
  { id: 4, home: "England", away: "Spania", homeFlagUrl: "https://flagcdn.com/w80/gb-eng.png", awayFlagUrl: "https://flagcdn.com/w80/es.png", kickoff: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), status: "FINISHED", homeScore: 0, awayScore: 3, group: "C", round: "group", matchday: 3 },
  { id: 5, home: "Norge", away: "Tyskland", homeFlagUrl: "https://flagcdn.com/w80/no.png", awayFlagUrl: "https://flagcdn.com/w80/de.png", kickoff: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), status: "SCHEDULED", homeScore: null, awayScore: null, group: "D", round: "group", matchday: 2 },
  { id: 6, home: "Japan", away: "Marokko", homeFlagUrl: "https://flagcdn.com/w80/jp.png", awayFlagUrl: "https://flagcdn.com/w80/ma.png", kickoff: new Date(Date.now() + 1000 * 60 * 60 * 30).toISOString(), status: "SCHEDULED", homeScore: null, awayScore: null, group: "E", round: "r16", matchday: null },
];

async function fetchMatches() {
  const res = await fetch("/api/matches");
  if (!res.ok) throw new Error(`API-feil: ${res.status}`);
  return await res.json();

// ─── SCORING ──────────────────────────────────────────────────────────────────
const ROUND_POINTS = {
  group: [2, 1], r16: [3, 1], r8: [3, 2], qf: [4, 2], semi: [4, 3], final: [5, 3],
};

function getRoundKey(match) {
  const r = (match.round || "group").toLowerCase();
  if (r === "final") return "final";
  if (r.includes("semi")) return "semi";
  if (r.includes("quarter") || r === "qf") return "qf";
  if (r === "r8") return "r8";
  if (r === "r16") return "r16";
  return "group";
}

function roundLabel(round) {
  const r = (round || "group").toLowerCase();
  if (r === "final") return "Finale";
  if (r.includes("semi")) return "Semifinale";
  if (r.includes("quarter") || r === "qf") return "Kvartfinale";
  if (r === "r8") return "8-delsfinale";
  if (r.includes("16") || r === "r16") return "16-delsfinale";
  return "Gruppespill";
}

function calcPoints(pick, match) {
  if (match.status !== "FINISHED" || pick.home_score == null || pick.away_score == null) return null;
  const ph = parseInt(pick.home_score), pa = parseInt(pick.away_score);
  const mh = match.homeScore, ma = match.awayScore;
  const roundKey = getRoundKey(match);
  const [base, bonus] = ROUND_POINTS[roundKey];
  const isKnockout = roundKey !== "group";

  if (ph === mh && pa === ma) {
    if (isKnockout && mh === ma) {
      if (pick.qualifier && match.qualifier && pick.qualifier === match.qualifier) return base + bonus;
      return 0;
    }
    return base + bonus;
  }
  const pickWinner = ph > pa ? "home" : ph < pa ? "away" : "draw";
  const matchWinner = mh > ma ? "home" : mh < ma ? "away" : "draw";
  if (pickWinner === matchWinner && pickWinner !== "draw") return base;
  return 0;
}

function formatKickoff(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" }) +
    " kl. " + d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}
function hasStarted(iso) { return new Date(iso) <= new Date(); }
function generateCode() { return Math.floor(10000 + Math.random() * 90000).toString(); }

// ─── VM TEAMS ─────────────────────────────────────────────────────────────────
// VM_TEAMS hentes dynamisk fra kampene – se WinnerPick-komponenten

// ─── ROUND GROUPING ───────────────────────────────────────────────────────────
const ROUND_ORDER = ["group_1","group_2","group_3","r16","r8","qf","semi","final"];
const ROUND_LABELS = { group_1:"Runde 1", group_2:"Runde 2", group_3:"Runde 3", r16:"16-delsfinale", r8:"8-delsfinale", qf:"Kvartfinale", semi:"Semifinale", final:"Finale" };

function getRoundSection(match) {
  const rk = getRoundKey(match);
  if (rk !== "group") return rk;
  // For group stage, use matchday field (1, 2 or 3)
  const md = match.matchday;
  if (md === 3) return "group_3";
  if (md === 2) return "group_2";
  return "group_1";
}

// ─── MATCH CARD ───────────────────────────────────────────────────────────────
function MatchCard({ match, currentUser, allPicks }) {
  const myPick = allPicks[currentUser]?.[match.id];
  const started = hasStarted(match.kickoff);
  const [home, setHome] = useState(myPick?.home_score ?? "");
  const [away, setAway] = useState(myPick?.away_score ?? "");
  const [qualifier, setQualifier] = useState(myPick?.qualifier ?? "");
  const [saved, setSaved] = useState(!!myPick);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const isKnockout = getRoundKey(match) !== "group";
  const pickIsDrawn = home !== "" && away !== "" && parseInt(home) === parseInt(away);
  const needsQualifier = isKnockout && pickIsDrawn;
  const roundKey = getRoundKey(match);
  const [base, bonus] = ROUND_POINTS[roundKey];
  const maxPts = base + bonus;
  const pts = myPick ? calcPoints(myPick, match) : null;
  const countPicked = Object.values(allPicks).filter(u => u[match.id]).length;

  async function savePick() {
    if (home === "" || away === "") return;
    if (needsQualifier && !qualifier) return;
    setSaving(true);
    const { error } = await sb.from("picks").upsert({
      username: currentUser,
      match_id: match.id,
      home_score: parseInt(home),
      away_score: parseInt(away),
      qualifier: needsQualifier ? qualifier : null,
    }, { onConflict: "username,match_id" });
    setSaving(false);
    if (!error) { setSaved(true); setEditing(false); }
    else alert("Feil ved lagring: " + error.message);
  }

  return (
    <div className={`match-card ${match.status === "FINISHED" ? "finished" : started ? "live" : ""}`}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div className="match-group-badge">{match.group ? `Gruppe ${match.group}` : roundLabel(match.round)}</div>
        <div className="pts-info">{base}+{bonus}p</div>
      </div>
      <div className="match-time">{formatKickoff(match.kickoff)}</div>
      <div className="match-teams">
        <div className="team"><img src={match.homeFlagUrl} alt={match.home} className="flag" /><span>{match.home}</span></div>
        <div className="match-vs">VS</div>
        <div className="team"><img src={match.awayFlagUrl} alt={match.away} className="flag" /><span>{match.away}</span></div>
      </div>
      {match.status === "FINISHED" && (
        <div className="actual-result">
          <span className="result-label">Resultat</span>
          <span className="result-score">{match.homeScore} – {match.awayScore}</span>
        </div>
      )}
      {!started ? (
        <div className="pick-section">
          {saved && !editing ? (
            <>
              <div className="saved-pick-row">
                <span className="pick-label">Ditt tips:</span>
                <span className="pick-score">{home} – {away}</span>
                {myPick?.qualifier && <span className="qualifier-badge">➜ {myPick.qualifier}</span>}
              </div>
              <button className="edit-btn" onClick={() => setEditing(true)}>✏️ Endre tips</button>
              <div className="pick-count">{countPicked} har tippet</div>
            </>
          ) : (
            <>
              <div className="pick-inputs">
                <input type="number" min="0" max="20" value={home} onChange={e => { setHome(e.target.value); setSaved(false); if (parseInt(e.target.value) !== parseInt(away)) setQualifier(""); }} className="score-input" placeholder="0" />
                <span className="dash">–</span>
                <input type="number" min="0" max="20" value={away} onChange={e => { setAway(e.target.value); setSaved(false); if (parseInt(home) !== parseInt(e.target.value)) setQualifier(""); }} className="score-input" placeholder="0" />
              </div>
              {needsQualifier && (
                <div className="qualifier-section">
                  <div className="qualifier-label">Hvem går videre?</div>
                  <div className="qualifier-btns">
                    <button className={`qualifier-btn ${qualifier === match.home ? "active" : ""}`} onClick={() => setQualifier(match.home)}>{match.home}</button>
                    <button className={`qualifier-btn ${qualifier === match.away ? "active" : ""}`} onClick={() => setQualifier(match.away)}>{match.away}</button>
                  </div>
                </div>
              )}
              <div style={{display:"flex", gap:6}}>
                <button onClick={savePick} className="save-btn" style={{flex:1}} disabled={saving || (needsQualifier && !qualifier)}>
                  {saving ? "Lagrer…" : needsQualifier && !qualifier ? "Velg lag som går videre" : saved ? "✓ Lagret" : "Lagre tips"}
                </button>
                {editing && <button onClick={() => { setHome(myPick.home_score); setAway(myPick.away_score); setQualifier(myPick.qualifier ?? ""); setEditing(false); setSaved(true); }} className="cancel-btn">Avbryt</button>}
              </div>
              <div className="pick-count">{countPicked} har tippet</div>
            </>
          )}
        </div>
      ) : (
        <div className="pick-section">
          {myPick ? (
            <div className="my-pick-reveal">
              <span className="pick-label">Ditt tips:</span>
              <span className="pick-score">{myPick.home_score} – {myPick.away_score}</span>
              {myPick.qualifier && <span className="qualifier-badge">➜ {myPick.qualifier}</span>}
              {pts !== null && (
                <span className={`pts pts-${pts > 0 ? (pts === maxPts ? "3" : "1") : "0"}`}>
                  {pts === maxPts ? `🎯 ${pts} poeng!` : pts > 0 ? `✅ ${pts} poeng` : "❌ 0 poeng"}
                </span>
              )}
            </div>
          ) : (
            <div className="no-pick">Du tippet ikke denne kampen</div>
          )}
          {started && match.status === "FINISHED" && (
            <div className="others-picks">
              <div className="others-label">Alle tips:</div>
              {Object.entries(allPicks).filter(([,p]) => p[match.id]).map(([user, p]) => {
                const pick = p[match.id];
                const ppts = calcPoints(pick, match);
                return (
                  <div key={user} className="other-pick-row">
                    <span className="other-user">{user}</span>
                    <span className="other-score">{pick.home_score}–{pick.away_score}{pick.qualifier ? ` ➜ ${pick.qualifier}` : ""}</span>
                    <span className={`pts-sm pts-${ppts > 0 ? (ppts === maxPts ? "3" : "1") : "0"}`}>{ppts}p</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
function Leaderboard({ allPicks, matches, memberFilter, allWinnerPicks }) {
  const users = memberFilter
    ? Object.keys(allPicks).filter(u => memberFilter.includes(u))
    : Object.keys(allPicks);

  const finalMatch = matches.find(m => m.round === "final" && m.status === "FINISHED");
  const vmWinner = finalMatch ? (finalMatch.homeScore > finalMatch.awayScore ? finalMatch.home : finalMatch.homeScore < finalMatch.awayScore ? finalMatch.away : null) : null;

  const scores = users.map(user => {
    let pts = 0, exact = 0, correct = 0;
    matches.forEach(m => {
      const pick = allPicks[user]?.[m.id];
      if (!pick) return;
      const p = calcPoints(pick, m);
      if (p === null) return;
      const maxPts = ROUND_POINTS[getRoundKey(m)][0] + ROUND_POINTS[getRoundKey(m)][1];
      pts += p; if (p === maxPts) exact++; if (p > 0) correct++;
    });
    const winnerPick = allWinnerPicks?.[user];
    const winnerBonus = vmWinner && winnerPick === vmWinner ? 5 : 0;
    pts += winnerBonus;
    return { user, pts, exact, correct, winnerPick, winnerBonus };
  }).sort((a, b) => b.pts - a.pts || b.exact - a.exact);

  return (
    <div className="leaderboard">
      <h2 className="lb-title">🏆 Ledertavle</h2>
      {scores.length === 0 ? <p className="lb-empty">Ingen resultater ennå</p> : (
        <table className="lb-table">
          <thead><tr><th>#</th><th>Spiller</th><th>Poeng</th><th>Eksakt</th><th>Riktig</th><th>VM-tipp</th></tr></thead>
          <tbody>
            {scores.map((s, i) => (
              <tr key={s.user} className={i === 0 ? "lb-first" : ""}>
                <td>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                <td>{s.user}</td>
                <td><strong>{s.pts}</strong></td>
                <td>{s.exact}</td>
                <td>{s.correct}</td>
                <td style={{fontSize:"0.78rem"}}>{s.winnerPick || <span style={{color:"var(--muted)"}}>–</span>}{s.winnerBonus > 0 && <span className="pts pts-3" style={{marginLeft:4}}>+5</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── VM-VINNER ────────────────────────────────────────────────────────────────
function WinnerPick({ currentUser, matches, allWinnerPicks, onSaved }) {
  // Hent alle unike lag fra gruppespill-kamper
  const VM_TEAMS = [...new Set(
    matches
      .filter(m => getRoundKey(m) === "group" && m.home !== "TBD" && m.away !== "TBD")
      .flatMap(m => [m.home, m.away])
  )].sort();
  const firstKickoff = matches.length > 0 ? matches.reduce((a, b) => new Date(a.kickoff) < new Date(b.kickoff) ? a : b).kickoff : null;
  const locked = firstKickoff ? hasStarted(firstKickoff) : false;
  const myPick = allWinnerPicks[currentUser];
  const [selected, setSelected] = useState(myPick || "");
  const [saved, setSaved] = useState(!!myPick);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function save() {
    if (!selected || locked) return;
    setSaving(true);
    const { error } = await sb.from("winner_picks").upsert({ username: currentUser, team: selected }, { onConflict: "username" });
    setSaving(false);
    if (!error) { setSaved(true); setEditing(false); onSaved(); }
    else alert("Feil: " + error.message);
  }

  const filtered = VM_TEAMS.filter(t => t.toLowerCase().includes(search.toLowerCase()));
  const finalMatch = matches.find(m => m.round === "final" && m.status === "FINISHED");

  return (
    <div className="winner-panel">
      <div className="winner-header">
        <div className="winner-trophy">🏆</div>
        <div>
          <h2 className="winner-title">VM-vinner</h2>
          <p className="winner-sub">Tipp hvem som vinner hele VM · {locked ? "🔒 Låst" : "5 poeng hvis riktig"}</p>
        </div>
      </div>
      {saved && !editing ? (
        <div className="winner-saved">
          <div className="winner-saved-inner">
            <span className="winner-saved-label">Ditt tips:</span>
            <span className="winner-saved-team">{myPick}</span>
            {finalMatch && (() => {
              const w = finalMatch.homeScore > finalMatch.awayScore ? finalMatch.home : finalMatch.homeScore < finalMatch.awayScore ? finalMatch.away : null;
              if (!w) return null;
              const correct = myPick === w;
              return <span className={`pts ${correct ? "pts-3" : "pts-0"}`}>{correct ? "🎯 5 poeng!" : "❌ 0 poeng"}</span>;
            })()}
          </div>
          {!locked && <button className="edit-btn" onClick={() => setEditing(true)}>✏️ Endre</button>}
        </div>
      ) : locked ? (
        <div className="winner-locked">
          {myPick ? <><span className="winner-saved-label">Ditt tips:</span><span className="winner-saved-team">{myPick}</span></> : <span style={{color:"var(--muted)"}}>Du tippet ikke VM-vinner</span>}
        </div>
      ) : (
        <div className="winner-form">
          <input className="auth-input" placeholder="Søk etter lag…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="team-grid">
            {filtered.map(team => (
              <button key={team} className={`team-btn ${selected === team ? "active" : ""}`} onClick={() => setSelected(team)}>{team}</button>
            ))}
          </div>
          <div style={{display:"flex", gap:8}}>
            <button className="auth-btn" style={{flex:1}} onClick={save} disabled={!selected || saving}>
              {saving ? "Lagrer…" : selected ? `Tips: ${selected}` : "Velg et lag"}
            </button>
            {editing && <button className="cancel-btn" onClick={() => { setSelected(myPick); setEditing(false); setSearch(""); }}>Avbryt</button>}
          </div>
        </div>
      )}
      {locked && (
        <div className="winner-others">
          <div className="others-label" style={{marginBottom:8}}>Alle sine tips:</div>
          {Object.entries(allWinnerPicks).length === 0 ? (
            <p style={{color:"var(--muted)", fontSize:"0.82rem"}}>Ingen har tippet ennå</p>
          ) : (
            <div className="winner-others-list">
              {Object.entries(allWinnerPicks).map(([user, team]) => (
                <div key={user} className="winner-other-row">
                  <span>{user}</span>
                  <span className="winner-saved-team" style={{fontSize:"0.9rem"}}>{team}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── LEAGUE PANEL ─────────────────────────────────────────────────────────────
function LeaguePanel({ currentUser, allPicks, matches, allWinnerPicks }) {
  const [leagues, setLeagues] = useState([]);
  const [view, setView] = useState("mine");
  const [newLeagueName, setNewLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [createdCode, setCreatedCode] = useState(null);
  const [activeLeague, setActiveLeague] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLeagues(); }, []);

  async function loadLeagues() {
    setLoading(true);
    const { data } = await sb.from("leagues").select("*");
    setLeagues(data || []);
    setLoading(false);
  }

  async function createLeague() {
    if (newLeagueName.trim().length < 2) { setMsg({ text: "Liganavn må ha minst 2 tegn.", type: "error" }); return; }
    let code = generateCode();
    // ensure unique
    let exists = leagues.find(l => l.code === code);
    while (exists) { code = generateCode(); exists = leagues.find(l => l.code === code); }
    const { error } = await sb.from("leagues").insert({ name: newLeagueName.trim(), code, owner: currentUser, members: [currentUser] });
    if (error) { setMsg({ text: "Feil: " + error.message, type: "error" }); return; }
    await loadLeagues();
    setCreatedCode(code); setNewLeagueName(""); setMsg({ text: "", type: "" });
  }

  async function joinLeague() {
    const code = joinCode.trim();
    if (code.length !== 5) { setMsg({ text: "Koden må være nøyaktig 5 siffer.", type: "error" }); return; }
    const league = leagues.find(l => l.code === code);
    if (!league) { setMsg({ text: "Fant ingen liga med den koden.", type: "error" }); return; }
    if (league.members.includes(currentUser)) { setMsg({ text: "Du er allerede med!", type: "error" }); return; }
    const { error } = await sb.from("leagues").update({ members: [...league.members, currentUser] }).eq("code", code);
    if (error) { setMsg({ text: "Feil: " + error.message, type: "error" }); return; }
    await loadLeagues(); setJoinCode("");
    setMsg({ text: `Du ble med i "${league.name}"! 🎉`, type: "success" });
    setTimeout(() => { setMsg({ text: "", type: "" }); setView("mine"); }, 2000);
  }

  async function leaveOrDeleteLeague(code) {
    const league = leagues.find(l => l.code === code);
    if (!league) return;
    if (league.owner === currentUser) {
      if (!window.confirm("Slett ligaen permanent?")) return;
      await sb.from("leagues").delete().eq("code", code);
    } else {
      await sb.from("leagues").update({ members: league.members.filter(m => m !== currentUser) }).eq("code", code);
    }
    await loadLeagues(); setActiveLeague(null);
  }

  function copyCode(code) {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const myLeagues = leagues.filter(l => l.members?.includes(currentUser));

  if (activeLeague) {
    const league = leagues.find(l => l.code === activeLeague);
    if (!league) return null;
    const members = league.members || [];
    const scores = members.map(user => {
      let pts = 0, exact = 0, correct = 0;
      matches.forEach(m => {
        const pick = allPicks[user]?.[m.id];
        if (!pick) return;
        const p = calcPoints(pick, m);
        if (p === null) return;
        const maxPts = ROUND_POINTS[getRoundKey(m)][0] + ROUND_POINTS[getRoundKey(m)][1];
        pts += p; if (p === maxPts) exact++; if (p > 0) correct++;
      });
      const winnerPick = allWinnerPicks?.[user];
      const finalMatch = matches.find(m => m.round === "final" && m.status === "FINISHED");
      const vmWinner = finalMatch ? (finalMatch.homeScore > finalMatch.awayScore ? finalMatch.home : finalMatch.homeScore < finalMatch.awayScore ? finalMatch.away : null) : null;
      if (vmWinner && winnerPick === vmWinner) pts += 5;
      return { user, pts, exact, correct };
    }).sort((a, b) => b.pts - a.pts || b.exact - a.exact);

    return (
      <div className="league-panel">
        <button className="back-btn" onClick={() => setActiveLeague(null)}>← Tilbake til ligaer</button>
        <div className="league-detail-header">
          <h2 className="league-detail-name">{league.name}</h2>
          <div className="league-code-badge">
            <div><span className="code-label">Invitasjonskode</span><span className="code-value">{league.code}</span></div>
            <button className="copy-btn" onClick={() => copyCode(league.code)}>{copied ? "✓ Kopiert!" : "Kopier"}</button>
          </div>
          <div className="league-meta">{members.length} deltakere · Opprettet av {league.owner}</div>
        </div>
        <table className="lb-table" style={{marginTop:16}}>
          <thead><tr><th>#</th><th>Spiller</th><th>Poeng</th><th>Eksakt</th><th>Riktig</th></tr></thead>
          <tbody>
            {scores.map((s, i) => (
              <tr key={s.user} className={i === 0 ? "lb-first" : ""}>
                <td>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                <td>{s.user}{s.user === currentUser && <span className="you-badge">deg</span>}</td>
                <td><strong>{s.pts}</strong></td>
                <td>{s.exact}</td>
                <td>{s.correct}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="leave-btn" onClick={() => leaveOrDeleteLeague(activeLeague)}>
          {league.owner === currentUser ? "Slett liga" : "Forlat liga"}
        </button>
      </div>
    );
  }

  return (
    <div className="league-panel">
      <div className="league-top-tabs">
        <button className={view === "mine" ? "active" : ""} onClick={() => { setView("mine"); setCreatedCode(null); setMsg({ text: "", type: "" }); }}>Mine ligaer</button>
        <button className={view === "create" ? "active" : ""} onClick={() => { setView("create"); setCreatedCode(null); setMsg({ text: "", type: "" }); }}>Opprett liga</button>
        <button className={view === "join" ? "active" : ""} onClick={() => { setView("join"); setCreatedCode(null); setMsg({ text: "", type: "" }); }}>Bli med</button>
      </div>

      {view === "mine" && (
        <div className="league-list">
          {loading ? <p className="lb-empty">Laster ligaer…</p> : myLeagues.length === 0 ? (
            <div className="league-empty">
              <div style={{fontSize:44}}>🏆</div>
              <p style={{fontWeight:600}}>Du er ikke med i noen ligaer ennå</p>
              <p style={{fontSize:"0.82rem",color:"var(--muted)"}}>Opprett en liga eller bli med med en kode!</p>
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button className="save-btn" style={{padding:"8px 16px"}} onClick={() => setView("create")}>Opprett liga</button>
                <button className="save-btn" style={{padding:"8px 16px",background:"rgba(0,200,83,0.15)",color:"var(--green)"}} onClick={() => setView("join")}>Bli med</button>
              </div>
            </div>
          ) : myLeagues.map(league => (
            <div key={league.code} className="league-item" onClick={() => setActiveLeague(league.code)}>
              <div className="league-item-left">
                <div className="league-item-name">{league.name}</div>
                <div className="league-item-meta">{league.members?.length} deltakere · Kode: <strong style={{color:"var(--gold)",letterSpacing:2}}>{league.code}</strong></div>
              </div>
              <div className="league-item-right">
                {league.owner === currentUser && <span className="owner-badge">Admin</span>}
                <span className="arrow">›</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "create" && (
        <div className="league-form">
          {createdCode ? (
            <div className="created-success">
              <div style={{fontSize:52}}>🎉</div>
              <h3 className="league-detail-name" style={{textAlign:"center"}}>Liga opprettet!</h3>
              <p style={{color:"var(--muted)",fontSize:"0.9rem"}}>Del denne koden med kompisene dine:</p>
              <div className="big-code">{createdCode}</div>
              <p style={{fontSize:"0.8rem",color:"var(--muted)",textAlign:"center",maxWidth:260}}>De går til «Bli med» og skriver inn koden for å joine ligaen din.</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
                <button className="copy-btn" style={{padding:"9px 18px",fontSize:"0.9rem"}} onClick={() => copyCode(createdCode)}>{copied ? "✓ Kopiert!" : "Kopier kode"}</button>
                <button className="save-btn" onClick={() => { setCreatedCode(null); setView("mine"); }}>Se mine ligaer</button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="form-title">Opprett ny liga</h3>
              <p className="form-sub">Gi ligaen et navn – du får en unik 5-sifret kode</p>
              <input className="auth-input" placeholder="Liganavn (f.eks. «Guttegjengen 2026»)" value={newLeagueName} onChange={e => setNewLeagueName(e.target.value)} onKeyDown={e => e.key === "Enter" && createLeague()} />
              {msg.text && <div className="auth-error">{msg.text}</div>}
              <button className="auth-btn" onClick={createLeague}>Opprett liga og generer kode</button>
            </>
          )}
        </div>
      )}

      {view === "join" && (
        <div className="league-form">
          <h3 className="form-title">Bli med i en liga</h3>
          <p className="form-sub">Skriv inn den 5-sifrede invitasjonskoden du har fått</p>
          <input className="auth-input code-field" placeholder="12345" maxLength={5} value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && joinLeague()} />
          {msg.text && <div className={msg.type === "success" ? "auth-success" : "auth-error"}>{msg.text}</div>}
          <button className="auth-btn" onClick={joinLeague}>Bli med i liga</button>
        </div>
      )}
    </div>
  );
}

// ─── MATCHES BY ROUND ─────────────────────────────────────────────────────────
function MatchesByRound({ matches, currentUser, allPicks }) {
  const grouped = {};
  matches.forEach(m => {
    const section = getRoundSection(m);
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(m);
  });
  const sections = ROUND_ORDER.filter(r => grouped[r]);
  if (sections.length === 0) return <p className="lb-empty">Ingen kamper å vise.</p>;
  return (
    <div className="rounds-container">
      {sections.map(section => (
        <div key={section} className="round-section">
          <div className="round-heading"><span className="round-heading-text">{ROUND_LABELS[section]}</span></div>
          <div className="matches-grid">
            {grouped[section].map(m => <MatchCard key={m.id} match={m} currentUser={currentUser} allPicks={allPicks} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [username, setUsername] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("login");
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesError, setMatchesError] = useState(null);
  const [allPicks, setAllPicks] = useState({});
  const [allWinnerPicks, setAllWinnerPicks] = useState({});
  const [tab, setTab] = useState("kamper");
  const [filter, setFilter] = useState("alle");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authWorking, setAuthWorking] = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUsername(session.user.id);
        setPage("home");
      }
      setAuthLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) { loadUsername(session.user.id); setPage("home"); }
      else { setPage("login"); setUsername(""); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadUsername(userId) {
    const { data } = await sb.from("profiles").select("username").eq("id", userId).single();
    if (data) setUsername(data.username);
  }

  useEffect(() => {
    if (!username) return;
    loadAllData();
    fetchMatches().then(m => { setMatches(m); setMatchesLoading(false); }).catch(e => { setMatchesError(e.message); setMatchesLoading(false); });
  }, [username]);

  async function loadAllData() {
    const [picksRes, winnerRes] = await Promise.all([
      sb.from("picks").select("*"),
      sb.from("winner_picks").select("*"),
    ]);
    // Build allPicks: { username: { matchId: pick } }
    const picks = {};
    (picksRes.data || []).forEach(p => {
      if (!picks[p.username]) picks[p.username] = {};
      picks[p.username][p.match_id] = p;
    });
    setAllPicks(picks);
    // Build allWinnerPicks: { username: team }
    const winners = {};
    (winnerRes.data || []).forEach(w => { winners[w.username] = w.team; });
    setAllWinnerPicks(winners);
  }

  async function login() {
    setAuthWorking(true); setAuthError("");
    const { error } = await sb.auth.signInWithPassword({ email: authUsername + "@tipping.no", password: authPassword });
    setAuthWorking(false);
    if (error) setAuthError("Feil brukernavn eller passord.");
  }

  async function register() {
    if (authUsername.length < 2) { setAuthError("Brukernavn må ha minst 2 tegn."); return; }
    if (authPassword.length < 4) { setAuthError("Passord må ha minst 4 tegn."); return; }
    setAuthWorking(true); setAuthError("");
    // Check username taken
    const { data: existing } = await sb.from("profiles").select("id").eq("username", authUsername).single();
    if (existing) { setAuthError("Brukernavnet er tatt."); setAuthWorking(false); return; }
    const { data, error } = await sb.auth.signUp({ email: authUsername + "@tipping.no", password: authPassword });
    if (error) { setAuthError(error.message); setAuthWorking(false); return; }
    // Save profile
    await sb.from("profiles").insert({ id: data.user.id, username: authUsername });
    setAuthWorking(false);
  }

  async function logout() {
    await sb.auth.signOut();
    setUsername(""); setAllPicks({}); setAllWinnerPicks({});
  }

  const filteredMatches = filter === "alle" ? matches : matches.filter(m => getRoundSection(m) === filter);

  if (authLoading) return (
    <div className="auth-bg" style={{justifyContent:"center",alignItems:"center",display:"flex"}}>
      <div style={{color:"var(--green)",fontFamily:"'Bebas Neue',cursive",fontSize:"2rem",letterSpacing:3}}>Laster…</div>
      <style>{CSS}</style>
    </div>
  );

  if (!session) return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">⚽</div>
        <h1 className="auth-title">VM Predictions 2026</h1>
        <p className="auth-sub">Tips med venner – hvem er best?</p>
        <div className="auth-tabs">
          <button className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setAuthError(""); }}>Logg inn</button>
          <button className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); setAuthError(""); }}>Registrer</button>
        </div>
        <input className="auth-input" placeholder="Brukernavn" value={authUsername} onChange={e => setAuthUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && (authMode === "login" ? login() : register())} />
        <input className="auth-input" type="password" placeholder="Passord" value={authPassword} onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && (authMode === "login" ? login() : register())} />
        {authError && <div className="auth-error">{authError}</div>}
        <button className="auth-btn" onClick={authMode === "login" ? login : register} disabled={authWorking}>
          {authWorking ? "Venter…" : authMode === "login" ? "Logg inn" : "Opprett konto"}
        </button>
      </div>
      <style>{CSS}</style>
    </div>
  );

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="header-logo">⚽</span>
          <div>
            <div className="header-title">VM Predictions 2026</div>
            <div className="header-user">Hei, {username}!</div>
          </div>
        </div>
        <button className="logout-btn" onClick={logout}>Logg ut</button>
      </header>



      <nav className="tabs">
        <button className={tab === "kamper" ? "active" : ""} onClick={() => setTab("kamper")}>Kamper</button>
        <button className={tab === "vinner" ? "active" : ""} onClick={() => setTab("vinner")}>🌍 VM-vinner</button>
        <button className={tab === "ledertavle" ? "active" : ""} onClick={() => setTab("ledertavle")}>Ledertavle</button>
        <button className={tab === "ligaer" ? "active" : ""} onClick={() => setTab("ligaer")}>🏆 Ligaer</button>
        <button className={tab === "regler" ? "active" : ""} onClick={() => setTab("regler")}>📋 Regler</button>
      </nav>

      {tab === "kamper" && (
        <>
          <div className="round-tabs">
            <button className={filter === "alle" ? "active" : ""} onClick={() => setFilter("alle")}>Alle</button>
            <button className={filter === "group_1" ? "active" : ""} onClick={() => setFilter("group_1")}>Runde 1</button>
            <button className={filter === "group_2" ? "active" : ""} onClick={() => setFilter("group_2")}>Runde 2</button>
            <button className={filter === "group_3" ? "active" : ""} onClick={() => setFilter("group_3")}>Runde 3</button>
            <button className={filter === "r16" ? "active" : ""} onClick={() => setFilter("r16")}>16-delsfinale</button>
            <button className={filter === "r8" ? "active" : ""} onClick={() => setFilter("r8")}>8-delsfinale</button>
            <button className={filter === "qf" ? "active" : ""} onClick={() => setFilter("qf")}>Kvartfinale</button>
            <button className={filter === "semi" ? "active" : ""} onClick={() => setFilter("semi")}>Semifinale</button>
            <button className={filter === "final" ? "active" : ""} onClick={() => setFilter("final")}>Finale</button>
          </div>
          {matchesLoading ? <div className="loading-state">⏳ Laster kamper…</div>
           : matchesError ? <div className="error-state">⚠️ {matchesError}</div>
           : <MatchesByRound matches={filteredMatches} currentUser={username} allPicks={allPicks} />}
        </>
      )}

      {tab === "vinner" && <WinnerPick currentUser={username} matches={matches} allWinnerPicks={allWinnerPicks} onSaved={loadAllData} />}
      {tab === "ledertavle" && <Leaderboard allPicks={allPicks} matches={matches} allWinnerPicks={allWinnerPicks} />}
      {tab === "ligaer" && <LeaguePanel currentUser={username} allPicks={allPicks} matches={matches} allWinnerPicks={allWinnerPicks} />}

      {tab === "regler" && (
        <div className="rules-panel">
          <h2 className="lb-title">📋 Regler</h2>
          <div className="rules-content">
            <div className="rule-section">
              <h3 className="rule-heading">🎯 Slik tipper du</h3>
              <p>Du skal tippe hvilket lag som vinner og hva stillingen blir i hver kamp. Poengene du kan vinne står øverst til høyre i hvert kampkort – første tall er poeng for riktig lag, andre tall er bonuspoeng for riktig stilling.</p>
            </div>

            <div className="rule-section">
              <h3 className="rule-heading">📊 Poengsystem</h3>
              <div className="points-table">
                <div className="points-row"><span>Gruppespill</span><span className="points-val">2 + 1p</span></div>
                <div className="points-row"><span>16-delsfinale</span><span className="points-val">3 + 1p</span></div>
                <div className="points-row"><span>8-delsfinale</span><span className="points-val">3 + 2p</span></div>
                <div className="points-row"><span>Kvartfinale</span><span className="points-val">4 + 2p</span></div>
                <div className="points-row"><span>Semifinale</span><span className="points-val">4 + 3p</span></div>
                <div className="points-row"><span>Finale</span><span className="points-val">5 + 3p</span></div>
              </div>
              <p style={{marginTop: 10}}>Du må ha riktig lag for å få bonuspoeng for riktig stilling. Poengene øker jo lenger vi kommer i VM.</p>
            </div>

            <div className="rule-section">
              <h3 className="rule-heading">⚽ Uavgjort i sluttspillet</h3>
              <p>Tipper du uavgjort i sluttspillet, må du også velge hvem du tror går videre. Tipper du feil lag som går videre, får du ingen poeng – selv om stillingen var riktig.</p>
            </div>

            <div className="rule-section">
              <h3 className="rule-heading">🏆 VM-vinner</h3>
              <p>Før VM begynner skal alle tippe hvilket lag som vinner hele VM. Får du riktig, får du <strong>5 bonuspoeng</strong>. Dette låses når første kamp sparkes i gang.</p>
            </div>

            <div className="rule-section">
              <h3 className="rule-heading">🤝 Likt poengsum</h3>
              <p>Er det likt poengsum mellom to spillere, er det den med flest bonuspoeng (eksakte stilinger) som vinner.</p>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">© Copyright Christian Herbertdinho Herbert</footer>

      <style>{CSS}</style>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --green: #00c853; --green-dark: #009624; --grass: #1a3a2a;
    --gold: #ffd600; --red: #ff3d3d; --text: #f0f4f0;
    --muted: #8aab96; --card: rgba(255,255,255,0.05); --card-border: rgba(255,255,255,0.1);
  }
  body { background: var(--grass); font-family: 'DM Sans', sans-serif; color: var(--text); min-height: 100vh; }

  .auth-bg { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 40% 30%, #0d3d1f 0%, #071a0e 100%); }
  .auth-card { background: rgba(255,255,255,0.06); border: 1px solid var(--card-border); backdrop-filter: blur(20px); border-radius: 20px; padding: 40px 36px; width: 360px; display: flex; flex-direction: column; align-items: center; gap: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  .auth-logo { font-size: 48px; animation: spin 4s ease-in-out infinite; }
  @keyframes spin { 0%,100%{transform:rotate(-5deg)} 50%{transform:rotate(5deg)} }
  .auth-title { font-family: 'Bebas Neue', cursive; font-size: 2.4rem; letter-spacing: 3px; color: var(--green); }
  .auth-sub { color: var(--muted); font-size: 0.85rem; }
  .auth-tabs { display: flex; border: 1px solid var(--card-border); border-radius: 10px; overflow: hidden; width: 100%; }
  .auth-tabs button { flex: 1; padding: 10px; background: transparent; border: none; color: var(--muted); cursor: pointer; font-family: inherit; font-size: 0.9rem; transition: all .2s; }
  .auth-tabs button.active { background: var(--green); color: #000; font-weight: 700; }
  .auth-input { width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.07); border: 1px solid var(--card-border); border-radius: 10px; color: var(--text); font-family: inherit; font-size: 0.95rem; outline: none; transition: border .2s; }
  .auth-input:focus { border-color: var(--green); }
  .auth-error { color: var(--red); font-size: 0.82rem; text-align: center; }
  .auth-success { color: var(--green); font-size: 0.88rem; text-align: center; font-weight: 600; }
  .auth-btn { width: 100%; padding: 13px; background: var(--green); border: none; border-radius: 10px; color: #000; font-weight: 700; font-size: 1rem; cursor: pointer; font-family: inherit; transition: background .2s; letter-spacing: 0.5px; }
  .auth-btn:hover:not(:disabled) { background: var(--green-dark); color: #fff; }
  .auth-btn:disabled { opacity: 0.6; cursor: default; }

  .app { max-width: 900px; margin: 0 auto; padding: 0 16px 40px; }
  .header { display: flex; align-items: center; justify-content: space-between; padding: 20px 0 12px; border-bottom: 1px solid var(--card-border); }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .header-logo { font-size: 32px; }
  .header-title { font-family: 'Bebas Neue', cursive; font-size: 1.6rem; letter-spacing: 2px; color: var(--green); }
  .header-user { font-size: 0.8rem; color: var(--muted); }
  .logout-btn { background: transparent; border: 1px solid var(--card-border); color: var(--muted); padding: 7px 14px; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 0.82rem; transition: all .2s; }
  .logout-btn:hover { border-color: var(--red); color: var(--red); }
  .api-notice { font-size: 0.75rem; color: var(--muted); text-align: center; padding: 6px 0 2px; }
  .tabs { display: flex; gap: 4px; margin: 16px 0 4px; flex-wrap: wrap; }
  .tabs button, .filter-bar button { padding: 8px 18px; background: transparent; border: 1px solid var(--card-border); border-radius: 8px; color: var(--muted); cursor: pointer; font-family: inherit; font-size: 0.88rem; transition: all .2s; }
  .tabs button.active, .filter-bar button.active { background: var(--green); border-color: var(--green); color: #000; font-weight: 700; }
  .round-tabs { display: flex; gap: 6px; margin: 12px 0 16px; flex-wrap: wrap; }
  .round-tabs button { padding: 7px 14px; background: transparent; border: 1px solid var(--card-border); border-radius: 8px; color: var(--muted); cursor: pointer; font-family: inherit; font-size: 0.82rem; transition: all .2s; white-space: nowrap; }
  .round-tabs button.active { background: var(--gold); border-color: var(--gold); color: #000; font-weight: 700; }
  .round-tabs button:hover:not(.active) { border-color: rgba(255,214,0,0.4); color: var(--gold); }

  .loading-state, .error-state { text-align: center; padding: 40px; color: var(--muted); font-size: 0.95rem; }
  .error-state { color: var(--red); }
  .rounds-container { display: flex; flex-direction: column; gap: 28px; }
  .round-heading { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .round-heading-text { font-family: 'Bebas Neue', cursive; font-size: 1.3rem; letter-spacing: 2px; color: var(--gold); white-space: nowrap; }
  .round-heading::after { content: ''; flex: 1; height: 1px; background: rgba(255,214,0,0.2); }
  .matches-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }

  .match-card { background: var(--card); border: 1px solid var(--card-border); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 10px; transition: transform .2s, border-color .2s; }
  .match-card:hover { transform: translateY(-2px); border-color: rgba(0,200,83,0.3); }
  .match-card.finished { border-color: rgba(255,214,0,0.2); }
  .match-card.live { border-color: var(--red); box-shadow: 0 0 12px rgba(255,61,61,0.2); }
  .match-group-badge { display: inline-block; background: rgba(0,200,83,0.15); color: var(--green); font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; width: fit-content; letter-spacing: 1px; }
  .pts-info { font-size: 0.72rem; color: var(--muted); font-weight: 600; background: rgba(255,255,255,0.06); padding: 3px 7px; border-radius: 4px; }
  .match-time { font-size: 0.78rem; color: var(--muted); }
  .match-teams { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .team { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
  .team span { font-size: 0.8rem; font-weight: 600; text-align: center; }
  .flag { width: 44px; height: 30px; object-fit: cover; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
  .match-vs { font-family: 'Bebas Neue', cursive; font-size: 1.1rem; color: var(--muted); }
  .actual-result { text-align: center; }
  .result-label { display: block; font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
  .result-score { font-family: 'Bebas Neue', cursive; font-size: 2rem; color: var(--gold); letter-spacing: 4px; }
  .pick-section { display: flex; flex-direction: column; gap: 8px; }
  .pick-inputs { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .score-input { width: 52px; padding: 8px; text-align: center; background: rgba(255,255,255,0.08); border: 1px solid var(--card-border); border-radius: 8px; color: var(--text); font-size: 1.2rem; font-weight: 700; font-family: inherit; outline: none; transition: border .2s; }
  .score-input:focus { border-color: var(--green); }
  .dash { font-size: 1.2rem; color: var(--muted); }
  .save-btn { padding: 9px; background: var(--green); border: none; border-radius: 8px; color: #000; font-weight: 700; cursor: pointer; font-family: inherit; font-size: 0.88rem; transition: all .2s; }
  .save-btn:disabled { opacity: 0.5; cursor: default; }
  .edit-btn { padding: 8px; background: rgba(255,255,255,0.07); border: 1px solid var(--card-border); border-radius: 8px; color: var(--text); cursor: pointer; font-family: inherit; font-size: 0.85rem; transition: all .2s; }
  .edit-btn:hover { border-color: var(--green); color: var(--green); }
  .cancel-btn { padding: 9px 12px; background: transparent; border: 1px solid var(--card-border); border-radius: 8px; color: var(--muted); cursor: pointer; font-family: inherit; font-size: 0.85rem; transition: all .2s; white-space: nowrap; }
  .cancel-btn:hover { border-color: var(--red); color: var(--red); }
  .saved-pick-row { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }
  .pick-count { font-size: 0.75rem; color: var(--muted); text-align: center; }
  .my-pick-reveal { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .pick-label { font-size: 0.8rem; color: var(--muted); }
  .pick-score { font-family: 'Bebas Neue', cursive; font-size: 1.4rem; letter-spacing: 3px; }
  .pts { font-size: 0.85rem; font-weight: 700; }
  .pts-3 { color: var(--gold); } .pts-1 { color: var(--green); } .pts-0 { color: var(--red); }
  .no-pick { font-size: 0.8rem; color: var(--muted); text-align: center; }
  .others-picks { border-top: 1px solid var(--card-border); padding-top: 8px; }
  .others-label { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .other-pick-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 0.82rem; }
  .other-user { flex: 1; } .other-score { font-family: 'Bebas Neue', cursive; font-size: 1rem; letter-spacing: 2px; }
  .pts-sm { font-size: 0.75rem; font-weight: 700; min-width: 24px; text-align: right; }
  .qualifier-section { background: rgba(255,255,255,0.04); border: 1px solid var(--card-border); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
  .qualifier-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; text-align: center; }
  .qualifier-btns { display: flex; gap: 6px; }
  .qualifier-btn { flex: 1; padding: 8px 6px; background: rgba(255,255,255,0.05); border: 1px solid var(--card-border); border-radius: 8px; color: var(--text); cursor: pointer; font-family: inherit; font-size: 0.78rem; font-weight: 600; transition: all .2s; }
  .qualifier-btn:hover { border-color: rgba(0,200,83,0.4); }
  .qualifier-btn.active { background: rgba(0,200,83,0.2); border-color: var(--green); color: var(--green); }
  .qualifier-badge { background: rgba(0,200,83,0.12); color: var(--green); font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; }

  .leaderboard { padding: 20px 0; }
  .lb-title { font-family: 'Bebas Neue', cursive; font-size: 2rem; letter-spacing: 3px; margin-bottom: 16px; color: var(--gold); }
  .lb-empty { color: var(--muted); }
  .lb-table { width: 100%; border-collapse: collapse; }
  .lb-table th { text-align: left; font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; padding: 8px 12px; border-bottom: 1px solid var(--card-border); }
  .lb-table td { padding: 12px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.92rem; }
  .lb-first td { color: var(--gold); background: rgba(255,214,0,0.05); }
  .lb-table tr:hover td { background: rgba(255,255,255,0.03); }

  .winner-panel { padding: 20px 0; max-width: 560px; }
  .winner-header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
  .winner-trophy { font-size: 40px; }
  .winner-title { font-family: 'Bebas Neue', cursive; font-size: 1.8rem; letter-spacing: 2px; color: var(--gold); }
  .winner-sub { font-size: 0.82rem; color: var(--muted); margin-top: 2px; }
  .winner-saved { display: flex; flex-direction: column; gap: 10px; }
  .winner-saved-inner { display: flex; align-items: center; gap: 10px; background: rgba(255,214,0,0.07); border: 1px solid rgba(255,214,0,0.2); border-radius: 12px; padding: 14px 18px; flex-wrap: wrap; }
  .winner-saved-label { font-size: 0.8rem; color: var(--muted); }
  .winner-saved-team { font-family: 'Bebas Neue', cursive; font-size: 1.4rem; letter-spacing: 2px; color: var(--gold); }
  .winner-locked { background: rgba(255,255,255,0.04); border: 1px solid var(--card-border); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; gap: 10px; }
  .winner-form { display: flex; flex-direction: column; gap: 12px; }
  .team-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px; max-height: 260px; overflow-y: auto; padding: 4px 2px; }
  .team-btn { padding: 8px 10px; background: rgba(255,255,255,0.05); border: 1px solid var(--card-border); border-radius: 8px; color: var(--text); cursor: pointer; font-family: inherit; font-size: 0.82rem; transition: all .15s; text-align: left; }
  .team-btn:hover { border-color: rgba(255,214,0,0.4); background: rgba(255,214,0,0.06); }
  .team-btn.active { background: rgba(255,214,0,0.15); border-color: var(--gold); color: var(--gold); font-weight: 700; }
  .winner-others { margin-top: 20px; border-top: 1px solid var(--card-border); padding-top: 16px; }
  .winner-others-list { display: flex; flex-direction: column; gap: 6px; }
  .winner-other-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--card); border-radius: 8px; font-size: 0.85rem; }

  .league-panel { padding: 20px 0; }
  .league-top-tabs { display: flex; gap: 6px; margin-bottom: 24px; flex-wrap: wrap; }
  .league-top-tabs button { padding: 9px 18px; background: transparent; border: 1px solid var(--card-border); border-radius: 8px; color: var(--muted); cursor: pointer; font-family: inherit; font-size: 0.88rem; transition: all .2s; }
  .league-top-tabs button.active { background: var(--green); border-color: var(--green); color: #000; font-weight: 700; }
  .league-list { display: flex; flex-direction: column; gap: 10px; }
  .league-empty { text-align: center; padding: 40px 20px; color: var(--muted); display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .league-item { background: var(--card); border: 1px solid var(--card-border); border-radius: 14px; padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all .2s; }
  .league-item:hover { border-color: rgba(0,200,83,0.4); transform: translateY(-1px); background: rgba(255,255,255,0.07); }
  .league-item-name { font-weight: 700; font-size: 1rem; margin-bottom: 4px; }
  .league-item-meta { font-size: 0.78rem; color: var(--muted); }
  .league-item-right { display: flex; align-items: center; gap: 8px; }
  .owner-badge { background: rgba(255,214,0,0.15); color: var(--gold); font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; }
  .arrow { font-size: 1.6rem; color: var(--muted); line-height: 1; }
  .league-form { max-width: 400px; display: flex; flex-direction: column; gap: 14px; padding: 4px 0; }
  .form-title { font-family: 'Bebas Neue', cursive; font-size: 1.7rem; letter-spacing: 2px; color: var(--green); }
  .form-sub { font-size: 0.83rem; color: var(--muted); margin-top: -6px; line-height: 1.5; }
  .code-field { font-size: 2rem !important; letter-spacing: 12px; font-weight: 700; text-align: center; padding: 14px !important; }
  .created-success { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; padding: 16px 0 24px; }
  .big-code { font-family: 'Bebas Neue', cursive; font-size: 4.5rem; letter-spacing: 14px; color: var(--gold); background: rgba(255,214,0,0.07); border: 2px dashed rgba(255,214,0,0.35); padding: 18px 36px; border-radius: 18px; line-height: 1; }
  .league-detail-header { margin-bottom: 8px; }
  .league-detail-name { font-family: 'Bebas Neue', cursive; font-size: 2rem; letter-spacing: 3px; color: var(--green); margin-bottom: 12px; }
  .league-code-badge { display: inline-flex; align-items: center; gap: 12px; background: rgba(255,214,0,0.07); border: 1px solid rgba(255,214,0,0.2); border-radius: 12px; padding: 10px 16px; margin-bottom: 8px; }
  .code-label { display: block; font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
  .code-value { font-family: 'Bebas Neue', cursive; font-size: 1.6rem; letter-spacing: 8px; color: var(--gold); display: block; }
  .copy-btn { background: rgba(255,255,255,0.08); border: 1px solid var(--card-border); color: var(--text); padding: 6px 12px; border-radius: 7px; font-size: 0.78rem; cursor: pointer; font-family: inherit; transition: all .2s; white-space: nowrap; }
  .copy-btn:hover { background: var(--green); color: #000; border-color: var(--green); }
  .league-meta { font-size: 0.78rem; color: var(--muted); }
  .back-btn { background: transparent; border: 1px solid var(--card-border); color: var(--muted); padding: 7px 14px; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 0.85rem; margin-bottom: 18px; transition: all .2s; }
  .back-btn:hover { border-color: var(--green); color: var(--green); }
  .you-badge { background: rgba(0,200,83,0.15); color: var(--green); font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 6px; vertical-align: middle; }
  .leave-btn { margin-top: 20px; background: transparent; border: 1px solid rgba(255,61,61,0.3); color: var(--red); padding: 9px 18px; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 0.85rem; transition: all .2s; }
  .leave-btn:hover { background: rgba(255,61,61,0.1); }
  .footer { text-align: center; padding: 30px 0 10px; font-size: 0.75rem; color: var(--muted); }
  .rules-panel { padding: 20px 0; max-width: 680px; }
  .rules-content { display: flex; flex-direction: column; gap: 20px; }
  .rule-section { background: var(--card); border: 1px solid var(--card-border); border-radius: 16px; padding: 20px 24px; }
  .rule-heading { font-family: 'Bebas Neue', cursive; font-size: 1.2rem; letter-spacing: 1.5px; color: var(--green); margin-bottom: 10px; }
  .rule-section p { font-size: 0.9rem; color: var(--text); line-height: 1.7; }
  .points-table { display: flex; flex-direction: column; gap: 6px; }
  .points-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 12px; background: rgba(255,255,255,0.04); border-radius: 8px; font-size: 0.88rem; }
  .points-val { font-family: 'Bebas Neue', cursive; font-size: 1.1rem; letter-spacing: 2px; color: var(--gold); }
`;
