import { useState, useEffect, useRef } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://bbhjaijltanclqwrbwhi.supabase.co";
const SUPABASE_KEY = "sb_publishable_MQ6-ownm4rac2Bi0wswAAQ_Y3DBS0kD";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, { ...options, cache: "no-store" });
    },
  },
});

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
  const apiMatches = await res.json();

  const { data: manual } = await sb.from("manual_results").select("match_id,home_score,away_score,status,qualifier");
  const manualMap = {};
  (manual || []).forEach(r => { manualMap[r.match_id] = r; });

  return apiMatches.map(m => {
    const override = manualMap[m.id];
    if (override) {
      return {
        ...m,
        homeScore: override.home_score,
        awayScore: override.away_score,
        status: override.status || "FINISHED",
        qualifier: override.qualifier || null,
      };
    }
    return m;
  });
}

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

  // Faktisk vinner (via qualifier eller direkte seier)
  const actualWinner = match.qualifier
    ? match.qualifier
    : mh > ma ? match.home : mh < ma ? match.away : null;

  // Hvem spilleren tippet går videre
  const pickedWinner = pick.qualifier
    ? pick.qualifier
    : ph > pa ? match.home : ph < pa ? match.away : null;

  // Eksakt stilling etter 90 min
  if (ph === mh && pa === ma) {
    if (isKnockout) {
      if (!actualWinner) return base + bonus;
      if (pickedWinner && pickedWinner === actualWinner) return base + bonus;
      return base; // riktig stilling, feil lag videre
    }
    return base + bonus;
  }

  // Ikke eksakt stilling
  if (isKnockout) {
    if (actualWinner && pickedWinner && pickedWinner === actualWinner) return base;
    return 0;
  }

  // Gruppespill: basepoeng for riktig utfall
  const pickWinner = ph > pa ? "home" : ph < pa ? "away" : "draw";
  const matchWinner = mh > ma ? "home" : mh < ma ? "away" : "draw";
  if (pickWinner === matchWinner) return base;
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

// ─── COUNTDOWN TIMER ─────────────────────────────────────────────────────────
function Countdown({ kickoff }) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    function update() {
      const diff = new Date(kickoff) - new Date();
      if (diff <= 0) { setTimeLeft(""); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) setTimeLeft(`${h}t ${m}m`);
      else if (m > 0) setTimeLeft(`${m}m ${s}s`);
      else setTimeLeft(`${s}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [kickoff]);
  if (!timeLeft) return null;
  return <div className="countdown">⏱ {timeLeft}</div>;
}

// ─── CONFETTI ────────────────────────────────────────────────────────────────
function Confetti() {
  const colors = ["#ffd600","#00c853","#ff3d3d","#ffffff","#00b0ff"];
  const pieces = Array.from({length: 40}, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.2 + Math.random() * 0.8,
    size: 6 + Math.random() * 8,
  }));
  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: `${p.left}%`, background: p.color,
          width: p.size, height: p.size,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.duration}s`,
        }} />
      ))}
    </div>
  );
}
function MatchCard({ match, currentUser, allPicks }) {
  const myPick = allPicks[currentUser]?.[match.id];
  const started = hasStarted(match.kickoff);
  const [home, setHome] = useState(myPick?.home_score ?? 0);
  const [away, setAway] = useState(myPick?.away_score ?? 0);
  const [qualifier, setQualifier] = useState(myPick?.qualifier ?? "");
  const [saved, setSaved] = useState(!!myPick);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAllPicks, setShowAllPicks] = useState(false);

  const isKnockout = getRoundKey(match) !== "group";
  const pickIsDrawn = home !== "" && away !== "" && parseInt(home) === parseInt(away);
  const needsQualifier = isKnockout && pickIsDrawn;
  const roundKey = getRoundKey(match);
  const [base, bonus] = ROUND_POINTS[roundKey];
  const maxPts = base + bonus;
  const pts = myPick ? calcPoints(myPick, match) : null;
  const countPicked = Object.values(allPicks).filter(u => u[match.id]).length;

  async function savePick() {
    if (home === "" || away === "" || home === null || away === null) return;
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

  const isLive = match.status === "LIVE";
  const showConfetti = pts !== null && pts === maxPts;

  return (
    <div className={`match-card ${match.status === "FINISHED" ? "finished" : isLive ? "live" : ""}`} style={{position:"relative"}}>
      {showConfetti && <Confetti />}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div className="match-group-badge">{match.group ? `Gruppe ${match.group}` : roundLabel(match.round)}</div>
        <div style={{display:"flex", alignItems:"center", gap:6}}>
          {isLive && <span className="live-pulse"><span className="live-dot" /></span>}
          <div className="pts-info">{base}+{bonus}p</div>
        </div>
      </div>
      <div className="match-time">
        {formatKickoff(match.kickoff)}
        {!started && <Countdown kickoff={match.kickoff} />}
      </div>
      <div className="match-teams">
        <div className="team"><img src={match.homeFlagUrl} alt={match.home} className="flag" /><span>{match.home}</span></div>
        <div className="match-vs">VS</div>
        <div className="team"><img src={match.awayFlagUrl} alt={match.away} className="flag" /><span>{match.away}</span></div>
      </div>
      {match.status === "FINISHED" && (
        <div className="actual-result">
          <span className="result-label">Resultat</span>
          <span className="result-score">{match.homeScore} – {match.awayScore}</span>
          {match.qualifier && <div className="qualifier-badge" style={{marginTop:4}}>➜ {match.qualifier} gikk videre</div>}
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
          {started && (
            <div className="others-picks">
              <button className="others-toggle" onClick={() => setShowAllPicks(!showAllPicks)}>
                {showAllPicks ? "▲ Skjul alle tips" : "▼ Vis alle tips"}
              </button>
              {showAllPicks && (
                <div className="others-list">
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
      )}
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
function Leaderboard({ allPicks, matches, memberFilter, allWinnerPicks, allFullNames }) {
  const users = memberFilter
    ? Object.keys(allPicks).filter(u => memberFilter.includes(u))
    : Object.keys(allPicks);

  const finalMatch = matches.find(m => m.round === "final" && m.status === "FINISHED");
  const vmWinner = finalMatch ? (finalMatch.homeScore > finalMatch.awayScore ? finalMatch.home : finalMatch.homeScore < finalMatch.awayScore ? finalMatch.away : null) : null;

  // Skjul VM-tipp til første kamp er i gang
  const firstKickoff = matches.length > 0 ? matches.reduce((a, b) => new Date(a.kickoff) < new Date(b.kickoff) ? a : b).kickoff : null;
  const vmTippVisible = firstKickoff ? hasStarted(firstKickoff) : false;

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
        <div className="table-scroll">
        <table className="lb-table">
          <thead><tr><th>#</th><th>Spiller</th><th>Ekte navn</th><th>Poeng</th><th>Eksakt</th><th>Riktig</th>{vmTippVisible && <th>VM-tipp</th>}</tr></thead>
          <tbody>
            {scores.map((s, i) => (
              <tr key={s.user} className={i === 0 ? "lb-first" : ""}>
                <td>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                <td>{s.user}</td>
                <td style={{fontSize:"0.82rem", color:"var(--muted)"}}>{allFullNames?.[s.user] || "–"}</td>
                <td><strong>{s.pts}</strong></td>
                <td>{s.exact}</td>
                <td>{s.correct}</td>
                {vmTippVisible && <td style={{fontSize:"0.78rem"}}>{s.winnerPick || <span style={{color:"var(--muted)"}}>–</span>}{s.winnerBonus > 0 && <span className="pts pts-3" style={{marginLeft:4}}>+5</span>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
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
function LeaguePanel({ currentUser, allPicks, matches, allWinnerPicks, allFullNames }) {
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
    const isOwner = league.owner === currentUser;
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

        const firstKickoff = matches.length > 0 ? matches.reduce((a, b) => new Date(a.kickoff) < new Date(b.kickoff) ? a : b).kickoff : null;
        const vmTippVisible = firstKickoff ? hasStarted(firstKickoff) : false;
        const finalMatch = matches.find(m => m.round === "final" && m.status === "FINISHED");
        const vmWinner = finalMatch ? (finalMatch.homeScore > finalMatch.awayScore ? finalMatch.home : finalMatch.homeScore < finalMatch.awayScore ? finalMatch.away : null) : null;

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
          {isOwner && (
            <div className="prize-edit-section">
              <div className="prize-edit-row">
                <span className="prize-label">🥇 1. plass:</span>
                <input className="prize-input" placeholder="Premie for 1. plass…" defaultValue={league.prize1 || ""}
                  onBlur={async e => { await sb.from("leagues").update({ prize1: e.target.value.trim() || null }).eq("code", activeLeague); await loadLeagues(); }} />
              </div>
              <div className="prize-edit-row">
                <span className="prize-label">🥈 2. plass:</span>
                <input className="prize-input" placeholder="Premie for 2. plass…" defaultValue={league.prize2 || ""}
                  onBlur={async e => { await sb.from("leagues").update({ prize2: e.target.value.trim() || null }).eq("code", activeLeague); await loadLeagues(); }} />
              </div>
              <div className="prize-edit-row">
                <span className="prize-label">🥉 3. plass:</span>
                <input className="prize-input" placeholder="Premie for 3. plass…" defaultValue={league.prize3 || ""}
                  onBlur={async e => { await sb.from("leagues").update({ prize3: e.target.value.trim() || null }).eq("code", activeLeague); await loadLeagues(); }} />
              </div>
              <div className="prize-edit-row">
                <span className="prize-label">4. plass:</span>
                <input className="prize-input" placeholder="Premie for 4. plass…" defaultValue={league.prize4 || ""}
                  onBlur={async e => { await sb.from("leagues").update({ prize4: e.target.value.trim() || null }).eq("code", activeLeague); await loadLeagues(); }} />
              </div>
              <div className="prize-edit-row">
                <span className="prize-label">5. plass:</span>
                <input className="prize-input" placeholder="Premie for 5. plass…" defaultValue={league.prize5 || ""}
                  onBlur={async e => { await sb.from("leagues").update({ prize5: e.target.value.trim() || null }).eq("code", activeLeague); await loadLeagues(); }} />
              </div>
            </div>
          )}
          {!isOwner && (league.prize1 || league.prize2 || league.prize3 || league.prize4 || league.prize5) && (
            <div className="prize-display-section">
              {league.prize1 && <div className="prize-display">🥇 1. plass: <strong>{league.prize1}</strong></div>}
              {league.prize2 && <div className="prize-display">🥈 2. plass: <strong>{league.prize2}</strong></div>}
              {league.prize3 && <div className="prize-display">🥉 3. plass: <strong>{league.prize3}</strong></div>}
              {league.prize4 && <div className="prize-display">4. plass: <strong>{league.prize4}</strong></div>}
              {league.prize5 && <div className="prize-display">5. plass: <strong>{league.prize5}</strong></div>}
            </div>
          )}
        </div>
        {(() => {
          const firstKickoff = matches.length > 0 ? matches.reduce((a, b) => new Date(a.kickoff) < new Date(b.kickoff) ? a : b).kickoff : null;
          const vmTippVisible = firstKickoff ? hasStarted(firstKickoff) : false;
          const finalMatch = matches.find(m => m.round === "final" && m.status === "FINISHED");
          const vmWinner = finalMatch ? (finalMatch.homeScore > finalMatch.awayScore ? finalMatch.home : finalMatch.homeScore < finalMatch.awayScore ? finalMatch.away : null) : null;
          return (
            <div className="table-scroll">
            <table className="lb-table" style={{marginTop:16}}>
              <thead><tr><th>#</th><th>Spiller</th><th>Ekte navn</th><th>Poeng</th><th>Eksakt</th><th>Riktig</th>{vmTippVisible && <th>VM-tipp</th>}<th>Premie</th></tr></thead>
              <tbody>
                {scores.map((s, i) => (
                  <tr key={s.user} className={i === 0 ? "lb-first" : ""}>
                    <td>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                    <td>{s.user}{s.user === currentUser && <span className="you-badge">deg</span>}</td>
                    <td style={{fontSize:"0.82rem", color:"var(--muted)"}}>{allFullNames?.[s.user] || "–"}</td>
                    <td><strong>{s.pts}</strong></td>
                    <td>{s.exact}</td>
                    <td>{s.correct}</td>
                    {vmTippVisible && <td style={{fontSize:"0.78rem"}}>{allWinnerPicks?.[s.user] ? <span style={{color: vmWinner && allWinnerPicks[s.user] === vmWinner ? "var(--gold)" : "var(--muted)"}}>{allWinnerPicks[s.user]}{vmWinner && allWinnerPicks[s.user] === vmWinner && " 🎯"}</span> : "–"}</td>}
                    <td style={{fontSize:"0.82rem"}}>
                      {i === 0 && league.prize1 ? <span className="pts pts-3">🥇 {league.prize1}</span>
                      : i === 1 && league.prize2 ? <span className="pts pts-1">🥈 {league.prize2}</span>
                      : i === 2 && league.prize3 ? <span style={{color:"#cd7f32", fontWeight:700}}>🥉 {league.prize3}</span>
                      : i === 3 && league.prize4 ? <span style={{color:"var(--muted)", fontWeight:600}}>4. {league.prize4}</span>
                      : i === 4 && league.prize5 ? <span style={{color:"var(--muted)", fontWeight:600}}>5. {league.prize5}</span>
                      : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          );
        })()}
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

// ─── CHAT ─────────────────────────────────────────────────────────────────────
function Chat({ currentUser }) {
  const isAdmin = currentUser.toLowerCase() === "herbertdinho";
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    loadMessages();
    // Sanntid-oppdatering
    const channel = sb.channel("chat").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages" },
      () => loadMessages()
    ).subscribe();
    return () => sb.removeChannel(channel);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages() {
    const { data } = await sb.from("messages").select("*").order("created_at", { ascending: true }).limit(200);
    setMessages(data || []);
    setLoading(false);
  }

  async function sendMessage() {
    if (!input.trim()) return;
    await sb.from("messages").insert({ username: currentUser, content: input.trim() });
    setInput("");
  }

  async function deleteMessage(id) {
    await sb.from("messages").delete().eq("id", id);
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" }) +
      " · " + d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  }

  return (
    <div className="chat-panel">
      <h2 className="lb-title">💬 Chat</h2>
      <div className="chat-messages">
        {loading ? <p className="lb-empty">Laster meldinger…</p> :
         messages.length === 0 ? <p className="lb-empty">Ingen meldinger ennå – vær den første! 👋</p> :
         messages.map(m => (
          <div key={m.id} className={`chat-msg ${m.username === currentUser ? "own" : ""}`}>
            <div className="chat-bubble">
              <span className="chat-username">{m.username}</span>
              <span className="chat-text">{m.content}</span>
              <span className="chat-time">{formatTime(m.created_at)}</span>
            </div>
            {(m.username === currentUser || isAdmin) && (
              <button className="chat-delete" onClick={() => deleteMessage(m.id)} title="Slett">✕</button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          placeholder="Skriv en melding…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          maxLength={300}
        />
        <button className="chat-send" onClick={sendMessage} disabled={!input.trim()}>Send</button>
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({ onDataChanged, matches, onMatchesChanged }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [editingName, setEditingName] = useState(null);
  const [newFullName, setNewFullName] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [working, setWorking] = useState(false);
  const [resultSearch, setResultSearch] = useState("");
  const [resultInputs, setResultInputs] = useState({});

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    const { data } = await sb.from("profiles").select("username, full_name").order("username");
    setUsers(data || []);
    setLoading(false);
  }

  async function saveResult(matchId) {
    const input = resultInputs[matchId];
    if (!input || input.home === "" || input.away === "") return;
    await sb.from("manual_results").upsert({
      match_id: matchId,
      home_score: parseInt(input.home),
      away_score: parseInt(input.away),
      status: "FINISHED",
      qualifier: input.qualifier || null,
    }, { onConflict: "match_id" });
    setMsg({ text: "✅ Resultat lagret!", type: "success" });
    onMatchesChanged?.();
    onDataChanged?.();
  }

  async function clearResult(matchId) {
    await sb.from("manual_results").delete().eq("match_id", matchId);
    setResultInputs(prev => { const c = { ...prev }; delete c[matchId]; return c; });
    setMsg({ text: "Resultat fjernet.", type: "success" });
    onMatchesChanged?.();
    onDataChanged?.();
  }

  async function resetPassword() {
    if (!newPassword || newPassword.length < 4) { setMsg({ text: "Passord må ha minst 4 tegn.", type: "error" }); return; }
    setWorking(true);
    const { data: profile } = await sb.from("profiles").select("id").eq("username", resetTarget).single();
    if (!profile) { setMsg({ text: "Fant ikke brukeren.", type: "error" }); setWorking(false); return; }
    const { error } = await sb.auth.admin?.updateUserById(profile.id, { password: newPassword });
    if (error) {
      setMsg({ text: "Kunne ikke resette via admin API. Slett brukeren og la dem registrere seg på nytt.", type: "error" });
    } else {
      setMsg({ text: `✅ Passord for ${resetTarget} er oppdatert!`, type: "success" });
      setResetTarget(null); setNewPassword("");
    }
    setWorking(false);
  }

  async function saveFullName() {
    if (!editingName) return;
    await sb.from("profiles").update({ full_name: newFullName.trim() || null }).eq("username", editingName);
    await loadUsers();
    setEditingName(null); setNewFullName("");
    setMsg({ text: `✅ Navn oppdatert for ${editingName}`, type: "success" });
    onDataChanged?.();
  }

  async function deleteUser(username) {
    if (!window.confirm(`Slett brukeren "${username}" permanent?`)) return;
    setMsg({ text: "Sletter...", type: "success" });
    const res = await fetch("/api/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, requester: "herbertdinho" })
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg({ text: "Feil: " + data.error, type: "error" });
      return;
    }
    await loadUsers();
    setMsg({ text: `Brukeren "${username}" er slettet.`, type: "success" });
  }

  return (
    <div className="admin-panel">
      <h2 className="lb-title">⚙️ Admin</h2>
      {msg.text && <div className={msg.type === "success" ? "auth-success" : "auth-error"} style={{marginBottom:16}}>{msg.text}</div>}

      {resetTarget && (
        <div className="admin-reset-box">
          <h3 className="form-title" style={{fontSize:"1.2rem"}}>Nytt passord for {resetTarget}</h3>
          <input className="auth-input" type="password" placeholder="Nytt passord (min. 4 tegn)" value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && resetPassword()} />
          <div style={{display:"flex", gap:8}}>
            <button className="auth-btn" style={{flex:1}} onClick={resetPassword} disabled={working}>
              {working ? "Lagrer…" : "Sett nytt passord"}
            </button>
            <button className="cancel-btn" onClick={() => { setResetTarget(null); setNewPassword(""); setMsg({text:"",type:""}); }}>Avbryt</button>
          </div>
        </div>
      )}

      {editingName && (
        <div className="admin-reset-box">
          <h3 className="form-title" style={{fontSize:"1.2rem"}}>Ekte navn for {editingName}</h3>
          <input className="auth-input" placeholder="Fullt navn" value={newFullName}
            onChange={e => setNewFullName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveFullName()} />
          <div style={{display:"flex", gap:8}}>
            <button className="auth-btn" style={{flex:1}} onClick={saveFullName}>Lagre navn</button>
            <button className="cancel-btn" onClick={() => { setEditingName(null); setNewFullName(""); }}>Avbryt</button>
          </div>
        </div>
      )}

      <div className="admin-user-list">
        {loading ? <p className="lb-empty">Laster brukere…</p> : users.map(u => (
          <div key={u.username} className="admin-user-row">
            <div>
              <span className="admin-username">{u.username}</span>
              {u.full_name && <span style={{fontSize:"0.78rem", color:"var(--muted)", marginLeft:8}}>{u.full_name}</span>}
            </div>
            <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
              <button className="edit-btn" onClick={() => { setEditingName(u.username); setNewFullName(u.full_name || ""); setMsg({text:"",type:""}); }}>✏️ Navn</button>
              <button className="edit-btn" onClick={() => { setResetTarget(u.username); setNewPassword(""); setMsg({text:"",type:""}); }}>🔑 Passord</button>
              <button className="leave-btn" style={{marginTop:0, padding:"7px 12px", fontSize:"0.78rem"}} onClick={() => deleteUser(u.username)}>🗑 Slett</button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="lb-title" style={{marginTop:32}}>⚽ Registrer resultater</h2>
      <input className="search-input" placeholder="🔍 Søk etter lag…" value={resultSearch} onChange={e => setResultSearch(e.target.value)} style={{marginBottom:16}} />
      <div className="admin-user-list">
        {(matches || [])
          .filter(m => resultSearch.trim() === "" || m.home.toLowerCase().includes(resultSearch.toLowerCase()) || m.away.toLowerCase().includes(resultSearch.toLowerCase()))
          .sort((a,b) => new Date(b.kickoff) - new Date(a.kickoff))
          .slice(0, 30)
          .map(m => {
            const input = resultInputs[m.id] || { home: m.homeScore ?? "", away: m.awayScore ?? "", qualifier: m.qualifier || "" };
            const isKnockoutMatch = getRoundKey(m) !== "group";
            const isTied = input.home !== "" && input.away !== "" && parseInt(input.home) === parseInt(input.away);
            const needsQualifier = isKnockoutMatch && isTied;
            return (
              <div key={m.id} className="admin-user-row" style={{flexWrap:"wrap"}}>
                <div style={{display:"flex", alignItems:"center", gap:8, flex:1}}>
                  <span className="admin-username">{m.home} vs {m.away}</span>
                  <span style={{fontSize:"0.72rem", color:"var(--muted)"}}>{formatKickoff(m.kickoff)}</span>
                  {m.status === "FINISHED" && <span className="pts pts-3" style={{fontSize:"0.7rem"}}>FERDIG</span>}
                </div>
                <div style={{display:"flex", gap:6, alignItems:"center", flexWrap:"wrap"}}>
                  <input type="number" min="0" max="20" className="score-input" style={{width:42, height:36}}
                    value={input.home}
                    onChange={e => setResultInputs(prev => ({ ...prev, [m.id]: { ...input, home: e.target.value } }))} />
                  <span className="dash">–</span>
                  <input type="number" min="0" max="20" className="score-input" style={{width:42, height:36}}
                    value={input.away}
                    onChange={e => setResultInputs(prev => ({ ...prev, [m.id]: { ...input, away: e.target.value } }))} />
                  {needsQualifier && (
                    <select className="auth-input" style={{width:"auto", padding:"7px 10px", fontSize:"0.8rem"}}
                      value={input.qualifier || ""}
                      onChange={e => setResultInputs(prev => ({ ...prev, [m.id]: { ...input, qualifier: e.target.value } }))}>
                      <option value="">Hvem gikk videre?</option>
                      <option value={m.home}>{m.home}</option>
                      <option value={m.away}>{m.away}</option>
                    </select>
                  )}
                  <button className="edit-btn" onClick={() => saveResult(m.id)}>💾 Lagre</button>
                  {m.status === "FINISHED" && <button className="leave-btn" style={{marginTop:0, padding:"7px 12px", fontSize:"0.78rem"}} onClick={() => clearResult(m.id)}>✕</button>}
                </div>
              </div>
            );
          })}
      </div>
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
  const [allFullNames, setAllFullNames] = useState({});
  const [tab, setTab] = useState("kamper");
  const [filter, setFilter] = useState("alle");
  const [search, setSearch] = useState("");
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    document.body.style.background = darkMode ? "#1a3a2a" : "#f0f7f2";
  }, [darkMode]);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastSeenRef = useRef(localStorage.getItem("chat_last_seen_" + username) || new Date(0).toISOString());
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
    // Count messages newer than last seen
    async function checkUnread() {
      const lastSeen = localStorage.getItem("chat_last_seen_" + username) || new Date(0).toISOString();
      const { count } = await sb.from("messages")
        .select("*", { count: "exact", head: true })
        .gt("created_at", lastSeen)
        .neq("username", username);
      setUnreadCount(count || 0);
    }
    checkUnread();
    const channel = sb.channel("chat-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        if (tab !== "chat") checkUnread();
      })
      .subscribe();
    return () => sb.removeChannel(channel);
  }, [username, tab]);

  useEffect(() => {
    if (!username) return;
    loadAllData();
    fetchMatches().then(m => { setMatches(m); setMatchesLoading(false); }).catch(e => { setMatchesError(e.message); setMatchesLoading(false); });
  }, [username]);

  async function loadAllData() {
    const [picksRes, winnerRes, profilesRes] = await Promise.all([
      sb.from("picks").select("*").range(0, 9999),
      sb.from("winner_picks").select("*").range(0, 9999),
      sb.from("profiles").select("username, full_name").range(0, 9999),
    ]);
    const picks = {};
    (picksRes.data || []).forEach(p => {
      if (!picks[p.username]) picks[p.username] = {};
      picks[p.username][p.match_id] = p;
    });
    setAllPicks(picks);
    const winners = {};
    (winnerRes.data || []).forEach(w => { winners[w.username] = w.team; });
    setAllWinnerPicks(winners);
    const fullNames = {};
    (profilesRes.data || []).forEach(p => { if (p.full_name) fullNames[p.username] = p.full_name; });
    setAllFullNames(fullNames);
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

  const filteredMatches = matches.filter(m => {
    if (filter === "next24") {
      const kickoff = new Date(m.kickoff);
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      return kickoff >= now && kickoff <= in24h;
    }
    const matchesRound = filter === "alle" || getRoundSection(m) === filter;
    const matchesSearch = search.trim() === "" ||
      m.home.toLowerCase().includes(search.toLowerCase()) ||
      m.away.toLowerCase().includes(search.toLowerCase());
    return matchesRound && matchesSearch;
  });

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
    <div className={`app ${darkMode ? "" : "light-mode"}`}>
      <header className="header">
        <div className="header-left">
          <span className="header-logo">⚽</span>
          <div>
            <div className="header-title">VM Predictions 2026</div>
            <div className="header-user">Hei, {username}!</div>
          </div>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)} title="Bytt tema">
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button className="logout-btn" onClick={logout}>Logg ut</button>
        </div>
      </header>



      <nav className="tabs">
        <button className={tab === "kamper" ? "active" : ""} onClick={() => setTab("kamper")}>Kamper</button>
        <button className={tab === "vinner" ? "active" : ""} onClick={() => setTab("vinner")}>🌍 VM-vinner</button>
        <button className={tab === "ledertavle" ? "active" : ""} onClick={() => setTab("ledertavle")}>Ledertavle</button>
        <button className={tab === "ligaer" ? "active" : ""} onClick={() => setTab("ligaer")}>🏆 Ligaer</button>
        <button className={tab === "regler" ? "active" : ""} onClick={() => setTab("regler")}>📋 Regler</button>
        <button className={tab === "chat" ? "active" : ""} onClick={() => {
          setTab("chat");
          const now = new Date().toISOString();
          localStorage.setItem("chat_last_seen_" + username, now);
          lastSeenRef.current = now;
          setUnreadCount(0);
        }}>
          💬 Chat{unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
        </button>
        {username.toLowerCase() === "herbertdinho" && <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}>⚙️ Admin</button>}
      </nav>

      {tab === "kamper" && (
        <>
          <input
            className="search-input"
            placeholder="🔍 Søk etter lag…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="round-tabs">
            <button className={filter === "alle" ? "active" : ""} onClick={() => setFilter("alle")}>Alle</button>
            <button className={filter === "next24" ? "active" : ""} onClick={() => setFilter("next24")}>⏰ Neste 24t</button>
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
      {tab === "ledertavle" && <Leaderboard allPicks={allPicks} matches={matches} allWinnerPicks={allWinnerPicks} allFullNames={allFullNames} />}
      {tab === "ligaer" && <LeaguePanel currentUser={username} allPicks={allPicks} matches={matches} allWinnerPicks={allWinnerPicks} allFullNames={allFullNames} />}
      {tab === "chat" && <Chat currentUser={username} />}
      {tab === "admin" && username.toLowerCase() === "herbertdinho" && <AdminPanel onDataChanged={loadAllData} matches={matches} onMatchesChanged={() => fetchMatches().then(setMatches)} />}

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
  html, body { background: var(--grass); font-family: 'DM Sans', sans-serif; color: var(--text); min-height: 100vh; transition: background .3s; width: 100%; }

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

  .app { max-width: 1400px; margin: 0 auto; padding: 0 24px 40px; min-height: 100vh; width: 100%; background: var(--grass); }
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
  .search-input { width: 100%; max-width: 400px; padding: 10px 16px; background: rgba(255,255,255,0.07); border: 1px solid var(--card-border); border-radius: 10px; color: var(--text); font-family: inherit; font-size: 0.92rem; outline: none; transition: border .2s; margin: 12px 0 8px; display: block; }
  .search-input:focus { border-color: var(--green); }
  .round-tabs { display: flex; gap: 6px; margin: 0 0 16px; flex-wrap: wrap; }
  .round-tabs button { padding: 7px 14px; background: transparent; border: 1px solid var(--card-border); border-radius: 8px; color: var(--muted); cursor: pointer; font-family: inherit; font-size: 0.82rem; transition: all .2s; white-space: nowrap; }
  .round-tabs button.active { background: var(--gold); border-color: var(--gold); color: #000; font-weight: 700; }
  .round-tabs button:hover:not(.active) { border-color: rgba(255,214,0,0.4); color: var(--gold); }

  .loading-state, .error-state { text-align: center; padding: 40px; color: var(--muted); font-size: 0.95rem; }
  .error-state { color: var(--red); }
  .rounds-container { display: flex; flex-direction: column; gap: 28px; }
  .round-heading { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .round-heading-text { font-family: 'Bebas Neue', cursive; font-size: 1.3rem; letter-spacing: 2px; color: var(--gold); white-space: nowrap; }
  .round-heading::after { content: ''; flex: 1; height: 1px; background: rgba(255,214,0,0.2); }
  .matches-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  @media (max-width: 1100px) { .matches-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 750px) { .matches-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 480px) { .matches-grid { grid-template-columns: 1fr; } }

  /* SMOOTH SCROLL - kun mobil */
  @media (hover: none) { html { scroll-behavior: smooth; } }

  /* LIGHT MODE */
  .light-mode { background: #f0f7f2; color: #1a2e22; }
  .light-mode .header { border-color: rgba(0,0,0,0.1); }
  .light-mode .match-card { background: rgba(255,255,255,0.85); border-color: rgba(0,0,0,0.1); color: #1a2e22; }
  .light-mode .match-card:hover { border-color: rgba(0,150,50,0.4); }
  .light-mode .auth-bg { background: radial-gradient(ellipse at 40% 30%, #d0eed8 0%, #a8d5b5 100%); }
  .light-mode .auth-card { background: rgba(255,255,255,0.9); border-color: rgba(0,0,0,0.1); }
  .light-mode .auth-input { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.15); color: #1a2e22; }
  .light-mode .tabs button, .light-mode .round-tabs button { color: #4a7a5a; border-color: rgba(0,0,0,0.15); }
  .light-mode .score-input { background: rgba(0,0,0,0.06); border-color: rgba(0,0,0,0.15); color: #1a2e22; }
  .light-mode .lb-table td { border-color: rgba(0,0,0,0.07); }
  .light-mode .league-item { background: rgba(255,255,255,0.8); border-color: rgba(0,0,0,0.1); }
  .light-mode .rule-section { background: rgba(255,255,255,0.8); border-color: rgba(0,0,0,0.08); }
  .light-mode .muted, .light-mode .pick-label, .light-mode .match-time { color: #4a7a5a; }

  /* GLASSMORPHISM */
  .match-card { background: rgba(255,255,255,0.07); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 10px; transition: transform .2s, border-color .2s, box-shadow .2s; }
  .match-card:hover { transform: translateY(-3px); border-color: rgba(0,200,83,0.35); box-shadow: 0 8px 32px rgba(0,0,0,0.25); }
  .match-card.finished { border-color: rgba(255,214,0,0.25); background: rgba(255,214,0,0.04); }
  .match-card.live { border-color: rgba(255,61,61,0.6); box-shadow: 0 0 20px rgba(255,61,61,0.25); }

  /* LIVE PULSE */
  .live-pulse { display: flex; align-items: center; }
  .live-dot { width: 8px; height: 8px; background: var(--red); border-radius: 50%; display: block; animation: pulse 1.2s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.6);opacity:0.5} }

  /* COUNTDOWN */
  .countdown { font-size: 0.75rem; color: var(--green); font-weight: 700; margin-top: 2px; }

  /* CONFETTI */
  .confetti-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden; border-radius: 16px; }
  .confetti-piece { position: absolute; top: -10px; border-radius: 2px; animation: confetti-fall linear forwards; }
  @keyframes confetti-fall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(200px) rotate(720deg);opacity:0} }

  /* THEME TOGGLE */
  .theme-toggle { background: rgba(255,255,255,0.1); border: 1px solid var(--card-border); border-radius: 8px; padding: 6px 10px; cursor: pointer; font-size: 1rem; transition: all .2s; }
  .theme-toggle:hover { background: rgba(255,255,255,0.2); }

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
  .others-toggle { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid var(--card-border); border-radius: 8px; padding: 7px; color: var(--muted); cursor: pointer; font-family: inherit; font-size: 0.78rem; transition: all .2s; }
  .others-toggle:hover { border-color: var(--green); color: var(--green); }
  .others-list { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
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
  .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .table-scroll .lb-table { min-width: 600px; }
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
  .prize-edit-section { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .prize-display-section { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
  .prize-edit-row { display: flex; align-items: center; gap: 10px; }
  .prize-label { font-size: 0.85rem; color: var(--muted); white-space: nowrap; min-width: 90px; }
  .prize-input { flex: 1; max-width: 280px; padding: 8px 12px; background: rgba(255,255,255,0.07); border: 1px solid var(--card-border); border-radius: 8px; color: var(--text); font-family: inherit; font-size: 0.88rem; outline: none; transition: border .2s; }
  .prize-input:focus { border-color: var(--gold); }
  .prize-display { font-size: 0.85rem; color: var(--muted); }
  .leave-btn:hover { background: rgba(255,61,61,0.1); }
  .unread-badge { background: var(--red); color: #fff; font-size: 0.65rem; font-weight: 700; padding: 2px 5px; border-radius: 10px; margin-left: 5px; vertical-align: middle; min-width: 16px; display: inline-block; text-align: center; line-height: 1.4; }
  .chat-panel { padding: 20px 0; max-width: 680px; display: flex; flex-direction: column; gap: 16px; }
  .chat-messages { background: rgba(255,255,255,0.04); border: 1px solid var(--card-border); border-radius: 16px; padding: 16px; min-height: 300px; max-height: 500px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
  .chat-msg { display: flex; align-items: flex-end; gap: 6px; }
  .chat-msg.own { flex-direction: row-reverse; }
  .chat-bubble { background: rgba(255,255,255,0.07); border: 1px solid var(--card-border); border-radius: 12px 12px 12px 4px; padding: 8px 12px; max-width: 75%; display: flex; flex-direction: column; gap: 2px; }
  .chat-msg.own .chat-bubble { background: rgba(0,200,83,0.15); border-color: rgba(0,200,83,0.3); border-radius: 12px 12px 4px 12px; }
  .chat-username { font-size: 0.72rem; font-weight: 700; color: var(--green); }
  .chat-msg.own .chat-username { color: var(--green); text-align: right; }
  .chat-text { font-size: 0.9rem; line-height: 1.4; word-break: break-word; }
  .chat-time { font-size: 0.65rem; color: var(--muted); margin-top: 2px; }
  .chat-delete { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.75rem; padding: 2px 4px; border-radius: 4px; transition: color .2s; flex-shrink: 0; }
  .chat-delete:hover { color: var(--red); }
  .chat-input-row { display: flex; gap: 8px; }
  .chat-input { flex: 1; padding: 12px 16px; background: rgba(255,255,255,0.07); border: 1px solid var(--card-border); border-radius: 10px; color: var(--text); font-family: inherit; font-size: 0.92rem; outline: none; transition: border .2s; }
  .chat-input:focus { border-color: var(--green); }
  .chat-send { padding: 12px 20px; background: var(--green); border: none; border-radius: 10px; color: #000; font-weight: 700; cursor: pointer; font-family: inherit; font-size: 0.9rem; transition: all .2s; white-space: nowrap; }
  .chat-send:hover:not(:disabled) { background: var(--green-dark); color: #fff; }
  .chat-send:disabled { opacity: 0.4; cursor: default; }
  .admin-panel { padding: 20px 0; max-width: 600px; }
  .admin-reset-box { background: var(--card); border: 1px solid var(--card-border); border-radius: 14px; padding: 20px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; }
  .admin-user-list { display: flex; flex-direction: column; gap: 8px; }
  .admin-user-row { background: var(--card); border: 1px solid var(--card-border); border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .admin-username { font-weight: 600; font-size: 0.95rem; }
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
