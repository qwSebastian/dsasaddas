import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import logoUrl from "@assets/aldrickj-removebg-preview_1783389181453.png";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

let _actorDisplayName = "";
// Server-issued session token for nickname accounts (admin2/member).
// General Admin uses a real Supabase JWT instead and leaves this null.
let _accountToken = null;
let _accountRole = null; // 'admin2' | 'member' | null

async function logAction(action, details = "", kind = "admin") {
  try {
    let actor = _actorDisplayName;
    if (!actor) {
      const { data: { session } } = await supabase.auth.getSession();
      actor = session?.user?.email || "unknown";
    }
    const { error } = await supabase.from("admin_logs").insert({ actor_email: actor, action, details: details || "", kind });
    if (error) console.error("[logAction] insert failed:", error.message);
  } catch (e) {
    console.error("[logAction] exception:", e);
  }
}

// Records a visitor entry (nickname + timestamp) in the shared log feed.
async function logVisit(nickname) {
  try {
    const { error } = await supabase.from("admin_logs").insert({
      actor_email: nickname || "vizitator", action: "Vizită site", details: "", kind: "visit",
    });
    if (error) console.error("[logVisit] insert failed:", error.message);
  } catch (e) {
    console.error("[logVisit] exception:", e);
  }
}

const RANK_SYSTEMS = {
  default:    { label: "Standard",   ranks: ["Familia Aldrick","Recruit","Runner","O.G","Hitman","Overseer","High Captain","Underboss","Don Aldrick"] },
  vendettas:  { label: "Sicarios",   ranks: ["S5","S4","S3","S2","S1"] },
  sala_sport: { label: "Sala Sport", ranks: ["Personal Trainer","Supervizor","Manager Sala"] },
};

// Rows created before the Frizerie → Sala Sport rename still carry the old
// 'frizerie' key in lists.rank_system / lists.list_type. Normalising here keeps
// those rows working even if the rename migration hasn't been run yet.
const SALA_SPORT_KEY = "sala_sport";
const LEGACY_SALA_SPORT_KEY = "frizerie";
const normalizeSystemKey = key => (key === LEGACY_SALA_SPORT_KEY ? SALA_SPORT_KEY : key);

// Default profile picture for Sala Sport members. Used whenever a member has no
// photo of their own; an uploaded photo always wins.
const SALA_SPORT_AVATAR = "/sala-sport-avatar.jpg";

const ALDRICK_RANK_STYLES = [
  { bg:"#0a0804", border:"#1e120a", shadow:"none", nameColor:"#4a3828" },
  { bg:"#0c0a06", border:"#2a1c0a", shadow:"none", nameColor:"#685030" },
  { bg:"#0e0b05", border:"#3a240a", shadow:"none", nameColor:"#856040" },
  { bg:"#100c04", border:"#5a3a10", shadow:"0 0 8px rgba(120,80,20,0.22)", nameColor:"#a07030", nameGlow:"0 0 6px rgba(160,112,48,0.4)" },
  { bg:"#120905", border:"#803015", shadow:"0 0 10px rgba(180,60,20,0.28)", nameColor:"#c06030", nameGlow:"0 0 7px rgba(200,80,30,0.4)" },
  { bg:"#130a02", border:"#9a5c10", shadow:"0 0 13px rgba(180,110,20,0.35)", nameColor:"#d08020", nameGlow:"0 0 8px rgba(210,130,30,0.45)" },
  { bg:"linear-gradient(135deg,#130d00 0%,#201600 100%)", border:"#c08818", shadow:"0 0 18px rgba(210,140,24,0.45),0 0 36px rgba(210,140,24,0.15)", nameColor:"#e0a830", nameGlow:"0 0 10px rgba(224,168,48,0.55)", rankKey:"aldrick-hc" },
  { bg:"linear-gradient(135deg,#1c1400 0%,#2e2000 50%,#1c1400 100%)", border:"#d4a420", shadow:"0 0 24px rgba(225,165,32,0.55),0 0 48px rgba(225,165,32,0.22)", nameColor:"#f0c840", nameGlow:"0 0 13px rgba(245,200,60,0.65)", rankKey:"aldrick-underboss" },
  { bg:"linear-gradient(135deg,#201600 0%,#3c2800 30%,#201600 70%,#120e00 100%)", border:"#f5c830", shadow:"0 0 38px rgba(255,195,30,0.65),0 0 75px rgba(255,195,30,0.28),inset 0 0 30px rgba(255,200,0,0.04)", nameColor:"#ffe040", nameGlow:"0 0 18px rgba(255,210,0,0.85),0 0 36px rgba(255,180,0,0.45)", rankKey:"aldrick-don" },
];

const SICARIOS_RANK_STYLES = [
  { bg:"#09070f", border:"#1e1235", shadow:"none", nameColor:"#4a3860" },
  { bg:"#0c091a", border:"#301848", shadow:"none", nameColor:"#6a5080" },
  { bg:"#0e0c1c", border:"#4a2a65", shadow:"0 0 6px rgba(90,50,130,0.22)", nameColor:"#8a6090", nameGlow:"0 0 5px rgba(130,80,160,0.35)" },
  { bg:"linear-gradient(135deg,#0e0a1c 0%,#180e28 100%)", border:"#7050a8", shadow:"0 0 14px rgba(120,80,185,0.38),0 0 28px rgba(120,80,185,0.14)", nameColor:"#a875d0", nameGlow:"0 0 9px rgba(168,100,210,0.5)", rankKey:"sic-consigliere" },
  { bg:"linear-gradient(135deg,#110a20 0%,#200e36 50%,#110a20 100%)", border:"#9865d8", shadow:"0 0 22px rgba(155,88,235,0.48),0 0 44px rgba(155,88,235,0.2)", nameColor:"#c88af8", nameGlow:"0 0 13px rgba(200,120,255,0.65)", rankKey:"sic-kingpin" },
];

function getRankStyle(rankSystem, rank, ranks) {
  const system = normalizeSystemKey(rankSystem);
  if (!system || system === SALA_SPORT_KEY) return { bg:"#0f0a1c", border:"#1a1426", shadow:"none", nameColor:"#e6def5" };
  const idx = (ranks||[]).indexOf(rank);
  const safeIdx = Math.max(0, idx);
  if (system === "vendettas") {
    return SICARIOS_RANK_STYLES[Math.min(safeIdx, SICARIOS_RANK_STYLES.length-1)] || SICARIOS_RANK_STYLES[0];
  }
  return ALDRICK_RANK_STYLES[Math.min(safeIdx, ALDRICK_RANK_STYLES.length-1)] || ALDRICK_RANK_STYLES[0];
}
const getRanks = list => (RANK_SYSTEMS[normalizeSystemKey(list?.rank_system)] || RANK_SYSTEMS.default).ranks;
const isSalaSportList = list => (normalizeSystemKey(list?.list_type) === SALA_SPORT_KEY);

// dd/mm/yyyy formatting for the concediu (leave) date range.
const fmtDate = (iso) => {
  if (!iso) return "";
  const parts = String(iso).slice(0, 10).split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};
const fmtConcediu = (m) => {
  if (!m?.concediu_start && !m?.concediu_end) return "";
  return `${fmtDate(m.concediu_start) || "…"} → ${fmtDate(m.concediu_end) || "…"}`;
};
const STATUS_OPTIONS = ["Activ","Inactiv"];
const TASK_OPTIONS = ["Platit","Neplatit","Scutit"];
const STATUS_COLORS = { Activ:{bg:"#0d2218",text:"#4ade80",border:"#22c55e"}, Inactiv:{bg:"#1e1706",text:"#f87171",border:"#ef4444"} };
const TASK_COLORS = { Platit:{bg:"#0d1e28",text:"#38bdf8",border:"#0ea5e9"}, Neplatit:{bg:"#1a1506",text:"#fb923c",border:"#f97316"}, Scutit:{bg:"#1a1506",text:"#b89028",border:"#c9a030"} };
const LICENSE_DEFS = [
  { key:"hs_driver",   label:"HS DRIVER" },
  { key:"pilot_heli",  label:"PILOT HELI" },
  { key:"pilot_avion", label:"PILOT AVION" },
  { key:"barca",       label:"BARCĂ" },
];
const ACTIVITY_TASKS = [
  { label:"Jaf câștigat (Exchange/Biju/Rapire)", points:10 },
  { label:"Jaf pierdut (Exchange/Biju/Rapire)",  points:5  },
  { label:"Patrulă",                             points:2  },
  { label:"Mineriada",                           points:5  },
  { label:"Adus Hacking Device",                 points:2  },
  { label:"100 meta livrat",                     points:2  },
  { label:"200 meta livrat",                     points:4  },
  { label:"Ținut la livrat om mare",             points:2  },
];

// ─── Lightbox ───────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, cursor:"zoom-out" }}>
      <img src={src} alt="" style={{ maxWidth:"90vw", maxHeight:"90vh", borderRadius:8, boxShadow:"0 0 60px rgba(0,0,0,0.8)", objectFit:"contain" }} onClick={e => e.stopPropagation()} />
      <button onClick={onClose} style={{ position:"fixed", top:20, right:24, background:"transparent", border:"none", color:"#6a5218", fontSize:28, cursor:"pointer", lineHeight:1 }}>✕</button>
    </div>
  );
}

// ─── Login Modal ─────────────────────────────────────────────────────────────
function LoginModal({ onClose, onLogin, onLoginAccount }) {
  const [mode, setMode] = useState("account");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inpStyle = {
    background:"rgba(0,0,0,0.5)", border:"1px solid rgba(201,160,48,0.22)", borderRadius:3,
    color:"#e8d8a0", fontFamily:"'Barlow', sans-serif", fontSize:14,
    padding:"9px 14px", outline:"none", width:"100%", boxSizing:"border-box",
  };

  const submitGA = async () => {
    setLoading(true); setError("");
    const err = await onLogin(email, password);
    if (err) setError("Email sau parolă incorectă.");
    setLoading(false);
  };

  const submitAccount = async () => {
    if (!nickname.trim() || !password) { setError("Completează nickname și parola."); return; }
    setLoading(true); setError("");
    const err = await onLoginAccount(nickname.trim(), password);
    if (err) setError(err.message || "Nickname sau parolă incorectă.");
    setLoading(false);
  };

  const tabStyle = (active) => ({
    flex:1, background:"transparent", border:"none",
    borderBottom: active ? "2px solid #c9a030" : "2px solid rgba(201,160,48,0.12)",
    color: active ? "#e8c84a" : "#5a4210",
    fontFamily:"'Cinzel', serif", fontWeight:700, fontSize:11,
    padding:"10px 0", cursor:"pointer", letterSpacing:"0.10em",
  });

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(4px)" }}>
      <div className="ev-modal-frame">
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, marginBottom:4 }}>
          <img src={logoUrl} alt="Aldrick Enterprises" style={{ width:84, height:84, objectFit:"contain" }} />
          <div className="ev-gold-text" style={{ fontFamily:"'Cinzel', serif", fontWeight:700, fontSize:14, letterSpacing:"0.16em", textAlign:"center" }}>ALDRICK ENTERPRISES</div>
        </div>
        <div style={{ display:"flex", borderBottom:"1px solid rgba(201,160,48,0.15)", marginBottom:6 }}>
          <button style={tabStyle(mode==="account")} onClick={() => { setMode("account"); setError(""); }}>CONT MEMBRU / ADMIN 2</button>
          <button style={tabStyle(mode==="ga")} onClick={() => { setMode("ga"); setError(""); }}>GENERAL ADMIN</button>
        </div>
        {mode === "ga" ? (
          <>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
              style={inpStyle} onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor="rgba(201,160,48,0.22)"} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Parolă"
              onKeyDown={e => e.key==="Enter" && submitGA()}
              style={{ ...inpStyle, border:`1px solid ${error?"#ef4444":"rgba(201,160,48,0.22)"}` }}
              onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor=error?"#ef4444":"rgba(201,160,48,0.22)"} />
          </>
        ) : (
          <>
            <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Nickname"
              style={inpStyle} onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor="rgba(201,160,48,0.22)"} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Parolă"
              onKeyDown={e => e.key==="Enter" && submitAccount()}
              style={{ ...inpStyle, border:`1px solid ${error?"#ef4444":"rgba(201,160,48,0.22)"}` }}
              onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor=error?"#ef4444":"rgba(201,160,48,0.22)"} />
          </>
        )}
        {error && <div style={{ color:"#ef4444", fontFamily:"'Barlow', sans-serif", fontSize:12 }}>{error}</div>}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={mode==="ga" ? submitGA : submitAccount} disabled={loading}
            style={{ flex:1, background:"linear-gradient(180deg, #d4a832 0%, #7a5210 100%)", border:"1px solid rgba(201,160,48,0.35)", borderRadius:3, color:"#0c0802", fontFamily:"'Cinzel', serif", fontWeight:700, fontSize:13, padding:"10px", cursor:"pointer", letterSpacing:"0.08em" }}>
            {loading ? "..." : "INTRĂ"}
          </button>
          <button onClick={onClose} style={{ flex:1, background:"transparent", border:"1px solid rgba(201,160,48,0.15)", borderRadius:3, color:"#6a5218", fontFamily:"'Barlow', sans-serif", fontSize:13, padding:"10px", cursor:"pointer" }}>Anulează</button>
        </div>
      </div>
    </div>
  );
}

// ─── Visitor Entry Gate ───────────────────────────────────────────────────────
function EntryGate({ onEnter, onOpenLogin }) {
  const [nickname, setNickname] = useState("");
  const submit = () => { if (nickname.trim()) onEnter(nickname.trim()); };
  return (
    <div style={{ minHeight:"100vh", background:"#050305", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
      {/* Logo — large, centred */}
      <img src={logoUrl} alt="Aldrick Enterprises"
        style={{ width:220, height:220, objectFit:"contain", marginBottom:8, filter:"drop-shadow(0 4px 40px rgba(201,160,48,0.18))" }} />

      {/* Title */}
      <div style={{ fontFamily:"'Cinzel', serif", fontWeight:700, fontSize:32, letterSpacing:"0.12em", textAlign:"center", marginBottom:4, color:"#c9a030" }}>
        Aldrick Enterprises
      </div>
      <div style={{ fontFamily:"'Cinzel', serif", fontStyle:"italic", fontSize:13, color:"#7a5a18", letterSpacing:"0.08em", marginBottom:24, textAlign:"center" }}>
        Family is Everything and Everything is Family
      </div>

      {/* Faction photo banner */}
      <div style={{ width:"100%", maxWidth:700, marginBottom:28, borderRadius:10, overflow:"hidden", border:"1px solid rgba(201,160,48,0.18)", boxShadow:"0 4px 40px rgba(0,0,0,0.7)" }}>
        <img src="/sur13.png" alt="Aldrick Enterprises" style={{ width:"100%", display:"block", objectFit:"cover", maxHeight:280 }} />
      </div>

      {/* Ornate framed login card */}
      <div className="ev-entry-frame">
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ fontFamily:"'Barlow', sans-serif", fontSize:12, color:"#8a6c1e", textAlign:"center", letterSpacing:"0.06em" }}>
            Introdu un nickname pentru a intra ca vizitator
          </div>
          <input value={nickname} onChange={e => setNickname(e.target.value)} onKeyDown={e => e.key==="Enter" && submit()} placeholder="Nickname"
            style={{ background:"rgba(0,0,0,0.5)", border:"1px solid rgba(201,160,48,0.22)", borderRadius:3, color:"#e8d8a0", fontFamily:"'Barlow', sans-serif", fontSize:14, padding:"10px 14px", outline:"none", width:"100%", boxSizing:"border-box" }}
            onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor="rgba(201,160,48,0.22)"} />
          <button onClick={submit} disabled={!nickname.trim()}
            style={{ background: nickname.trim() ? "linear-gradient(180deg, #d4a832 0%, #7a5210 100%)" : "rgba(201,160,48,0.08)", border:"1px solid rgba(201,160,48,0.3)", borderRadius:3, color: nickname.trim() ? "#0c0802" : "#5a4210", fontFamily:"'Cinzel', serif", fontWeight:700, fontSize:13, padding:"11px", cursor: nickname.trim() ? "pointer" : "default", letterSpacing:"0.10em" }}>
            INTRĂ CA VIZITATOR
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ flex:1, height:1, background:"rgba(201,160,48,0.15)" }} />
            <span style={{ fontFamily:"'Barlow', sans-serif", fontSize:10, color:"#4a3210", letterSpacing:"0.14em" }}>SAU</span>
            <div style={{ flex:1, height:1, background:"rgba(201,160,48,0.15)" }} />
          </div>
          <button onClick={onOpenLogin}
            style={{ background:"transparent", border:"1px solid rgba(201,160,48,0.25)", borderRadius:3, color:"#c9a030", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:13, padding:"10px", cursor:"pointer", letterSpacing:"0.06em" }}>
            Am un cont (Membru / Admin)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────
// `fallback` is shown when the member has no photo of their own (Sala Sport
// members default to the gym avatar). Clicking still opens the file picker.
function PhotoUpload({ photo, onChange, disabled, size = 90, fallback = null }) {
  const fileRef = useRef();
  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target.result);
    reader.readAsDataURL(file);
  };
  const shown = photo || fallback;
  return (
    <div onClick={() => { if (!disabled) fileRef.current.click(); }} style={{ width:size, height:size*1.22, borderRadius:8, border:photo?"2px solid #c9a030":shown?"2px solid #4a3810":"2px dashed #444", background:shown?"transparent":"#100d06", cursor:disabled?"default":"pointer", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      {shown ? <img src={shown} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
        : <div style={{ textAlign:"center", color:"#352808" }}><div style={{ fontSize:22, marginBottom:4 }}>📷</div>{!disabled && <div style={{ fontSize:10, fontFamily:"'Barlow', sans-serif" }}>Foto</div>}</div>}
      {!disabled && <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }} />}
    </div>
  );
}

function FieldInput({ label, value, onChange, disabled, multiline }) {
  const style = { background:"#050305", border:"1px solid #0e0a02", borderRadius:6, color:"#e6def5", fontFamily:"'Barlow', sans-serif", fontSize:13, padding:"6px 10px", width:"100%", boxSizing:"border-box" };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
      <label style={{ color:"#5a4210", fontSize:10, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.1em", textTransform:"uppercase" }}>{label}</label>
      {disabled
        ? <div style={{ ...style, minHeight:32 }}>{value || <span style={{ color:"#2a1f06" }}>—</span>}</div>
        : multiline
          ? <textarea value={value||""} onChange={e => onChange(e.target.value)} rows={3}
              style={{ ...style, outline:"none", resize:"vertical", border:"1px solid #1a1506" }}
              onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor="#1a1506"} />
          : <input value={value||""} onChange={e => onChange(e.target.value)} placeholder="—"
              style={{ ...style, outline:"none", border:"1px solid #1a1506" }}
              onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor="#1a1506"} />}
    </div>
  );
}

function CycleButton({ options, value, onChange, colorMap, disabled }) {
  const current = colorMap[value] || colorMap[options[0]];
  const idx = options.indexOf(value);
  return (
    <button onClick={() => { if (!disabled) onChange(options[(idx+1)%options.length]); }} disabled={disabled} className="ev-cycle"
      style={{ background:current.bg, color:current.text, border:`1px solid ${current.border}`, borderRadius:6, padding:"4px 14px", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:13, cursor:disabled?"default":"pointer", letterSpacing:"0.05em", whiteSpace:"nowrap", opacity:disabled?0.8:1 }}>
      {value}{!disabled&&" ▾"}
    </button>
  );
}

function RankSlider({ value, onChange, disabled, ranks }) {
  const safeRanks = ranks && ranks.length ? ranks : RANK_SYSTEMS.default.ranks;
  const foundIdx = safeRanks.indexOf(value);
  const idx = foundIdx === -1 ? 0 : foundIdx;
  const displayValue = foundIdx === -1 ? safeRanks[0] : value;
  return (
    <div style={{ width:"100%" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ color:"#6a5218", fontSize:11, fontFamily:"'Barlow', sans-serif" }}>RANK</span>
        <span style={{ color:"#c9a030", fontSize:13, fontWeight:700, fontFamily:"'Rajdhani', sans-serif", letterSpacing:"0.08em" }}>{displayValue}</span>
      </div>
      <input type="range" min={0} max={safeRanks.length-1} value={idx} disabled={disabled}
        onChange={e => { if (!disabled) onChange(safeRanks[parseInt(e.target.value)]); }}
        style={{ width:"100%", accentColor:"#c9a030", cursor:disabled?"default":"pointer" }} />
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
        <span style={{ color:"#352808", fontSize:10, fontFamily:"'Barlow', sans-serif" }}>{safeRanks[0]}</span>
        <span style={{ color:"#352808", fontSize:10, fontFamily:"'Barlow', sans-serif" }}>{safeRanks[safeRanks.length-1]}</span>
      </div>
    </div>
  );
}

function btnSmall() { return { background:"#100d06", border:"1px solid #201830", color:"#c9a030", borderRadius:5, width:28, height:28, cursor:"pointer", fontWeight:700, fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Barlow', sans-serif" }; }

// ─── Loading Skeletons ───────────────────────────────────────────────────────
function SkeletonBox({ height = 20, width = "100%", radius = 6, style = {} }) {
  return <div style={{ height, width, borderRadius:radius, background:"linear-gradient(90deg, #0f0a1c 0%, #0e0a02 50%, #0f0a1c 100%)", backgroundSize:"200% 100%", animation:"evShimmer 1.4s ease-in-out infinite", ...style }} />;
}
function SkeletonGrid({ count = 6, minWidth = 260, height = 220 }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fill, minmax(${minWidth}px, 1fr))`, gap:16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background:"#0f0a1c", border:"1px solid #0e0a02", borderRadius:12, overflow:"hidden", display:"flex", flexDirection:"column", gap:10, padding:0 }}>
          <SkeletonBox height={Math.round(height * 0.6)} radius={0} />
          <div style={{ padding:"10px 14px 14px", display:"flex", flexDirection:"column", gap:8 }}>
            <SkeletonBox height={14} width="70%" />
            <SkeletonBox height={10} width="45%" />
          </div>
        </div>
      ))}
    </div>
  );
}
function SkeletonRows({ count = 4 }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background:"#0f0a1c", border:"1px solid #0e0a02", borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:14 }}>
          <SkeletonBox height={42} width={42} radius={6} />
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
            <SkeletonBox height={13} width="35%" />
            <SkeletonBox height={10} width="22%" />
          </div>
          <SkeletonBox height={24} width={60} />
          <SkeletonBox height={24} width={60} />
          <SkeletonBox height={24} width={40} />
        </div>
      ))}
    </div>
  );
}
function SectionHeaderSkeleton() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        <SkeletonBox height={20} width={140} />
        <SkeletonBox height={11} width={80} />
      </div>
      <SkeletonBox height={32} width={140} radius={7} />
    </div>
  );
}

// ─── Archive modal (GA picks Demisie / Decedat) ───────────────────────────────
function ArchiveModal({ memberName, onConfirm, onCancel }) {
  const [status, setStatus] = useState("demisie");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:16 }}>
      <div style={{ background:"#100d06", border:"1px solid rgba(201,160,48,0.35)", borderRadius:10, padding:28, width:340, maxWidth:"100%", display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ fontFamily:"'Cinzel', serif", fontWeight:700, fontSize:15, color:"#c9a030", letterSpacing:"0.1em" }}>📁 ARHIVEAZĂ MEMBRU</div>
        <div style={{ fontFamily:"'Barlow', sans-serif", fontSize:13, color:"#8a6c1e", lineHeight:1.6 }}>
          <strong style={{ color:"#e8d8a0" }}>{memberName || "?"}</strong> va fi mutat în arhivă și nu va mai apărea în liste.
        </div>
        <div style={{ fontFamily:"'Barlow', sans-serif", fontSize:11, color:"#6a5218", letterSpacing:"0.08em", textTransform:"uppercase" }}>Selectează motivul arhivării:</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[["demisie","📋 Demisie"],["decedat","🕯️ Decedat"]].map(([val, label]) => (
            <label key={val} onClick={() => setStatus(val)} style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer", background:status===val?"rgba(201,160,48,0.08)":"transparent", border:`1px solid ${status===val?"rgba(201,160,48,0.35)":"#1a1506"}`, borderRadius:6, padding:"11px 14px", transition:"all 0.15s" }}>
              <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${status===val?"#c9a030":"#3a2808"}`, background:status===val?"#c9a030":"transparent", flexShrink:0, transition:"all 0.15s" }} />
              <span style={{ color:status===val?"#e8c84a":"#8a6c1e", fontFamily:"'Barlow', sans-serif", fontSize:14, fontWeight:600 }}>{label}</span>
            </label>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, marginTop:4 }}>
          <button onClick={onCancel} style={{ flex:1, background:"transparent", border:"1px solid rgba(201,160,48,0.18)", borderRadius:6, color:"#6a5218", fontFamily:"'Barlow', sans-serif", fontSize:13, padding:"10px", cursor:"pointer" }}>Anulează</button>
          <button onClick={() => onConfirm(status)} style={{ flex:1, background:"linear-gradient(180deg, #1a3a10 0%, #0d1f08 100%)", border:"1px solid rgba(100,200,50,0.3)", borderRadius:6, color:"#86efac", fontFamily:"'Cinzel', serif", fontWeight:700, fontSize:13, padding:"10px", cursor:"pointer", letterSpacing:"0.06em" }}>✓ Arhivează</button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirmation modal ────────────────────────────────────────────────
function DeleteConfirmModal({ memberName, onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:16 }}>
      <div style={{ background:"#100d06", border:"1px solid rgba(239,68,68,0.35)", borderRadius:10, padding:28, width:340, maxWidth:"100%", display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ fontFamily:"'Cinzel', serif", fontWeight:700, fontSize:15, color:"#f87171", letterSpacing:"0.1em" }}>⚠️ ȘTERGE DEFINITIV</div>
        <div style={{ fontFamily:"'Barlow', sans-serif", fontSize:13, color:"#8a6c1e", lineHeight:1.7 }}>
          Ești sigur că vrei să ștergi definitiv pe{" "}
          <strong style={{ color:"#e8d8a0" }}>{memberName || "?"}</strong>?{" "}
          Această acțiune <span style={{ color:"#f87171" }}>nu poate fi anulată</span>.
        </div>
        <div style={{ display:"flex", gap:8, marginTop:4 }}>
          <button onClick={onCancel} style={{ flex:1, background:"transparent", border:"1px solid rgba(201,160,48,0.18)", borderRadius:6, color:"#6a5218", fontFamily:"'Barlow', sans-serif", fontSize:13, padding:"10px", cursor:"pointer" }}>Anulează</button>
          <button onClick={onConfirm} style={{ flex:1, background:"linear-gradient(180deg, #3a0808 0%, #1f0404 100%)", border:"1px solid rgba(239,68,68,0.4)", borderRadius:6, color:"#f87171", fontFamily:"'Cinzel', serif", fontWeight:700, fontSize:13, padding:"10px", cursor:"pointer", letterSpacing:"0.06em" }}>🗑️ Șterge definitiv</button>
        </div>
      </div>
    </div>
  );
}

// ─── Members Section ─────────────────────────────────────────────────────────
function MemberCard({ member, onUpdate, onDelete, onArchive, onMoveUp, onMoveDown, isAdmin, isGeneralAdmin, canDelete, isSalaSport = false, ranks, rankSystem, activityTasks = ACTIVITY_TASKS, isOwnerGA = false }) {
  const [expanded, setExpanded] = useState(false);
  const isExecutive = isSalaSport && !!member.executive;
  const rs = isSalaSport ? { bg:"#0f0a1c", border:"#1a1426", shadow:"none", nameColor:"#e6def5" } : getRankStyle(rankSystem, member.rank, ranks);
  // Sala Sport members fall back to the gym avatar; an uploaded photo wins.
  const avatarSrc = member.photo || (isSalaSport ? SALA_SPORT_AVATAR : null);
  const [activityLog, setActivityLog] = useState(Array.isArray(member.task_log) ? member.task_log : []);
  const [addTask, setAddTask] = useState("");
  const [subTask, setSubTask] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [manualAmt, setManualAmt] = useState(1);

  const update = (key, val) => {
    onUpdate({ ...member, [key]: val });
    const name = member.nume || "?";
    if (key === "rank")   logAction("Modificat rank",   `${name}: ${val}`);
    if (key === "status") logAction("Modificat status", `${name}: ${val}`);
    if (key === "task")   logAction("Modificat task",   `${name}: ${val}`);
    const lic = LICENSE_DEFS.find(l => l.key === key);
    if (lic) logAction(`Licență ${val ? "acordată" : "revocată"}`, `${lic.label} → ${name}`);
  };

  const applyActivity = (taskLabel, pts, sign) => {
    const key = taskLabel + "|" + sign;
    const idx = activityLog.findIndex(e => e.key === key);
    const newLog = idx >= 0
      ? activityLog.map((e, i) => i === idx ? { ...e, count: e.count + 1 } : e)
      : [...activityLog, { key, label: taskLabel, pts, sign, count: 1 }];
    setActivityLog(newLog);
    onUpdate({ ...member, puncte: (member.puncte||0) + sign * pts, task_log: newLog });
    logAction(`Puncte ${sign > 0 ? "+" : "-"}${pts}`, `${taskLabel} → ${member.nume || "?"}`);
  };

  const handleAddTask = () => {
    const t = activityTasks.find(t => t.label === addTask);
    if (!t) return;
    applyActivity(t.label, t.points, 1);
    setAddTask("");
  };
  const handleSubTask = () => {
    const t = activityTasks.find(t => t.label === subTask);
    if (!t) return;
    applyActivity(t.label, t.points, -1);
    setSubTask("");
  };
  const handleManual = () => {
    if (!manualAmt || manualAmt === 0) return;
    const lbl = manualLabel.trim() || "Ajustare manuală";
    applyActivity(lbl, Math.abs(manualAmt), manualAmt > 0 ? 1 : -1);
    setManualLabel("");
    setManualAmt("");
  };

  const removeActivity = (entry) => {
    const idx = activityLog.findIndex(x => x.key === entry.key);
    if (idx < 0) return;
    const newLog = activityLog[idx].count <= 1
      ? activityLog.filter(x => x.key !== entry.key)
      : activityLog.map((x, i) => i === idx ? { ...x, count: x.count - 1 } : x);
    setActivityLog(newLog);
    onUpdate({ ...member, puncte: (member.puncte||0) - entry.sign * entry.pts, task_log: newLog });
    logAction(`Anulat activitate (${entry.sign > 0 ? "-" : "+"}${entry.pts})`, `${entry.label} → ${member.nume || "?"}`);
  };

  const selStyle = {
    flex:1, background:"#0b0715", border:"1px solid #1a1426", borderRadius:7,
    color:"#a89cc8", fontFamily:"'Barlow', sans-serif", fontSize:12,
    padding:"7px 10px", outline:"none", cursor:"pointer", appearance:"none",
    WebkitAppearance:"none",
  };
  return (
    <div className="ev-member-card" data-rank={(!isSalaSport && rs.rankKey) ? rs.rankKey : undefined} style={{ background: member.card_bg ? `linear-gradient(rgba(5,3,20,0.72),rgba(5,3,20,0.72)),url(/cardbg.png) center/cover no-repeat` : isExecutive ? "linear-gradient(180deg, #1a1506 0%, #0e0a04 100%)" : rs.bg, border: member.card_bg ? "1px solid rgba(124,58,237,0.35)" : isExecutive ? "1px solid #a07820" : `1px solid ${rs.border}`, borderRadius:10, overflow:"hidden", boxShadow: member.card_bg ? "0 0 18px rgba(124,58,237,0.18)" : isExecutive ? "0 0 22px rgba(180,140,30,0.18)" : rs.shadow }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 16px", userSelect:"none" }}>
        <div style={{ width:42, height:42, borderRadius:6, border: isExecutive ? "1px solid #a07820" : "1px solid #1a1506", background:"#100d06", overflow:"hidden", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {avatarSrc ? <img src={avatarSrc} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" /> : <span style={{ fontSize:18 }}>👤</span>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:16, color: isExecutive ? "#f0d878" : rs.nameColor, textShadow: (!isExecutive && rs.nameGlow) ? rs.nameGlow : "none", letterSpacing:"0.05em" }}>{member.nume||<span style={{ color:"#2a1f06" }}>Fără Nume</span>}</div>
          <div style={{ fontFamily:"'Barlow', sans-serif", fontSize:11, color:"#5a4210", marginTop:1 }}>
            {isExecutive
              ? <span style={{ color:"#c9a030", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" }}>◆ Executive</span>
              : member.rank}
            {member.porecla?` · "${member.porecla}"`:"" }
          </div>
          {fmtConcediu(member) && (
            <div style={{ marginTop:5 }}>
              <span style={{ background:"#1a1506", color:"#b89028", border:"1px solid #2e2108", borderRadius:4, padding:"1px 7px", fontSize:9, fontFamily:"'Barlow', sans-serif", fontWeight:700, letterSpacing:"0.06em", whiteSpace:"nowrap" }}>
                🏖 Concediu: {fmtConcediu(member)}
              </span>
            </div>
          )}
          {!isSalaSport && LICENSE_DEFS.some(l => !!member[l.key]) && (
            <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:5 }}>
              {LICENSE_DEFS.filter(l => !!member[l.key]).map(l => (
                <span key={l.key} style={{ background:"#1a3a2a", color:"#4ade80", border:"1px solid #22c55e", borderRadius:4, padding:"1px 6px", fontSize:9, fontFamily:"'Barlow', sans-serif", fontWeight:700, letterSpacing:"0.07em", whiteSpace:"nowrap" }}>
                  {l.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {!isSalaSport && <CycleButton options={STATUS_OPTIONS} value={member.status||"Activ"} onChange={v => update("status",v)} colorMap={STATUS_COLORS} disabled={!isAdmin} />}
          {!isSalaSport && <CycleButton options={TASK_OPTIONS} value={member.task||"Neplatit"} onChange={v => update("task",v)} colorMap={TASK_COLORS} disabled={!isAdmin} />}
          {!isSalaSport && <div style={{ color:(member.puncte||0)<0?"#f87171":"#c9a030", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:15, minWidth:40, textAlign:"center" }}>{member.puncte||0}p</div>}
          {isGeneralAdmin && (
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <button onClick={e => { e.stopPropagation(); onMoveUp && onMoveUp(); }} title="Mută sus"
                style={{ background:"#100d06", border:"1px solid #1a1506", color:"#6a5218", borderRadius:4, width:24, height:20, cursor:"pointer", fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", padding:0, lineHeight:1 }}
                onMouseEnter={e => { e.currentTarget.style.color="#c9a030"; e.currentTarget.style.borderColor="#241a06"; }}
                onMouseLeave={e => { e.currentTarget.style.color="#6a5218"; e.currentTarget.style.borderColor="#1a1506"; }}>▲</button>
              <button onClick={e => { e.stopPropagation(); onMoveDown && onMoveDown(); }} title="Mută jos"
                style={{ background:"#100d06", border:"1px solid #1a1506", color:"#6a5218", borderRadius:4, width:24, height:20, cursor:"pointer", fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", padding:0, lineHeight:1 }}
                onMouseEnter={e => { e.currentTarget.style.color="#c9a030"; e.currentTarget.style.borderColor="#241a06"; }}
                onMouseLeave={e => { e.currentTarget.style.color="#6a5218"; e.currentTarget.style.borderColor="#1a1506"; }}>▼</button>
            </div>
          )}
          {isOwnerGA && (
            <button onClick={e => { e.stopPropagation(); onUpdate({ ...member, card_bg: !member.card_bg }); }} title={member.card_bg ? "Scoate background" : "Activează background"}
              style={{ background: member.card_bg ? "#1a0a30" : "#100d06", border:`1px solid ${member.card_bg ? "#7c3aed" : "#1a1506"}`, color: member.card_bg ? "#a78bfa" : "#6a5218", borderRadius:5, width:30, height:28, cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", padding:0, transition:"all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="#7c3aed"; e.currentTarget.style.color="#a78bfa"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=member.card_bg?"#7c3aed":"#1a1506"; e.currentTarget.style.color=member.card_bg?"#a78bfa":"#6a5218"; }}>
              🖼
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} title={expanded?"Restrânge":"Extinde"}
            style={{ background:"#100d06", border:"1px solid #1a1506", color:"#6a5218", borderRadius:5, width:30, height:28, cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}
            onMouseEnter={e => { e.currentTarget.style.color="#c9a030"; e.currentTarget.style.borderColor="#241a06"; }}
            onMouseLeave={e => { e.currentTarget.style.color="#6a5218"; e.currentTarget.style.borderColor="#1a1506"; }}>
            {expanded?"▲":"▼"}
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop:"1px solid #0e0a02", padding:"16px", display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
            <PhotoUpload photo={member.photo} onChange={v => update("photo",v)} disabled={!isAdmin} fallback={isSalaSport ? SALA_SPORT_AVATAR : null} />
            <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <FieldInput label="Nume" value={member.nume} onChange={v => update("nume",v)} disabled={!isAdmin} />
              <FieldInput label="Luni" value={member.luni} onChange={v => update("luni",v)} disabled={!isAdmin} />
              <FieldInput label="Porecla" value={member.porecla} onChange={v => update("porecla",v)} disabled={!isAdmin} />
              <FieldInput label="CNP" value={member.cnp} onChange={v => update("cnp",v)} disabled={!isAdmin} />
              <FieldInput label="Nr. Telefon" value={member.telefon} onChange={v => update("telefon",v)} disabled={!isAdmin} />
              <FieldInput label="Nr. Înmatriculare" value={member.inmatriculare} onChange={v => update("inmatriculare",v)} disabled={!isAdmin} />
            </div>
          </div>
          {/* Executive selector — Sala Sport only. When set, the rank is hidden. */}
          {isSalaSport && (
            <div>
              <label style={{ color:"#5a4210", fontSize:10, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", display:"block", marginBottom:6 }}>DESEMNARE</label>
              <select value={member.executive ? "executive" : "rank"} disabled={!isAdmin}
                onChange={e => update("executive", e.target.value === "executive")}
                style={{ ...selStyle, maxWidth:220, color: isExecutive ? "#f0d878" : "#a89cc8", border: isExecutive ? "1px solid #a07820" : "1px solid #1a1426", cursor: isAdmin ? "pointer" : "default" }}>
                <option value="rank">Rang normal</option>
                <option value="executive">◆ Executive</option>
              </select>
            </div>
          )}
          {/* Rank slider — hidden when a Sala Sport member is marked Executive. */}
          {!isExecutive && <RankSlider value={member.rank||(ranks?ranks[0]:undefined)} onChange={v => update("rank",v)} disabled={!isAdmin} ranks={ranks} />}
          {/* Concediu (leave) date range — on every list, editable by admins. */}
          <div>
            <label style={{ color:"#5a4210", fontSize:10, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", display:"block", marginBottom:6 }}>CONCEDIU (De la → Până la)</label>
            {isAdmin ? (
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                <input type="date" value={member.concediu_start ? String(member.concediu_start).slice(0,10) : ""} onChange={e => update("concediu_start", e.target.value || null)}
                  style={{ background:"#050305", border:"1px solid #1a1506", borderRadius:6, color:"#e6def5", fontFamily:"'Barlow', sans-serif", fontSize:13, padding:"6px 10px", outline:"none", colorScheme:"dark" }} />
                <span style={{ color:"#5a4210" }}>→</span>
                <input type="date" value={member.concediu_end ? String(member.concediu_end).slice(0,10) : ""} onChange={e => update("concediu_end", e.target.value || null)}
                  style={{ background:"#050305", border:"1px solid #1a1506", borderRadius:6, color:"#e6def5", fontFamily:"'Barlow', sans-serif", fontSize:13, padding:"6px 10px", outline:"none", colorScheme:"dark" }} />
                {fmtConcediu(member) && <button onClick={() => onUpdate({ ...member, concediu_start:null, concediu_end:null })}
                  style={{ background:"transparent", border:"1px solid #201830", borderRadius:6, color:"#6a5218", fontSize:12, padding:"5px 10px", cursor:"pointer" }}>Golește</button>}
              </div>
            ) : (
              <div style={{ color: fmtConcediu(member) ? "#b89028" : "#2a1f06", fontFamily:"'Barlow', sans-serif", fontSize:13 }}>{fmtConcediu(member) || "—"}</div>
            )}
          </div>
          {/* License buttons — hidden for Sala Sport */}
          {!isSalaSport && (
          <div>
            <label style={{ color:"#5a4210", fontSize:10, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", display:"block", marginBottom:8 }}>LICENȚE</label>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {LICENSE_DEFS.map(({ key, label }) => {
                const obtained = !!member[key];
                return (
                  <button
                    key={key}
                    onClick={() => { if (isAdmin) update(key, !obtained); }}
                    title={obtained ? "Obținut" : "Neobținut"}
                    className="ev-license"
                    style={{
                      background: obtained ? "#1a3a2a" : "#2e1a3d",
                      color: obtained ? "#4ade80" : "#f87171",
                      border: `1px solid ${obtained ? "#22c55e" : "#ef4444"}`,
                      borderRadius: 7,
                      padding: "5px 14px",
                      fontFamily: "'Barlow', sans-serif",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: isAdmin ? "pointer" : "default",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          )}
          {/* ── PUNCTE & ACTIVITATE — hidden for Sala Sport ── */}
          {!isSalaSport && (
          <div style={{ background:"#0b0715", border:"1px solid #0e0a02", borderRadius:10, padding:"14px 16px", display:"flex", flexDirection:"column", gap:12 }}>
            {/* Header: total points */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <label style={{ color:"#352808", fontSize:10, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.12em", textTransform:"uppercase" }}>PUNCTE TOTALE</label>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:(member.puncte||0)<0?"#f87171":"#c9a030", fontFamily:"'Rajdhani', sans-serif", fontWeight:800, fontSize:26, lineHeight:1 }}>{member.puncte||0}</span>
                <span style={{ color:"#352808", fontFamily:"'Barlow', sans-serif", fontSize:12 }}>p</span>
              </div>
            </div>

            {/* Activity log chips */}
            {activityLog.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {activityLog.map(e => (
                  <div key={e.key} className="ev-chip" style={{ display:"flex", alignItems:"center", gap:5, background: e.sign>0?"#0a1a0a":"#190f2a", border:`1px solid ${e.sign>0?"#1a3a1a":"#2e1a3d"}`, borderRadius:6, padding:"3px 6px 3px 9px" }}>
                    <span style={{ fontFamily:"'Barlow', sans-serif", fontSize:11, color: e.sign>0?"#86efac":"#fca5a5" }}>{e.label}</span>
                    {e.count > 1 && <span style={{ background:"#222", borderRadius:4, padding:"0 5px", fontSize:10, color:"#5a4210", fontFamily:"'Rajdhani', sans-serif", fontWeight:700 }}>x{e.count}</span>}
                    <span style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:12, color: e.sign>0?"#4ade80":"#f87171" }}>{e.sign>0?"+":"-"}{e.pts * e.count}p</span>
                    {isAdmin && <button onClick={() => removeActivity(e)} title="Anulează ultima înregistrare" style={{ background:"transparent", border:"none", cursor:"pointer", color:"#2a1f06", fontSize:12, lineHeight:1, padding:"0 2px", marginLeft:1, transition:"color 0.12s" }}
                      onMouseEnter={e2 => e2.currentTarget.style.color="#f87171"} onMouseLeave={e2 => e2.currentTarget.style.color="#444"}>×</button>}
                  </div>
                ))}
              </div>
            )}

            {isAdmin && (<>
              {/* Add task row */}
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <div style={{ flex:1, position:"relative" }}>
                  <select value={addTask} onChange={e => setAddTask(e.target.value)} style={selStyle}>
                    <option value="">➕ Adaugă activitate...</option>
                    {activityTasks.map(t => <option key={t.label} value={t.label}>{t.label} (+{t.points}p)</option>)}
                  </select>
                </div>
                <button onClick={handleAddTask} disabled={!addTask}
                  style={{ background: addTask?"#0d1f0d":"#050305", border:`1px solid ${addTask?"#22c55e":"#1a1426"}`, color: addTask?"#4ade80":"#251a06", borderRadius:7, padding:"7px 14px", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:13, cursor: addTask?"pointer":"default", transition:"all 0.15s" }}>
                  ✓ Dă
                </button>
              </div>

              {/* Subtract task row */}
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <div style={{ flex:1, position:"relative" }}>
                  <select value={subTask} onChange={e => setSubTask(e.target.value)} style={{ ...selStyle, color: subTask?"#fca5a5":"#a89cc8" }}>
                    <option value="">➖ Scade activitate...</option>
                    {activityTasks.map(t => <option key={t.label} value={t.label}>{t.label} (-{t.points}p)</option>)}
                  </select>
                </div>
                <button onClick={handleSubTask} disabled={!subTask}
                  style={{ background: subTask?"#1e1706":"#050305", border:`1px solid ${subTask?"#ef4444":"#1a1426"}`, color: subTask?"#f87171":"#251a06", borderRadius:7, padding:"7px 14px", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:13, cursor: subTask?"pointer":"default", transition:"all 0.15s" }}>
                  ✓ Scade
                </button>
              </div>

              {/* Divider */}
              <div style={{ borderTop:"1px solid #1c1728", paddingTop:10 }}>
                <label style={{ color:"#2a1f06", fontSize:10, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", display:"block", marginBottom:8 }}>Ajustare Manuală</label>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <input
                    placeholder="Motiv (opțional)..."
                    value={manualLabel}
                    onChange={e => setManualLabel(e.target.value)}
                    onKeyDown={e => { if(e.key==="Enter") handleManual(); }}
                    style={{ flex:1, background:"#050305", border:"1px solid #171022", borderRadius:6, color:"#e6def5", fontFamily:"'Barlow', sans-serif", fontSize:12, padding:"7px 10px", outline:"none" }}
                    onFocus={e => e.target.style.borderColor="#c9a030"}
                    onBlur={e => e.target.style.borderColor="#171022"}
                  />
                  <input
                    type="number" value={manualAmt} placeholder="0"
                    onChange={e => setManualAmt(parseInt(e.target.value) || "")}
                    onKeyDown={e => { if(e.key==="Enter") handleManual(); }}
                    style={{ width:68, background:"#050305", border:"1px solid #171022", borderRadius:6, color: manualAmt > 0 ? "#4ade80" : manualAmt < 0 ? "#f87171" : "#c9a030", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:15, padding:"7px 8px", outline:"none", textAlign:"center" }}
                    onFocus={e => e.target.style.borderColor="#c9a030"}
                    onBlur={e => e.target.style.borderColor="#171022"}
                  />
                  <button onClick={handleManual} disabled={!manualAmt || manualAmt === 0}
                    style={{ background: manualAmt && manualAmt !== 0 ? (manualAmt > 0 ? "#0d1f0d" : "#1e1706") : "#050305", border:`1px solid ${manualAmt && manualAmt !== 0 ? (manualAmt > 0 ? "#22c55e" : "#ef4444") : "#1a1426"}`, color: manualAmt && manualAmt !== 0 ? (manualAmt > 0 ? "#4ade80" : "#f87171") : "#251a06", borderRadius:6, padding:"7px 14px", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:13, cursor: manualAmt && manualAmt !== 0 ? "pointer" : "default", transition:"all 0.15s", whiteSpace:"nowrap" }}>
                    ✓ Aplică
                  </button>
                </div>
                <div style={{ marginTop:5, color:"#251a06", fontSize:10, fontFamily:"'Barlow', sans-serif" }}>Număr pozitiv = adaugă · negativ = scade</div>
              </div>

              {/* Reset puncte — General Admin only */}
              {isGeneralAdmin && (
                <div style={{ display:"flex", gap:8, paddingTop:4, borderTop:"1px solid #1c1728" }}>
                  <button onClick={() => { setActivityLog([]); onUpdate({...member, task:"Neplatit", puncte:0, task_log:[]}); logAction("Reset puncte", member.nume || "?"); }}
                    style={{ background:"#100d06", border:"1px solid #251a3d", color:"#fb923c", borderRadius:6, padding:"6px 14px", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:12, cursor:"pointer" }}>↺ Reset Puncte</button>
                </div>
              )}
            </>)}

            {!isAdmin && (
              <div style={{ color:"#352808", fontFamily:"'Barlow', sans-serif", fontSize:11 }}>Doar adminii pot modifica punctele.</div>
            )}
          </div>
          )}
          {/* Archive / Delete */}
          {canDelete && (
            <div style={{ display:"flex", gap:8, paddingTop:6, borderTop:"1px solid #0e0a02", flexWrap:"wrap" }}>
              {isGeneralAdmin ? (
                <>
                  <button onClick={onArchive}
                    style={{ background:"#0a100a", border:"1px solid #1e3010", color:"#86efac", borderRadius:6, padding:"6px 14px", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:12, cursor:"pointer" }}>📁 Arhivează</button>
                  <button onClick={onDelete}
                    style={{ background:"#100d06", border:"1px solid #2e1a1a", color:"#f87171", borderRadius:6, padding:"6px 14px", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:12, cursor:"pointer" }}>🗑️ Șterge definitiv</button>
                </>
              ) : (
                <button onClick={onDelete}
                  style={{ background:"#100d06", border:"1px solid #2e1a3d", color:"#f87171", borderRadius:6, padding:"6px 14px", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:12, cursor:"pointer" }}>✕ Șterge Membru</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MembersSection({ role, currentUser }) {
  const isGeneralAdmin = role === "general_admin";
  const isOwnerGA = currentUser?.email === "cristeasebastian1000@yahoo.com";
  const isAdmin = role === "general_admin" || role === "admin2"; // can edit
  const isVisitor = role === "visitor";
  const canDelete = isAdmin;
  const canAddToList = (list) => (list?.add_role === "admin2" ? isAdmin : isGeneralAdmin);
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null);
  const [members, setMembers] = useState({});
  const [newListName, setNewListName] = useState("");
  const [newListSystem, setNewListSystem] = useState("default");
  const [showNewList, setShowNewList] = useState(false);
  const [search, setSearch] = useState("");
  const [licenseFilter, setLicenseFilter] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activityTasks, setActivityTasks] = useState(ACTIVITY_TASKS);
  const [showArchiveView, setShowArchiveView] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // { listId, memberId, name }
  const [pendingArchive, setPendingArchive] = useState(null); // { listId, memberId, name }
  const saveTimeout = useRef(null);

  useEffect(() => {
    const parsePoints = (val) => { const n = parseInt(val); return isNaN(n) ? 0 : n; };
    const toTasks = (rows) => rows
      .filter(r => parsePoints(r.value) > 0)
      .map(r => ({ label: r.label, points: parsePoints(r.value) }));

    supabase.from("puncte_rules")
      .select("*")
      .in("category", ["puncte_mobs", "ajutor_vendettas"])
      .order("sort_order")
      .then(({ data }) => { if (data && data.length > 0) setActivityTasks(toTasks(data)); });

    const ch = supabase.channel("puncte_rules_members_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "puncte_rules" }, () => {
        supabase.from("puncte_rules")
          .select("*")
          .in("category", ["puncte_mobs", "ajutor_vendettas"])
          .order("sort_order")
          .then(({ data }) => { if (data) setActivityTasks(toTasks(data)); });
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  useEffect(() => { setLicenseFilter(null); }, [activeListId]);

  // Keep the active tab within the lists the current role is allowed to see.
  useEffect(() => {
    const allowed = isVisitor ? lists.filter(isSalaSportList) : lists;
    if (allowed.length && !allowed.some(l => l.id === activeListId)) {
      setActiveListId(allowed[0].id);
    }
  }, [lists, isVisitor, activeListId]);

  useEffect(() => {
    async function load() {
      const { data: listsData } = await supabase.from("lists").select("*").order("sort_order").order("created_at");
      const loadedLists = listsData || [];
      setLists(loadedLists);
      const membersObj = {};
      for (const list of loadedLists) {
        const { data: mData } = await supabase.from("members").select("*").eq("list_id", list.id).order("created_at");
        membersObj[list.id] = mData || [];
      }
      setMembers(membersObj);
      if (loadedLists.length > 0) setActiveListId(loadedLists[0].id);
      setLoading(false);
    }
    load();

    const listsChannel = supabase
      .channel("lists_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lists" }, payload => {
        if (payload.eventType === "INSERT") {
          setLists(prev => prev.some(l => l.id === payload.new.id) ? prev : [...prev, payload.new]);
          setMembers(prev => ({ ...prev, [payload.new.id]: prev[payload.new.id] || [] }));
        } else if (payload.eventType === "UPDATE") {
          setLists(prev => prev.map(l => l.id === payload.new.id ? { ...l, ...payload.new } : l));
        } else if (payload.eventType === "DELETE") {
          setLists(prev => prev.filter(l => l.id !== payload.old.id));
          setMembers(prev => { const n = { ...prev }; delete n[payload.old.id]; return n; });
        }
      })
      .subscribe();

    const membersChannel = supabase
      .channel("members_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, payload => {
        if (payload.eventType === "INSERT") {
          const lid = payload.new.list_id;
          setMembers(prev => {
            const arr = prev[lid] || [];
            if (arr.some(m => m.id === payload.new.id)) return prev;
            return { ...prev, [lid]: [...arr, payload.new] };
          });
        } else if (payload.eventType === "UPDATE") {
          const lid = payload.new.list_id;
          setMembers(prev => ({ ...prev, [lid]: (prev[lid] || []).map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m) }));
        } else if (payload.eventType === "DELETE") {
          const lid = payload.old.list_id;
          setMembers(prev => ({ ...prev, [lid]: (prev[lid] || []).filter(m => m.id !== payload.old.id) }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(listsChannel);
      supabase.removeChannel(membersChannel);
    };
  }, []);

  const createList = async () => {
    if (!newListName.trim() || !isGeneralAdmin) return;
    const isSala = newListSystem === SALA_SPORT_KEY;
    const nextOrder = lists.reduce((mx, l) => Math.max(mx, l.sort_order || 0), 0) + 1;
    const { data, error } = await supabase.from("lists").insert({ name: newListName.trim(), rank_system: newListSystem, list_type: isSala ? SALA_SPORT_KEY : "standard", add_role: isSala ? "admin2" : "general_admin", sort_order: nextOrder }).select().single();
    if (error || !data) {
      console.error("Could not create list", error);
      alert("Nu am putut crea lista. Verifică dacă ai adăugat coloana 'rank_system' (text) în tabelul 'lists' din Supabase.");
      return;
    }
    setLists(prev => [...prev, data]);
    setMembers(prev => ({ ...prev, [data.id]: [] }));
    setActiveListId(data.id);
    setNewListName(""); setNewListSystem("default"); setShowNewList(false);
    logAction("Creat listă", newListName.trim());
  };

  const deleteList = async id => {
    if (!isGeneralAdmin) return;
    const list = lists.find(l => l.id === id);
    await supabase.from("lists").delete().eq("id", id);
    setLists(prev => { const n = prev.filter(l => l.id !== id); setActiveListId(n.length ? n[0].id : null); return n; });
    setMembers(prev => { const n = {...prev}; delete n[id]; return n; });
    logAction("Șters listă", list?.name || id);
  };

  const addMember = async () => {
    if (!activeListId) return;
    const list = lists.find(l => l.id === activeListId);
    if (!canAddToList(list)) return;
    const defaultRank = getRanks(list)[0];
    let data;
    if (_accountToken) {
      // Admin 2 (no JWT): token-validated server RPC.
      ({ data } = await supabase.rpc("sess_member_insert", { p_token: _accountToken, p_list_id: activeListId, p_rank: defaultRank }));
    } else {
      // General Admin (JWT): direct insert.
      ({ data } = await supabase.from("members").insert({ list_id:activeListId, nume:"", luni:"", porecla:"", cnp:"", telefon:"", inmatriculare:"", rank:defaultRank, status:"Activ", task:"Neplatit", puncte:0, photo:null, executive:false }).select().single());
    }
    if (!data) return;
    logAction("Adăugat membru", `Lista: ${list?.name || ""}`);

    setMembers(prev => ({ ...prev, [activeListId]: [...(prev[activeListId]||[]), data] }));
  };

  const updateMember = useCallback(async (listId, updated) => {
    if (!isAdmin) return;
    setMembers(prev => ({ ...prev, [listId]: (prev[listId]||[]).map(m => m.id===updated.id ? updated : m) }));
    setSaving(true);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      const LICENSE_KEYS = ["hs_driver", "pilot_heli", "pilot_avion", "barca"];
      const { id, created_at, list_id, ...allFields } = updated;
      const licenseFields = {};
      const regularFields = {};
      for (const [k, v] of Object.entries(allFields)) {
        if (LICENSE_KEYS.includes(k)) licenseFields[k] = v;
        else regularFields[k] = v;
      }
      if (_accountToken) {
        // Admin 2 (no JWT): token-validated server RPC updates all editable fields.
        await supabase.rpc("sess_member_update", { p_token: _accountToken, p_id: updated.id, p_data: allFields });
      } else {
        // General Admin (JWT): direct update.
        const hasLicenseChange = Object.keys(licenseFields).length > 0;
        if (hasLicenseChange) {
          const { error } = await supabase.from("members").update({ ...regularFields, ...licenseFields }).eq("id", updated.id);
          if (error && error.code === "PGRST204") {
            await supabase.from("members").update(regularFields).eq("id", updated.id);
          }
        } else {
          await supabase.from("members").update(regularFields).eq("id", updated.id);
        }
      }
      setSaving(false);
    }, 700);
  }, [isAdmin]);

  const deleteMember = async (listId, memberId) => {
    if (!canDelete) return;
    const member = (members[listId]||[]).find(m => m.id === memberId);
    if (_accountToken) {
      await supabase.rpc("sess_member_delete", { p_token: _accountToken, p_id: memberId });
    } else {
      await supabase.from("members").delete().eq("id", memberId);
    }
    setMembers(prev => ({ ...prev, [listId]: (prev[listId]||[]).filter(m => m.id !== memberId) }));
    logAction("Șters membru", member?.nume || "necunoscut");
    setPendingDelete(null);
  };

  const moveMember = async (listId, memberId, direction) => {
    if (!isGeneralAdmin) return;
    const list = lists.find(l => l.id === listId);
    const ranks = getRanks(list);
    const isSala = isSalaSportList(list);
    const allNonArchived = (members[listId] || []).filter(m => !m.archived);
    const sorted = [...allNonArchived].sort(memberSortFn(ranks, isSala));
    const idx = sorted.findIndex(m => m.id === memberId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const withOrders = sorted.map((m, i) => ({ id: m.id, sort_order: i + 1 }));
    const tmp = withOrders[idx].sort_order;
    withOrders[idx].sort_order = withOrders[swapIdx].sort_order;
    withOrders[swapIdx].sort_order = tmp;
    const results = await Promise.all(withOrders.map(({ id, sort_order }) =>
      supabase.from("members").update({ sort_order }).eq("id", id)
    ));
    const failed = results.find(r => r.error);
    if (failed) { console.error("[moveMember] DB update failed:", failed.error); alert("Eroare la salvare ordine: " + failed.error.message); return; }
    setMembers(prev => ({
      ...prev,
      [listId]: (prev[listId] || []).map(m => {
        const w = withOrders.find(x => x.id === m.id);
        return w ? { ...m, sort_order: w.sort_order } : m;
      })
    }));
  };

  const archiveMember = async (listId, memberId, archiveStatus) => {
    if (!isGeneralAdmin) return;
    const member = (members[listId]||[]).find(m => m.id === memberId);
    await supabase.from("members").update({
      archived: true,
      archive_status: archiveStatus,
      archived_at: new Date().toISOString(),
    }).eq("id", memberId);
    setMembers(prev => ({ ...prev, [listId]: (prev[listId]||[]).map(m =>
      m.id === memberId ? { ...m, archived: true, archive_status: archiveStatus, archived_at: new Date().toISOString() } : m
    )}));
    logAction("Arhivat membru", `${member?.nume || "?"} — ${archiveStatus}`);
    setPendingArchive(null);
  };

  const visibleLists = isVisitor ? lists.filter(isSalaSportList) : lists;
  const activeList = visibleLists.find(l => l.id === activeListId);
  const activeRanks = getRanks(activeList);
  const activeIsSalaSport = isSalaSportList(activeList);
  const memberSortFn = (ranks, isSala) => (a, b) => {
    const ao = a.sort_order || 0;
    const bo = b.sort_order || 0;
    if (ao !== bo) return ao - bo;
    if (isSala && (!!a.executive !== !!b.executive)) return a.executive ? -1 : 1;
    const ai = ranks.indexOf(a.rank);
    const bi = ranks.indexOf(b.rank);
    const aRank = ai === -1 ? -1 : ai;
    const bRank = bi === -1 ? -1 : bi;
    if (bRank !== aRank) return bRank - aRank;
    return (a.nume||"").localeCompare(b.nume||"", "ro");
  };
  const sortedMembers = activeList
    ? [...(members[activeListId]||[])].filter(m => !m.archived).sort(memberSortFn(activeRanks, activeIsSalaSport))
    : [];
  const q = search.trim().toLowerCase();
  const searchFiltered = q
    ? sortedMembers.filter(m =>
        [m.nume, m.porecla, m.cnp, m.telefon, m.inmatriculare, m.rank]
          .some(v => (v||"").toString().toLowerCase().includes(q))
      )
    : sortedMembers;
  const activeMembers = licenseFilter
    ? searchFiltered.filter(m => !!m[licenseFilter])
    : searchFiltered;

  const ARCHIVE_STATUS_COLORS = { demisie: { bg:"#0a0f1a", border:"#1e3a5f", color:"#60a5fa", label:"📋 Demisie" }, decedat: { bg:"#0f0a0a", border:"#3f1a1a", color:"#f87171", label:"🕯️ Decedat" } };
  const archivedCount = isGeneralAdmin ? Object.values(members).flat().filter(m => m.archived).length : 0;
  const allArchivedMembers = isGeneralAdmin
    ? Object.entries(members).flatMap(([lid, mems]) =>
        (mems||[]).filter(m => m.archived).map(m => {
          const l = lists.find(x => x.id === lid);
          return { ...m, _listName: l?.name || "?", _avatar: m.photo || (isSalaSportList(l) ? SALA_SPORT_AVATAR : null) };
        })
      ).sort((a, b) => new Date(b.archived_at||0) - new Date(a.archived_at||0))
    : [];

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ display:"flex", gap:14, alignItems:"center", padding:"0 24px", borderBottom:"1px solid #1c1728", height:44, flexShrink:0 }}>
        <SkeletonBox height={14} width={80} />
        <SkeletonBox height={14} width={80} />
      </div>
      <div style={{ padding:"20px 24px" }}>
        <SectionHeaderSkeleton />
        <SkeletonRows count={5} />
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* List tabs */}
      <div style={{ display:"flex", gap:4, alignItems:"center", padding:"0 24px", borderBottom:"1px solid #1c1728", height:44, overflowX:"auto", flexShrink:0 }}>
        {!showArchiveView && visibleLists.map(list => {
          const listMembers = (members[list.id] || []).filter(m => !m.archived);
          const activeCount = listMembers.filter(m => (m.status || "Activ") === "Activ").length;
          const isActive = list.id === activeListId;
          return (
            <button key={list.id} onClick={() => setActiveListId(list.id)} className="list-tab-btn" style={{ background:isActive?"#120e02":"transparent", border:"none", borderBottom:isActive?"2px solid #c9a030":"2px solid transparent", color:isActive?"#e6def5":"#4a3810", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:12, padding:"0 16px", height:"100%", cursor:"pointer", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:8, transition:"color 0.2s,background 0.2s,border-color 0.2s" }}>
              <span>{list.name}</span>
              <span title={`${activeCount} activi din ${listMembers.length}`} style={{ background:isActive?"#1e1706":"#0d0a14", border:`1px solid ${isActive?"#c9a030":"#1e1628"}`, borderRadius:12, padding:"1px 8px", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:10, color:isActive?"#c9a030":"#4a3810", letterSpacing:"0.04em", lineHeight:1.5, transition:"all 0.2s" }}>
                {activeCount}<span style={{ color:isActive?"#8a6c1e":"#2a1e08" }}>/{listMembers.length}</span>
              </span>
              {isGeneralAdmin && <span onClick={e => { e.stopPropagation(); deleteList(list.id); }} style={{ color:"#2a1f06", fontSize:11, cursor:"pointer", transition:"color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="#f87171"} onMouseLeave={e=>e.currentTarget.style.color="#2a1f06"}>✕</span>}
            </button>
          );
        })}
        {isGeneralAdmin && (showNewList ? (
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <input autoFocus value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => { if(e.key==="Enter") createList(); if(e.key==="Escape"){setShowNewList(false);setNewListName("");setNewListSystem("default");} }} placeholder="Nume listă..." style={{ background:"#100d06", border:"1px solid #c9a030", borderRadius:5, color:"#e6def5", fontFamily:"'Barlow', sans-serif", fontSize:12, padding:"3px 8px", outline:"none", width:130 }} />
            <select value={newListSystem} onChange={e => setNewListSystem(e.target.value)} title="Sistem ranguri" style={{ background:"#100d06", border:"1px solid #1a1506", borderRadius:4, color:"#e6def5", fontFamily:"'Barlow', sans-serif", fontSize:11, padding:"3px 6px", outline:"none", cursor:"pointer" }}>
              {Object.entries(RANK_SYSTEMS).map(([key, sys]) => <option key={key} value={key}>{sys.label}</option>)}
            </select>
            <button onClick={createList} style={{ background:"#c9a030", border:"none", borderRadius:4, color:"#0e0a18", fontWeight:700, fontSize:11, padding:"3px 8px", cursor:"pointer" }}>✓</button>
            <button onClick={() => {setShowNewList(false);setNewListName("");setNewListSystem("default");}} style={{ background:"transparent", border:"1px solid #201830", borderRadius:4, color:"#5a4210", fontSize:11, padding:"3px 8px", cursor:"pointer" }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setShowNewList(true)} style={{ background:"transparent", border:"1px solid #1a1506", borderRadius:5, color:"#352808", fontFamily:"'Barlow', sans-serif", fontSize:11, padding:"3px 10px", cursor:"pointer", marginLeft:4, whiteSpace:"nowrap" }}>+ Listă Nouă</button>
        ))}
        {isGeneralAdmin && (
          <button onClick={() => setShowArchiveView(v => !v)} style={{ marginLeft:8, background:showArchiveView?"#0a1a08":"transparent", border:`1px solid ${showArchiveView?"#22c55e":"#1a3010"}`, borderBottom:showArchiveView?"2px solid #22c55e":"2px solid transparent", borderRadius:"4px 4px 0 0", color:showArchiveView?"#86efac":"#2a3a10", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:11, padding:"0 12px", height:"100%", cursor:"pointer", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:6 }}>
            📁 Arhivă
            {archivedCount > 0 && <span style={{ background:"#1a3010", border:"1px solid #22c55e", borderRadius:10, padding:"0 5px", fontSize:10, color:"#86efac", fontFamily:"'Rajdhani', sans-serif", fontWeight:700 }}>{archivedCount}</span>}
          </button>
        )}
        <div style={{ marginLeft:"auto", color:saving?"#c9a030":"#1a1506", fontSize:10, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.1em", whiteSpace:"nowrap" }}>{saving?"● SALVARE...":"● SALVAT"}</div>
      </div>

      {/* Faction photo banner — Aldrick Family & Sicarios only */}
      {!showArchiveView && !activeIsSalaSport && (
        <div style={{ width:"100%", overflow:"hidden", borderBottom:"1px solid rgba(201,160,48,0.10)", flexShrink:0 }}>
          <img src="/pier.png" alt="Aldrick Family & Sicarios" style={{ width:"100%", display:"block", objectFit:"cover", maxHeight:200 }} />
        </div>
      )}

      {/* Archive view — GA only */}
      {showArchiveView && isGeneralAdmin && (
        <div style={{ flex:1, padding:"20px 24px", overflowY:"auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
            <h2 style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:20, color:"#86efac" }}>📁 ARHIVĂ MEMBRI</h2>
            <span style={{ color:"#2a3a10", fontFamily:"'Barlow', sans-serif", fontSize:12 }}>{allArchivedMembers.length} persoane arhivate</span>
          </div>
          {allArchivedMembers.length === 0 ? (
            <div style={{ background:"#050305", border:"1px dashed #1a3010", borderRadius:10, padding:"40px 24px", textAlign:"center", color:"#2a3a10", fontFamily:"'Barlow', sans-serif", fontSize:13 }}>Nicio persoană arhivată.</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {allArchivedMembers.map(m => {
                const sc = ARCHIVE_STATUS_COLORS[m.archive_status] || { bg:"#0f0a0a", border:"#2a1a06", color:"#8a6c1e", label: m.archive_status || "?" };
                return (
                  <div key={m.id} style={{ background:"#0c0a04", border:"1px solid #1a1506", borderRadius:8, padding:"14px 18px", display:"flex", gap:16, alignItems:"flex-start" }}>
                    {m._avatar && <img src={m._avatar} alt="" style={{ width:52, height:64, objectFit:"cover", borderRadius:5, border:"1px solid #2a1a06", flexShrink:0 }} />}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
                        <span style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:16, color:"#c9a030" }}>{m.nume || "—"}</span>
                        {m.porecla && <span style={{ color:"#5a4210", fontFamily:"'Barlow', sans-serif", fontSize:12 }}>({m.porecla})</span>}
                        <span style={{ background:"#1a1506", border:"1px solid #2a1a06", borderRadius:4, padding:"1px 8px", fontFamily:"'Barlow', sans-serif", fontSize:11, color:"#7a5a18" }}>{m._listName}</span>
                        <span style={{ background:sc.bg, border:`1px solid ${sc.border}`, borderRadius:4, padding:"1px 8px", fontFamily:"'Barlow', sans-serif", fontSize:11, color:sc.color, fontWeight:600 }}>{sc.label}</span>
                      </div>
                      <div style={{ display:"flex", gap:14, flexWrap:"wrap", fontSize:12, fontFamily:"'Barlow', sans-serif", color:"#5a4210" }}>
                        {m.rank && <span>Rang: <span style={{ color:"#8a6c1e" }}>{m.rank}</span></span>}
                        {m.luni && <span>Luni: <span style={{ color:"#8a6c1e" }}>{m.luni}</span></span>}
                        {m.cnp && <span>CNP: <span style={{ color:"#6a5010" }}>{m.cnp}</span></span>}
                        {m.telefon && <span>Tel: <span style={{ color:"#6a5010" }}>{m.telefon}</span></span>}
                        {m.inmatriculare && <span>Auto: <span style={{ color:"#6a5010" }}>{m.inmatriculare}</span></span>}
                        {m.puncte !== undefined && <span>Puncte: <span style={{ color:"#c9a030" }}>{m.puncte}</span></span>}
                        {m.archived_at && <span style={{ color:"#3a2808" }}>Arhivat: {new Date(m.archived_at).toLocaleDateString("ro-RO")}</span>}
                      </div>
                      <div style={{ marginTop:8, borderTop:"1px solid #1a1506", paddingTop:8 }}>
                        <button
                          onClick={() => setPendingDelete({ listId: m.list_id, memberId: m.id, name: m.nume || "?" })}
                          style={{ background:"#100d06", border:"1px solid #2e1a1a", color:"#f87171", borderRadius:6, padding:"5px 13px", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:11, cursor:"pointer" }}>
                          🗑️ Șterge definitiv
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {pendingArchive && isGeneralAdmin && (
        <ArchiveModal
          memberName={pendingArchive.name}
          onConfirm={status => archiveMember(pendingArchive.listId, pendingArchive.memberId, status)}
          onCancel={() => setPendingArchive(null)}
        />
      )}
      {pendingDelete && (
        <DeleteConfirmModal
          memberName={pendingDelete.name}
          onConfirm={() => deleteMember(pendingDelete.listId, pendingDelete.memberId)}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {!showArchiveView && <div style={{ flex:1, padding:"20px 24px", overflowY:"auto" }}>
        {!activeList ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:300, gap:12 }}>
            <div style={{ color:"#251a06", fontSize:40 }}>📋</div>
            <div style={{ color:"#2a1f06", fontFamily:"'Rajdhani', sans-serif", fontSize:16 }}>NICIO LISTĂ</div>
            {isGeneralAdmin && <button onClick={() => setShowNewList(true)} style={{ background:"#c9a030", border:"none", borderRadius:8, color:"#0e0a18", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:14, padding:"8px 20px", cursor:"pointer" }}>+ CREEAZĂ PRIMA LISTĂ</button>}
          </div>
        ) : (
          <>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, gap:12, flexWrap:"wrap" }}>
              <div>
                <h2 style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:20, color:"#e6def5" }}>{activeList.name}</h2>
                <div style={{ color:"#352808", fontSize:12, fontFamily:"'Barlow', sans-serif" }}>
                  {(q||licenseFilter) ? `${activeMembers.length} / ${sortedMembers.length}` : activeMembers.length} membri
                  {!isAdmin&&<span style={{ marginLeft:8, color:"#241a06" }}>· Vizualizare</span>}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:"auto" }}>
                <div style={{ position:"relative" }}>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Caută nume, poreclă, CNP, telefon, rang..."
                    style={{ background:"#050305", border:"1px solid #1a1506", borderRadius:6, color:"#e6def5", fontFamily:"'Barlow', sans-serif", fontSize:13, padding:"7px 28px 7px 12px", width:300, outline:"none" }}
                    onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor="#1a1506"} />
                  {search && <button onClick={() => setSearch("")} title="Șterge căutarea" style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", background:"transparent", border:"none", color:"#5a4210", fontSize:14, cursor:"pointer", padding:"0 4px" }}>✕</button>}
                </div>
                {canAddToList(activeList) && <button onClick={addMember} style={{ background:"#c9a030", border:"none", borderRadius:7, color:"#0e0a18", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:13, padding:"7px 16px", cursor:"pointer" }}>+ ADAUGĂ MEMBRU</button>}
              </div>
            </div>
            {!activeIsSalaSport && (
            <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", marginBottom:12 }}>
              <span style={{ color:"#352808", fontSize:10, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", marginRight:4 }}>Licență:</span>
              <button
                onClick={() => setLicenseFilter(null)}
                style={{ background:licenseFilter===null?"#241a06":"#1c1728", color:licenseFilter===null?"#c9a030":"#555", border:`1px solid ${licenseFilter===null?"#c9a030":"#1a1506"}`, borderRadius:5, padding:"3px 10px", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:11, cursor:"pointer", letterSpacing:"0.05em" }}>
                TOATE
              </button>
              {LICENSE_DEFS.map(l => {
                const active = licenseFilter === l.key;
                const count = (members[activeListId]||[]).filter(m => !!m[l.key]).length;
                return (
                  <button key={l.key} onClick={() => setLicenseFilter(active ? null : l.key)}
                    style={{ background:active?"#1a3a2a":"#1c1728", color:active?"#4ade80":"#555", border:`1px solid ${active?"#22c55e":"#1a1506"}`, borderRadius:5, padding:"3px 10px", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:11, cursor:"pointer", letterSpacing:"0.05em", display:"flex", alignItems:"center", gap:5 }}>
                    {l.label}
                    <span style={{ background:active?"#0d2a1a":"#050305", color:active?"#4ade80":"#444", border:`1px solid ${active?"#22c55e":"#1a1506"}`, borderRadius:8, padding:"0 5px", fontSize:10, fontFamily:"'Rajdhani', sans-serif", fontWeight:700, lineHeight:1.5 }}>{count}</span>
                  </button>
                );
              })}
            </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {activeMembers.length===0 ? (
                <div style={{ background:"#050305", border:"1px dashed #1d1528", borderRadius:10, padding:"40px 24px", textAlign:"center", color:"#251a06", fontFamily:"'Barlow', sans-serif", fontSize:13 }}>Niciun membru. {canAddToList(activeList)&&"Apasă + pentru a adăuga."}</div>
              ) : activeMembers.map((m, idx) => (
                <MemberCard key={m.id} member={m}
                  onUpdate={u => updateMember(activeListId, u)}
                  onDelete={() => isGeneralAdmin
                    ? setPendingDelete({ listId: activeListId, memberId: m.id, name: m.nume || "?" })
                    : deleteMember(activeListId, m.id)
                  }
                  onArchive={() => setPendingArchive({ listId: activeListId, memberId: m.id, name: m.nume || "?" })}
                  onMoveUp={idx > 0 ? () => moveMember(activeListId, m.id, "up") : null}
                  onMoveDown={idx < activeMembers.length - 1 ? () => moveMember(activeListId, m.id, "down") : null}
                  isAdmin={isAdmin} isGeneralAdmin={isGeneralAdmin} canDelete={canDelete}
                  isSalaSport={activeIsSalaSport} ranks={activeRanks} rankSystem={activeList?.rank_system} activityTasks={activityTasks} isOwnerGA={isOwnerGA} />
              ))}
            </div>
          </>
        )}
      </div>}
    </div>
  );
}

// ─── Heists Section ──────────────────────────────────────────────────────────
function HeistDetail({ heist, isAdmin, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);
  const saveTimers = useRef({});

  useEffect(() => {
    setLoading(true);
    supabase.from("heist_items").select("*").eq("heist_id", heist.id).order("created_at").then(({ data }) => { setItems(data||[]); setLoading(false); });
    return () => {
      Object.values(saveTimers.current).forEach(t => clearTimeout(t));
      saveTimers.current = {};
    };
  }, [heist.id]);

  const addItem = async () => {
    if (!isAdmin) return;
    const { data } = await supabase.from("heist_items").insert({ heist_id:heist.id, photo:null, info:"" }).select().single();
    if (data) { setItems(prev => [...prev, data]); logAction("Adăugat item heist", heist.name); }
  };

  const updateItem = (id, fields, immediate = false) => {
    if (!isAdmin) return;
    setItems(prev => prev.map(i => i.id===id ? {...i, ...fields} : i));
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    const flush = () => { supabase.from("heist_items").update(fields).eq("id", id); delete saveTimers.current[id]; };
    if (immediate) flush();
    else saveTimers.current[id] = setTimeout(flush, 600);
  };

  const deleteItem = async id => {
    if (!isAdmin) return;
    await supabase.from("heist_items").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    logAction("Șters item heist", heist.name);
  };

  return (
    <div style={{ padding:"20px 24px" }}>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <button onClick={onBack} style={{ background:"#100d06", border:"1px solid #1a1506", borderRadius:7, color:"#6a5218", fontFamily:"'Barlow', sans-serif", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>← Înapoi</button>
        <h2 style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:22, color:"#c9a030", letterSpacing:"0.08em" }}>{heist.name}</h2>
        {isAdmin && <button onClick={addItem} style={{ marginLeft:"auto", background:"#c9a030", border:"none", borderRadius:7, color:"#0e0a18", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:13, padding:"7px 16px", cursor:"pointer" }}>+ Adaugă Foto/Info</button>}
      </div>

      {loading ? (
        <SkeletonGrid count={6} minWidth={260} height={260} />
      ) : items.length === 0 ? (
        <div style={{ background:"#050305", border:"1px dashed #1d1528", borderRadius:10, padding:"48px 24px", textAlign:"center", color:"#251a06", fontFamily:"'Barlow', sans-serif", fontSize:13 }}>
          Nicio informație adăugată. {isAdmin && "Apasă + pentru a adăuga."}
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:16 }}>
          {items.map(item => (
            <div key={item.id} className="ev-grid-card" style={{ background:"#0f0a1c", border:"1px solid #171022", borderRadius:10, overflow:"hidden" }}>
              {item.photo ? (
                <div onClick={() => setLightbox(item.photo)} style={{ cursor:"zoom-in", position:"relative", height:180, overflow:"hidden" }}>
                  <img src={item.photo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", transition:"transform 0.2s" }}
                    onMouseEnter={e => e.target.style.transform="scale(1.03)"} onMouseLeave={e => e.target.style.transform="scale(1)"} />
                  <div style={{ position:"absolute", bottom:6, right:8, background:"rgba(0,0,0,0.6)", borderRadius:4, padding:"2px 6px", color:"#6a5218", fontSize:10, fontFamily:"'Barlow', sans-serif" }}>🔍 zoom</div>
                </div>
              ) : isAdmin ? (
                <PhotoUpload photo={null} onChange={v => updateItem(item.id, { photo:v }, true)} disabled={false} size={260} />
              ) : (
                <div style={{ height:120, background:"#100d06", display:"flex", alignItems:"center", justifyContent:"center", color:"#251a06", fontSize:24 }}>📷</div>
              )}
              <div style={{ padding:12, display:"flex", flexDirection:"column", gap:8 }}>
                {isAdmin ? (
                  <>
                    <textarea value={item.info||""} onChange={e => updateItem(item.id, { info:e.target.value })} placeholder="Adaugă informații..." rows={3}
                      style={{ background:"#0c0a04", border:"1px solid #1a1506", borderRadius:6, color:"#e6def5", fontFamily:"'Barlow', sans-serif", fontSize:12, padding:"6px 8px", outline:"none", resize:"vertical" }}
                      onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor="#1a1506"} />
                    <button onClick={() => deleteItem(item.id)} style={{ background:"transparent", border:"1px solid #2e1a3d", color:"#f87171", borderRadius:5, padding:"4px", fontFamily:"'Barlow', sans-serif", fontSize:11, cursor:"pointer" }}>✕ Șterge</button>
                  </>
                ) : item.info ? (
                  <div style={{ color:"#aaa", fontFamily:"'Barlow', sans-serif", fontSize:13, lineHeight:1.5 }}>{item.info}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeistsSection({ isAdmin }) {
  const [heists, setHeists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeHeist, setActiveHeist] = useState(null);
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    supabase.from("heists").select("*").order("created_at").then(({ data }) => { setHeists(data||[]); setLoading(false); });
    const ch = supabase.channel("heists_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "heists" }, payload => {
        if (payload.eventType === "INSERT") setHeists(prev => prev.some(h => h.id === payload.new.id) ? prev : [...prev, payload.new]);
        else if (payload.eventType === "UPDATE") setHeists(prev => prev.map(h => h.id === payload.new.id ? { ...h, ...payload.new } : h));
        else if (payload.eventType === "DELETE") setHeists(prev => prev.filter(h => h.id !== payload.old.id));
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const createHeist = async () => {
    if (!newName.trim() || !isAdmin) return;
    await supabase.from("heists").insert({ name:newName.trim(), cover_photo:null });
    logAction("Creat heist", newName.trim());
    setNewName(""); setShowNew(false);
  };

  const updateCover = async (id, photo) => {
    if (!isAdmin) return;
    const h = heists.find(x => x.id === id);
    await supabase.from("heists").update({ cover_photo:photo }).eq("id", id);
    logAction("Actualizat cover heist", h?.name || id);
  };

  const deleteHeist = async id => {
    if (!isAdmin) return;
    const h = heists.find(x => x.id === id);
    await supabase.from("heists").delete().eq("id", id);
    logAction("Șters heist", h?.name || id);
  };

  if (activeHeist) return <HeistDetail heist={activeHeist} isAdmin={isAdmin} onBack={() => setActiveHeist(null)} />;

  return (
    <div style={{ padding:"20px 24px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h2 style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:22, color:"#e6def5" }}>HEISTS</h2>
          <div style={{ color:"#352808", fontSize:12, fontFamily:"'Barlow', sans-serif" }}>{heists.length} înregistrate</div>
        </div>
        {isAdmin && (showNew ? (
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if(e.key==="Enter") createHeist(); if(e.key==="Escape"){setShowNew(false);setNewName("");} }} placeholder="Nume heist..."
              style={{ background:"#100d06", border:"1px solid #c9a030", borderRadius:7, color:"#e6def5", fontFamily:"'Barlow', sans-serif", fontSize:13, padding:"7px 12px", outline:"none", width:200 }} />
            <button onClick={createHeist} style={{ background:"#c9a030", border:"none", borderRadius:6, color:"#0e0a18", fontWeight:700, fontSize:12, padding:"7px 14px", cursor:"pointer" }}>✓</button>
            <button onClick={() => {setShowNew(false);setNewName("");}} style={{ background:"transparent", border:"1px solid #201830", borderRadius:6, color:"#5a4210", fontSize:12, padding:"7px 12px", cursor:"pointer" }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setShowNew(true)} style={{ background:"#c9a030", border:"none", borderRadius:7, color:"#0e0a18", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:13, padding:"7px 16px", cursor:"pointer" }}>+ HEIST NOU</button>
        ))}
      </div>

      {loading ? (
        <SkeletonGrid count={6} minWidth={220} height={210} />
      ) : heists.length === 0 ? (
        <div style={{ background:"#050305", border:"1px dashed #1d1528", borderRadius:10, padding:"60px 24px", textAlign:"center", color:"#251a06", fontFamily:"'Barlow', sans-serif", fontSize:14 }}>
          Niciun heist. {isAdmin && "Creează primul heist."}
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:16 }}>
          {heists.map(heist => (
            <div key={heist.id} className="ev-grid-card" style={{ background:"#0f0a1c", border:"1px solid #171022", borderRadius:12, overflow:"hidden", cursor:"pointer" }}>
              <div onClick={() => setActiveHeist(heist)} style={{ height:150, overflow:"hidden", position:"relative", background:"#100d06" }}>
                {heist.cover_photo
                  ? <img src={heist.cover_photo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color:"#251a06", fontSize:36 }}>🎯</div>}
              </div>
              <div style={{ padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div onClick={() => setActiveHeist(heist)} style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:16, color:"#e6def5", letterSpacing:"0.05em", flex:1 }}>{heist.name}</div>
                {isAdmin && (
                  <div style={{ display:"flex", gap:6 }}>
                    <label style={{ cursor:"pointer", color:"#352808", fontSize:12 }} title="Schimbă cover">
                      📷
                      <input type="file" accept="image/*" style={{ display:"none" }} onChange={e => { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>updateCover(heist.id, ev.target.result); r.readAsDataURL(f); }} />
                    </label>
                    <button onClick={e => { e.stopPropagation(); deleteHeist(heist.id); }} style={{ background:"transparent", border:"none", color:"#2a1f06", fontSize:12, cursor:"pointer", padding:"0 2px" }}>✕</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Zone Info Section ───────────────────────────────────────────────────────
function ZoneInfoSection({ isAdmin }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    supabase.from("zone_info").select("*").order("created_at").then(({ data }) => { setItems(data||[]); setLoading(false); });
    const ch = supabase.channel("zone_info_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "zone_info" }, payload => {
        if (payload.eventType === "INSERT") setItems(prev => prev.some(i => i.id === payload.new.id) ? prev : [...prev, payload.new]);
        else if (payload.eventType === "UPDATE") setItems(prev => prev.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i));
        else if (payload.eventType === "DELETE") setItems(prev => prev.filter(i => i.id !== payload.old.id));
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const addItem = async () => {
    if (!isAdmin) return;
    await supabase.from("zone_info").insert({ photo:null, description:"" });
    logAction("Adăugat fotografie zonă", "");
  };

  const updateItem = async (id, fields) => {
    if (!isAdmin) return;
    setItems(prev => prev.map(i => i.id===id ? {...i, ...fields} : i));
    await supabase.from("zone_info").update(fields).eq("id", id);
    if (fields.description !== undefined) logAction("Actualizat descriere zonă", fields.description?.slice(0,60) || "");
    if (fields.photo !== undefined) logAction("Actualizat foto zonă", "");
  };

  const deleteItem = async id => {
    if (!isAdmin) return;
    await supabase.from("zone_info").delete().eq("id", id);
    logAction("Șters fotografie zonă", "");
  };

  return (
    <div style={{ padding:"20px 24px" }}>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h2 style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:22, color:"#e6def5" }}>INFORMAȚII ZONE</h2>
          <div style={{ color:"#352808", fontSize:12, fontFamily:"'Barlow', sans-serif" }}>{items.length} fotografii</div>
        </div>
        {isAdmin && <button onClick={addItem} style={{ background:"#c9a030", border:"none", borderRadius:7, color:"#0e0a18", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:13, padding:"7px 16px", cursor:"pointer" }}>+ ADAUGĂ FOTO</button>}
      </div>

      {loading ? (
        <SkeletonGrid count={6} minWidth={260} height={240} />
      ) : items.length === 0 ? (
        <div style={{ background:"#050305", border:"1px dashed #1d1528", borderRadius:10, padding:"60px 24px", textAlign:"center", color:"#251a06", fontFamily:"'Barlow', sans-serif", fontSize:14 }}>
          Nicio fotografie. {isAdmin && "Apasă + pentru a adăuga."}
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:16 }}>
          {items.map(item => (
            <div key={item.id} className="ev-grid-card" style={{ background:"#0f0a1c", border:"1px solid #171022", borderRadius:10, overflow:"hidden" }}>
              {item.photo ? (
                <div onClick={() => setLightbox(item.photo)} style={{ cursor:"zoom-in", height:200, overflow:"hidden", position:"relative" }}>
                  <img src={item.photo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", transition:"transform 0.2s" }}
                    onMouseEnter={e => e.target.style.transform="scale(1.04)"} onMouseLeave={e => e.target.style.transform="scale(1)"} />
                  <div style={{ position:"absolute", bottom:6, right:8, background:"rgba(0,0,0,0.6)", borderRadius:4, padding:"2px 6px", color:"#aaa", fontSize:10 }}>🔍 zoom</div>
                </div>
              ) : isAdmin ? (
                <div style={{ height:180, background:"#050305", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <label style={{ cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:6, color:"#2a1f06" }}>
                    <span style={{ fontSize:28 }}>📷</span>
                    <span style={{ fontFamily:"'Barlow', sans-serif", fontSize:11 }}>Încarcă foto</span>
                    <input type="file" accept="image/*" style={{ display:"none" }} onChange={e => { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>updateItem(item.id,{photo:ev.target.result}); r.readAsDataURL(f); }} />
                  </label>
                </div>
              ) : (
                <div style={{ height:120, background:"#100d06", display:"flex", alignItems:"center", justifyContent:"center", color:"#251a06", fontSize:24 }}>📷</div>
              )}
              <div style={{ padding:12 }}>
                {isAdmin ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <textarea value={item.description||""} onChange={e => updateItem(item.id,{description:e.target.value})} placeholder="Descriere..." rows={2}
                      style={{ background:"#0c0a04", border:"1px solid #1a1506", borderRadius:6, color:"#e6def5", fontFamily:"'Barlow', sans-serif", fontSize:12, padding:"6px 8px", outline:"none", resize:"vertical" }}
                      onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor="#1a1506"} />
                    <button onClick={() => deleteItem(item.id)} style={{ background:"transparent", border:"1px solid #2e1a3d", color:"#f87171", borderRadius:5, padding:"4px", fontFamily:"'Barlow', sans-serif", fontSize:11, cursor:"pointer" }}>✕ Șterge</button>
                  </div>
                ) : item.description ? (
                  <div style={{ color:"#aaa", fontFamily:"'Barlow', sans-serif", fontSize:13, lineHeight:1.5 }}>{item.description}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Zone Approvals Section ──────────────────────────────────────────────────
const APPROVAL_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
const APPROVAL_STATUS_COLORS = {
  Aprobat:   { bg:"#1a3a2a", text:"#4ade80", border:"#22c55e" },
  Neaprobat: { bg:"#2e1a3d", text:"#f87171", border:"#ef4444" },
};
const WEAPON_COLORS = {
  "Cu Arma":   { bg:"#251a3d", text:"#fb923c", border:"#f97316" },
  "Fara Arma": { bg:"#1a2a3a", text:"#60a5fa", border:"#3b82f6" },
};

function formatRemaining(ms) {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

const ORG_CATEGORIES = [
  { key: "oficiale",   label: "Organizații Oficiale" },
  { key: "neoficiale", label: "Organizații Neoficiale" },
];
const SPOTS_PER_CATEGORY = 8;

function ZoneApprovalsSection({ isAdmin }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("oficiale");
  const [showNew, setShowNew] = useState(false);
  const [now, setNow] = useState(Date.now());
  const expiringRef = useRef(new Set());

  useEffect(() => {
    supabase.from("zone_approvals").select("*").order("created_at").then(({ data }) => { setItems(data||[]); setLoading(false); });
    const channel = supabase
      .channel("zone_approvals_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "zone_approvals" }, payload => {
        if (payload.eventType === "INSERT") {
          setItems(prev => prev.some(i => i.id === payload.new.id) ? prev : [...prev, payload.new]);
        } else if (payload.eventType === "UPDATE") {
          setItems(prev => prev.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i));
        } else if (payload.eventType === "DELETE") {
          setItems(prev => prev.filter(i => i.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const update = async (id, fields) => {
    if (!isAdmin) return;
    setItems(prev => prev.map(i => i.id===id ? {...i, ...fields} : i));
    await supabase.from("zone_approvals").update(fields).eq("id", id);
  };

  // Auto-expire approved entries after 2h (admin-side persists; everyone sees it visually via getEffectiveStatus).
  useEffect(() => {
    if (!isAdmin) return;
    items.forEach(item => {
      if (item.status === "Aprobat" && item.approved_at) {
        const elapsed = now - new Date(item.approved_at).getTime();
        if (elapsed >= APPROVAL_DURATION_MS && !expiringRef.current.has(item.id)) {
          expiringRef.current.add(item.id);
          update(item.id, { status:"Neaprobat", approved_at:null }).finally(() => expiringRef.current.delete(item.id));
        }
      }
    });
  }, [now, items, isAdmin]);

  const create = async () => {
    if (!newName.trim() || !isAdmin) return;
    const inCategory = items.filter(i => (i.category || "oficiale") === newCategory).length;
    if (inCategory >= SPOTS_PER_CATEGORY) {
      const cat = ORG_CATEGORIES.find(c => c.key === newCategory);
      alert(`${cat?.label || newCategory} are deja ${SPOTS_PER_CATEGORY} aprobări. Șterge una pentru a adăuga alta.`);
      return;
    }
    const { data, error } = await supabase.from("zone_approvals").insert({ name:newName.trim(), category:newCategory, status:"Neaprobat", weapon:"Fara Arma", approved_at:null }).select().single();
    if (error || !data) {
      console.error(error);
      alert("Nu am putut crea. Verifică dacă tabelul 'zone_approvals' are coloana 'category' (text) în Supabase.");
      return;
    }
    setItems(prev => [...prev, data]);
    logAction("Adăugat aprobare zonă", `${newName.trim()} (${newCategory})`);
    setNewName(""); setNewCategory("oficiale"); setShowNew(false);
  };

  const toggleStatus = (item) => {
    if (!isAdmin) return;
    const eff = getEffectiveStatus(item);
    if (eff === "Aprobat") {
      update(item.id, { status:"Neaprobat", approved_at:null });
      logAction("Respins aprobare zonă", item.name || "?");
    } else {
      update(item.id, { status:"Aprobat", approved_at:new Date().toISOString() });
      logAction("Aprobat zonă", item.name || "?");
    }
  };

  const toggleWeapon = (item) => {
    if (!isAdmin) return;
    const newWeapon = item.weapon === "Cu Arma" ? "Fara Arma" : "Cu Arma";
    update(item.id, { weapon: newWeapon });
    logAction("Schimbat arme zonă", `${item.name || "?"}: ${newWeapon}`);
  };

  const remove = async (id) => {
    if (!isAdmin) return;
    const item = items.find(i => i.id === id);
    await supabase.from("zone_approvals").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    logAction("Șters aprobare zonă", item?.name || "?");
  };

  const renameItem = (id, name) => {
    update(id, { name });
    logAction("Redenumit zonă", name);
  };

  function getEffectiveStatus(item) {
    if (item.status === "Aprobat" && item.approved_at) {
      const elapsed = Date.now() - new Date(item.approved_at).getTime();
      if (elapsed >= APPROVAL_DURATION_MS) return "Neaprobat";
    }
    return item.status || "Neaprobat";
  }

  function getRemainingMs(item) {
    if (item.status !== "Aprobat" || !item.approved_at) return 0;
    return APPROVAL_DURATION_MS - (now - new Date(item.approved_at).getTime());
  }

  return (
    <div style={{ padding:"20px 24px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, gap:12, flexWrap:"wrap" }}>
        <div>
          <h2 style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:22, color:"#e6def5" }}>APROBĂRI ZONĂ</h2>
          <div style={{ color:"#352808", fontSize:12, fontFamily:"'Barlow', sans-serif" }}>{items.length} aprobări{!isAdmin&&<span style={{ marginLeft:8, color:"#241a06" }}>· Vizualizare</span>}</div>
        </div>
        {isAdmin && (showNew ? (
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if(e.key==="Enter") create(); if(e.key==="Escape"){setShowNew(false);setNewName("");setNewCategory("oficiale");} }} placeholder="Nume zonă..."
              style={{ background:"#100d06", border:"1px solid #c9a030", borderRadius:7, color:"#e6def5", fontFamily:"'Barlow', sans-serif", fontSize:13, padding:"7px 12px", outline:"none", width:220 }} />
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)} title="Categorie" style={{ background:"#100d06", border:"1px solid #1a1506", borderRadius:6, color:"#e6def5", fontFamily:"'Barlow', sans-serif", fontSize:12, padding:"7px 10px", outline:"none", cursor:"pointer" }}>
              {ORG_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <button onClick={create} style={{ background:"#c9a030", border:"none", borderRadius:6, color:"#0e0a18", fontWeight:700, fontSize:12, padding:"7px 14px", cursor:"pointer" }}>✓</button>
            <button onClick={() => {setShowNew(false);setNewName("");setNewCategory("oficiale");}} style={{ background:"transparent", border:"1px solid #201830", borderRadius:6, color:"#5a4210", fontSize:12, padding:"7px 12px", cursor:"pointer" }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setShowNew(true)} style={{ background:"#c9a030", border:"none", borderRadius:7, color:"#0e0a18", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:13, padding:"7px 16px", cursor:"pointer" }}>+ APROBARE NOUĂ</button>
        ))}
      </div>

      {loading ? (
        ORG_CATEGORIES.map((cat, catIdx) => (
          <div key={cat.key} style={{ marginBottom: catIdx === ORG_CATEGORIES.length-1 ? 0 : 28 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, paddingBottom:8, borderBottom:"1px solid #1c1728" }}>
              <div style={{ width:3, height:16, background:"#1a1506", borderRadius:2 }} />
              <SkeletonBox height={14} width={180} />
            </div>
            <SkeletonGrid count={4} minWidth={260} height={300} />
          </div>
        ))
      ) : ORG_CATEGORIES.map((cat, catIdx) => {
        const catItems = items.filter(i => (i.category || "oficiale") === cat.key);
        const emptySlots = Math.max(0, SPOTS_PER_CATEGORY - catItems.length);
        return (
          <div key={cat.key} style={{ marginBottom: catIdx === ORG_CATEGORIES.length-1 ? 0 : 28 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, paddingBottom:8, borderBottom:"1px solid #1c1728" }}>
              <div style={{ width:3, height:16, background:"#c9a030", borderRadius:2 }} />
              <h3 style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:15, color:"#c9a030", letterSpacing:"0.12em", textTransform:"uppercase" }}>{cat.label}</h3>
              <span style={{ color:"#352808", fontSize:11, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.08em" }}>{catItems.length} / {SPOTS_PER_CATEGORY}</span>
              {isAdmin && catItems.length < SPOTS_PER_CATEGORY && (
                <button onClick={() => { setNewCategory(cat.key); setShowNew(true); }} style={{ marginLeft:"auto", background:"transparent", border:"1px solid #1a1506", borderRadius:5, color:"#6a5218", fontFamily:"'Barlow', sans-serif", fontSize:11, padding:"3px 10px", cursor:"pointer" }}>+ adaugă aici</button>
              )}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:14 }}>
              {catItems.map(item => {
                const eff = getEffectiveStatus(item);
                const sc = APPROVAL_STATUS_COLORS[eff];
                const wc = WEAPON_COLORS[item.weapon || "Fara Arma"];
                const remaining = getRemainingMs(item);
                const showTimer = eff === "Aprobat" && remaining > 0;
                const pct = showTimer ? Math.max(0, Math.min(100, (remaining / APPROVAL_DURATION_MS) * 100)) : 0;
                return (
              <div key={item.id} className="ev-approval-card" style={{ background:"#0f0a1c", border:`1px solid ${eff==="Aprobat"?"#1f3a2a":"#1a1426"}`, borderRadius:12, overflow:"hidden", display:"flex", flexDirection:"column" }}>
                {/* Logo / cover */}
                <div style={{ position:"relative", height:140, background:"#0c0a04", borderBottom:"1px solid #1e1e1e", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
                  {item.logo ? (
                    <>
                      <img src={item.logo} alt="" aria-hidden="true" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", filter:"blur(22px) brightness(0.45)", transform:"scale(1.15)" }} />
                      <img src={item.logo} alt="" style={{ position:"relative", maxWidth:"82%", maxHeight:"82%", width:"auto", height:"auto", objectFit:"contain", filter:"drop-shadow(0 4px 10px rgba(0,0,0,0.55))" }} />
                    </>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, color:"#251a06" }}>
                      <span style={{ fontSize:34 }}>🏷️</span>
                      <span style={{ fontSize:11, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.1em" }}>FĂRĂ LOGO</span>
                    </div>
                  )}
                  {isAdmin && (
                    <div style={{ position:"absolute", top:8, right:8, display:"flex", gap:6 }}>
                      <label title={item.logo?"Schimbă logo":"Adaugă logo"} style={{ cursor:"pointer", background:"rgba(0,0,0,0.65)", border:"1px solid #1a1506", borderRadius:6, color:"#c9a030", fontSize:12, padding:"4px 8px", fontFamily:"'Barlow', sans-serif", display:"flex", alignItems:"center", gap:4 }}>
                        📷 {item.logo?"Schimbă":"Logo"}
                        <input type="file" accept="image/*" style={{ display:"none" }} onChange={e => { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>update(item.id,{logo:ev.target.result}); r.readAsDataURL(f); e.target.value=""; }} />
                      </label>
                      {item.logo && (
                        <button onClick={() => update(item.id, { logo:null })} title="Șterge logo" style={{ background:"rgba(0,0,0,0.65)", border:"1px solid #2e1a3d", color:"#f87171", borderRadius:6, padding:"4px 8px", fontSize:12, cursor:"pointer", fontFamily:"'Barlow', sans-serif" }}>✕</button>
                      )}
                    </div>
                  )}
                  {/* Status corner badge */}
                  <div style={{ position:"absolute", top:8, left:8, background:sc.bg, color:sc.text, border:`1px solid ${sc.border}`, borderRadius:6, padding:"3px 10px", fontFamily:"'Barlow', sans-serif", fontWeight:700, fontSize:11, letterSpacing:"0.08em" }}>
                    {eff.toUpperCase()}
                  </div>
                  {/* Weapon icon badge — bottom-left */}
                  <div title={item.weapon || "Fara Arma"}
                    style={{ position:"absolute", bottom:8, left:8, width:30, height:30, borderRadius:"50%", background:wc.bg, border:`1px solid ${wc.border}`, color:wc.text, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, boxShadow:"0 2px 6px rgba(0,0,0,0.5)" }}>
                    {(item.weapon||"Fara Arma")==="Cu Arma" ? "🔫" : "🚫"}
                  </div>
                </div>

                {/* Name */}
                <div style={{ padding:"12px 14px 8px" }}>
                  {isAdmin ? (
                    <input value={item.name||""} onChange={e => setItems(prev => prev.map(i => i.id===item.id?{...i,name:e.target.value}:i))} onBlur={e => renameItem(item.id, e.target.value)} placeholder="Nume zonă..."
                      style={{ background:"transparent", border:"1px solid transparent", borderRadius:5, color:"#e6def5", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:18, letterSpacing:"0.05em", padding:"4px 6px", width:"100%", outline:"none" }}
                      onFocus={e => e.target.style.borderColor="#1a1506"} />
                  ) : (
                    <div style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:18, color:"#e6def5", letterSpacing:"0.05em", padding:"4px 6px" }}>{item.name||<span style={{ color:"#2a1f06" }}>Fără Nume</span>}</div>
                  )}
                </div>

                {/* Timer + progress */}
                {showTimer ? (
                  <div style={{ padding:"0 14px 12px" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5 }}>
                      <span style={{ color:"#5a4210", fontSize:10, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.1em" }}>EXPIRĂ ÎN</span>
                      <span style={{ color:"#c9a030", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:15, letterSpacing:"0.08em" }}>⏱ {formatRemaining(remaining)}</span>
                    </div>
                    <div style={{ height:4, background:"#100d06", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ width:`${pct}%`, height:"100%", background:"linear-gradient(90deg, #22c55e, #c9a030)", transition:"width 1s linear" }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ padding:"0 14px 12px" }}>
                    <div style={{ height:4, background:"#100d06", borderRadius:2 }} />
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ padding:"10px 14px", borderTop:"1px solid #0e0a02", display:"flex", gap:8, alignItems:"center", marginTop:"auto" }}>
                  <button onClick={() => toggleStatus(item)} disabled={!isAdmin}
                    style={{ flex:1, background:sc.bg, color:sc.text, border:`1px solid ${sc.border}`, borderRadius:6, padding:"6px 10px", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:12, cursor:isAdmin?"pointer":"default", letterSpacing:"0.05em", whiteSpace:"nowrap", opacity:isAdmin?1:0.85 }}>
                    {eff}{isAdmin && " ▾"}
                  </button>
                  <button onClick={() => toggleWeapon(item)} disabled={!isAdmin}
                    style={{ flex:1, background:wc.bg, color:wc.text, border:`1px solid ${wc.border}`, borderRadius:6, padding:"6px 10px", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:12, cursor:isAdmin?"pointer":"default", letterSpacing:"0.05em", whiteSpace:"nowrap", opacity:isAdmin?1:0.85 }}>
                    {item.weapon || "Fara Arma"}{isAdmin && " ▾"}
                  </button>
                  {isAdmin && (
                    <button onClick={() => remove(item.id)} title="Șterge" style={{ background:"transparent", border:"1px solid #2e1a3d", color:"#f87171", borderRadius:6, padding:"6px 10px", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:12, cursor:"pointer" }}>✕</button>
                  )}
                </div>
              </div>
                );
              })}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <div key={`empty-${cat.key}-${i}`}
                  onClick={() => { if (isAdmin) { setNewCategory(cat.key); setShowNew(true); } }}
                  style={{ minHeight:300, background:"#0e0e0e", border:"1px dashed #1f1f1f", borderRadius:12, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, color:"#2e2e2e", cursor:isAdmin?"pointer":"default", transition:"border-color 0.15s, color 0.15s" }}
                  onMouseEnter={e => { if(isAdmin){ e.currentTarget.style.borderColor="#241a06"; e.currentTarget.style.color="#555"; } }}
                  onMouseLeave={e => { if(isAdmin){ e.currentTarget.style.borderColor="#1f1f1f"; e.currentTarget.style.color="#2e2e2e"; } }}>
                  <span style={{ fontSize:28 }}>{isAdmin ? "+" : "·"}</span>
                  <span style={{ fontSize:10, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.15em", textTransform:"uppercase" }}>Spot Liber</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sistem Puncte Section ───────────────────────────────────────────────────
let _spId = 1;
const spId = () => String(_spId++);

const INITIAL_PUNCTE_MOBS = [
  { id: spId(), label: "Jaf Exchange / Biju / Rapire câștigate", value: "10 puncte" },
  { id: spId(), label: "Jaf Exchange / Biju / Rapire pierdute", value: "5 puncte" },
  { id: spId(), label: "Patrulă", value: "2 puncte" },
  { id: spId(), label: "Mineriada", value: "5 puncte" },
  { id: spId(), label: "Adus Hacking Device", value: "2 puncte" },
  { id: spId(), label: "Donații pentru Vendetta\`s (puncte în funcție de ce aduceți)", value: "" },
];
const INITIAL_AJUTOR = [
  { id: spId(), label: "100 meta livrat", value: "2 puncte + 25% din bani" },
  { id: spId(), label: "200 meta livrat", value: "4 puncte + 25% din bani" },
  { id: spId(), label: "Ținut la livrat om mare", value: "2 puncte" },
];
const INITIAL_REGULAMENT = [
  { id: spId(), label: "Ca să puteți fi eligibili pentru up, va trebui să adunați un total de 50 puncte + participare obligatorie la un jaf și la o mineriada!" },
  { id: spId(), label: "În caz că veți face dublul punctelor, veți primi double up." },
  { id: spId(), label: "În caz că veți face triplul punctelor, nu veți primi triple up, ci se va ține cont pentru săptămâna următoare!" },
  { id: spId(), label: "Ultimul grad, adică Half V, ca să-și mențină gradul, va trebui să adune un minim de 20 puncte pe săptămână!" },
  { id: spId(), label: "Half V vă pot da și ei puncte, adică vă pot pune la treabă!" },
  { id: spId(), label: "Ca să vă mențineți gradul pe care îl aveți, va trebui să adunați un minim de 25 puncte pe săptămână!" },
];
const INITIAL_HALF_V = [
  { id: spId(), label: "Toate licențele: HS, Pilot Heli (altele nu mă interesează)!" },
  { id: spId(), label: "Runflat pe minim 2 mașini: una pe LS, una pe Cayo!" },
  { id: spId(), label: "Minim 5.000.000 cash, în bancă sau împachetați!" },
  { id: spId(), label: "Să cunoști tot orașul!" },
  { id: spId(), label: "Să știi să conduci!" },
];

function PuncteRuleRow({ rule, isAdmin, hasValue, onEdit, onDelete }) {
  const labelStyle = { fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#a89cc8", flex: 1 };
  const valueStyle = {
    fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 14,
    color: "#c9a030", letterSpacing: "0.06em", whiteSpace: "nowrap", marginLeft: 16,
  };
  const rowStyle = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 12px", borderRadius: 7, background: "#100c1c", border: "1px solid #252525",
    gap: 8,
  };
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{rule.label}</span>
      {hasValue && rule.value && <span style={valueStyle}>{rule.value}</span>}
      {isAdmin && (
        <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
          <button onClick={() => onEdit(rule)} title="Editează"
            style={{ background: "transparent", border: "1px solid #241a06", color: "#c9a030", borderRadius: 5, padding: "2px 7px", fontSize: 11, cursor: "pointer", fontFamily: "'Barlow', sans-serif" }}>✎</button>
          <button onClick={() => onDelete(rule.id)} title="Șterge"
            style={{ background: "transparent", border: "1px solid #2e1a3d", color: "#f87171", borderRadius: 5, padding: "2px 7px", fontSize: 11, cursor: "pointer", fontFamily: "'Barlow', sans-serif" }}>✕</button>
        </div>
      )}
    </div>
  );
}

function PuncteHalfVRow({ rule, isAdmin, onEdit, onDelete }) {
  const labelStyle = { fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#a89cc8", flex: 1 };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ color: "#c9a030", fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>—</span>
      <span style={labelStyle}>{rule.label}</span>
      {isAdmin && (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={() => onEdit(rule)} title="Editează"
            style={{ background: "transparent", border: "1px solid #241a06", color: "#c9a030", borderRadius: 5, padding: "2px 7px", fontSize: 11, cursor: "pointer", fontFamily: "'Barlow', sans-serif" }}>✎</button>
          <button onClick={() => onDelete(rule.id)} title="Șterge"
            style={{ background: "transparent", border: "1px solid #2e1a3d", color: "#f87171", borderRadius: 5, padding: "2px 7px", fontSize: 11, cursor: "pointer", fontFamily: "'Barlow', sans-serif" }}>✕</button>
        </div>
      )}
    </div>
  );
}

function EditRuleModal({ rule, hasValue, onSave, onClose }) {
  const [label, setLabel] = useState(rule.label);
  const [value, setValue] = useState(rule.value);
  const inputStyle = {
    background: "#100c1c", border: "1px solid #2a2a2a", borderRadius: 6,
    color: "#e6def5", fontFamily: "'Barlow', sans-serif", fontSize: 13,
    padding: "7px 10px", outline: "none", width: "100%",
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 28, width: 420, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 16, color: "#c9a030", letterSpacing: "0.1em" }}>EDITEAZĂ REGULĂ</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase" }}>Descriere</label>
          <textarea value={label} onChange={e => setLabel(e.target.value)} rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
            onFocus={e => e.target.style.borderColor = "#c9a030"} onBlur={e => e.target.style.borderColor = "#1a1506"} />
        </div>
        {hasValue && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase" }}>Valoare (ex: 10 puncte)</label>
            <input value={value} onChange={e => setValue(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#c9a030"} onBlur={e => e.target.style.borderColor = "#1a1506"} />
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={() => onSave({ label, value })}
            style={{ flex: 1, background: "#c9a030", border: "none", borderRadius: 6, color: "#0e0a18", fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 14, padding: "8px", cursor: "pointer" }}>
            SALVEAZĂ
          </button>
          <button onClick={onClose}
            style={{ flex: 1, background: "transparent", border: "1px solid #333", borderRadius: 6, color: "#666", fontFamily: "'Barlow', sans-serif", fontSize: 13, padding: "8px", cursor: "pointer" }}>
            Anulează
          </button>
        </div>
      </div>
    </div>
  );
}

function AddRuleModal({ category, hasValue, maxOrder, onSave, onClose }) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const inputStyle = {
    background: "#100c1c", border: "1px solid #2a2a2a", borderRadius: 6,
    color: "#e6def5", fontFamily: "'Barlow', sans-serif", fontSize: 13,
    padding: "7px 10px", outline: "none", width: "100%",
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 28, width: 420, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 16, color: "#c9a030", letterSpacing: "0.1em" }}>ADAUGĂ REGULĂ</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase" }}>Descriere</label>
          <textarea value={label} onChange={e => setLabel(e.target.value)} rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
            onFocus={e => e.target.style.borderColor = "#c9a030"} onBlur={e => e.target.style.borderColor = "#1a1506"} />
        </div>
        {hasValue && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase" }}>Valoare (ex: 10 puncte)</label>
            <input value={value} onChange={e => setValue(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#c9a030"} onBlur={e => e.target.style.borderColor = "#1a1506"} />
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={() => label.trim() && onSave({ label: label.trim(), value: value.trim(), sort_order: maxOrder + 1 })}
            style={{ flex: 1, background: "#c9a030", border: "none", borderRadius: 6, color: "#0e0a18", fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 14, padding: "8px", cursor: "pointer" }}>
            ADAUGĂ
          </button>
          <button onClick={onClose}
            style={{ flex: 1, background: "transparent", border: "1px solid #333", borderRadius: 6, color: "#666", fontFamily: "'Barlow', sans-serif", fontSize: 13, padding: "8px", cursor: "pointer" }}>
            Anulează
          </button>
        </div>
      </div>
    </div>
  );
}

function SistemPuncteSection({ isAdmin }) {
  const [rules, setRules] = useState([]);
  const [spLoading, setSpLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [addingCategory, setAddingCategory] = useState(null);

  useEffect(() => {
    supabase.from("puncte_rules").select("*").order("sort_order").then(({ data }) => {
      setRules(data || []);
      setSpLoading(false);
    });
    const ch = supabase.channel("puncte_rules_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "puncte_rules" }, ({ eventType, new: n, old: o }) => {
        if (eventType === "INSERT") setRules(prev => [...prev, n].sort((a, b) => a.sort_order - b.sort_order));
        if (eventType === "UPDATE") setRules(prev => prev.map(r => r.id === n.id ? n : r));
        if (eventType === "DELETE") setRules(prev => prev.filter(r => r.id !== o.id));
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const catRules = (cat) => rules.filter(r => r.category === cat);

  const saveEdit = async ({ label, value }) => {
    await supabase.from("puncte_rules").update({ label, value: value || "" }).eq("id", editingRule.id);
    logAction("Editat regulă puncte", `${label}: ${value || ""}`);
    setEditingRule(null);
  };

  const deleteRule = async (id) => {
    const r = rules.find(x => x.id === id);
    await supabase.from("puncte_rules").delete().eq("id", id);
    logAction("Șters regulă puncte", r?.label || id);
  };

  const addRule = async ({ label, value }) => {
    const cat = addingCategory.key;
    const maxOrder = catRules(cat).reduce((m, r) => Math.max(m, r.sort_order || 0), 0);
    await supabase.from("puncte_rules").insert({ category: cat, label, value: value || "", sort_order: maxOrder + 1 });
    logAction("Adăugat regulă puncte", `[${cat}] ${label}: ${value || ""}`);
    setAddingCategory(null);
  };

  const mobRows = catRules("puncte_mobs");
  const ajutorRows = catRules("ajutor_vendettas");
  const regRows = catRules("regulament");
  const halfVRows = catRules("half_v_reguli");

  const cardStyle = {
    background: "#121212", border: "1px solid #222", borderRadius: 14,
    padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14,
  };
  const headingStyle = {
    fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: 15, color: "#c9a030",
    letterSpacing: "0.15em", textTransform: "uppercase",
    borderBottom: "1px solid #1e1e1e", paddingBottom: 12,
    display: "flex", alignItems: "center", justifyContent: "space-between",
  };
  const addBtnStyle = {
    background: "transparent", border: "1px dashed #252525", borderRadius: 7,
    color: "#444", fontFamily: "'Barlow', sans-serif", fontSize: 11, padding: "6px 10px",
    cursor: "pointer", letterSpacing: "0.05em", transition: "border-color 0.15s, color 0.15s",
  };

  const MobRow = ({ rule, cat }) => {
    const hasVal = cat === "puncte_mobs" || cat === "ajutor_vendettas";
    return (
      <div className="ev-p-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
        <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#a89cc8", flex: 1, lineHeight: 1.4 }}>{rule.label}</span>
        {hasVal && rule.value && (
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 14, color: "#c9a030", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{rule.value}</span>
        )}
        {isAdmin && (
          <div style={{ display: "flex", gap: 3, flexShrink: 0, marginLeft: 4 }}>
            <button onClick={() => setEditingRule({ ...rule, category: cat })} title="Editează"
              style={{ background: "transparent", border: "1px solid #241a06", color: "#c9a030", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>✎</button>
            <button onClick={() => deleteRule(rule.id)} title="Șterge"
              style={{ background: "transparent", border: "1px solid #2e1a3d", color: "#f87171", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>✕</button>
          </div>
        )}
      </div>
    );
  };

  const RegRow = ({ rule }) => (
    <div className="ev-reg-row" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 4px", borderBottom: "1px solid #181818", borderRadius:4 }}>
      <span style={{ color: "#c9a030", fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 16, lineHeight: 1.3, flexShrink: 0 }}>•</span>
      <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#8a7fa8", flex: 1, lineHeight: 1.55 }}>{rule.label}</span>
      {isAdmin && (
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          <button onClick={() => setEditingRule({ ...rule, category: "regulament" })} title="Editează"
            style={{ background: "transparent", border: "1px solid #241a06", color: "#c9a030", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>✎</button>
          <button onClick={() => deleteRule(rule.id)} title="Șterge"
            style={{ background: "transparent", border: "1px solid #2e1a3d", color: "#f87171", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>✕</button>
        </div>
      )}
    </div>
  );

  const HalfVRow = ({ rule }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ color: "#c9a030", fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 13, lineHeight: 1.5, flexShrink: 0 }}>—</span>
      <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#8a7fa8", flex: 1, lineHeight: 1.5 }}>{rule.label}</span>
      {isAdmin && (
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          <button onClick={() => setEditingRule({ ...rule, category: "half_v_reguli" })} title="Editează"
            style={{ background: "transparent", border: "1px solid #241a06", color: "#c9a030", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>✎</button>
          <button onClick={() => deleteRule(rule.id)} title="Șterge"
            style={{ background: "transparent", border: "1px solid #2e1a3d", color: "#f87171", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>✕</button>
        </div>
      )}
    </div>
  );

  const editingCatHasValue = editingRule && (editingRule.category === "puncte_mobs" || editingRule.category === "ajutor_vendettas");

  return (
    <div style={{ padding: "20px 24px" }}>
      {editingRule && (
        <EditRuleModal
          rule={editingRule}
          hasValue={editingCatHasValue}
          onSave={saveEdit}
          onClose={() => setEditingRule(null)}
        />
      )}
      {addingCategory && (
        <AddRuleModal
          category={addingCategory.key}
          hasValue={addingCategory.hasValue}
          maxOrder={0}
          onSave={addRule}
          onClose={() => setAddingCategory(null)}
        />
      )}

      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: 24, color: "#e6def5", letterSpacing: "0.1em" }}>SISTEM PUNCTE</h2>
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: "#444", marginTop: 2, letterSpacing: "0.04em" }}>Regulamentul intern al facțiunii</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>

        {/* PUNCTE SICARIOS */}
        <div style={cardStyle}>
          <div style={headingStyle}>
            <span>PUNCTE SICARIOS</span>
            {isAdmin && <button className="ev-add-dashed" style={addBtnStyle} onClick={() => setAddingCategory({ key: "puncte_mobs", hasValue: true })}>+ Adaugă</button>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {mobRows.map(r => <MobRow key={r.id} rule={r} cat="puncte_mobs" />)}
          </div>
        </div>

        {/* AJUTOR ALDRICK FAMILY */}
        <div style={cardStyle}>
          <div style={headingStyle}>
            <span>AJUTOR ALDRICK FAMILY</span>
            {isAdmin && <button className="ev-add-dashed" style={addBtnStyle} onClick={() => setAddingCategory({ key: "ajutor_vendettas", hasValue: true })}>+ Adaugă</button>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ajutorRows.map(r => <MobRow key={r.id} rule={r} cat="ajutor_vendettas" />)}
          </div>
        </div>

        {/* REGULAMENT */}
        <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
          <div style={headingStyle}>
            <span>REGULAMENT SISTEM PUNCTE</span>
            {isAdmin && <button className="ev-add-dashed" style={addBtnStyle} onClick={() => setAddingCategory({ key: "regulament", hasValue: false })}>+ Adaugă paragraf</button>}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {regRows.map(r => <RegRow key={r.id} rule={r} />)}
          </div>

          {/* CERINTE HALF V sub-section */}
          <div style={{ marginTop: 8, background: "#0a0a0a", border: "1px solid #241a06", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 13, color: "#c9a030", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Cerințe Half V
              </div>
              {isAdmin && <button className="ev-add-dashed" style={addBtnStyle} onClick={() => setAddingCategory({ key: "half_v_reguli", hasValue: false })}>+ Adaugă</button>}
            </div>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: "#555", margin: 0 }}>Trecerea de la Old Mob la Half V vine cu un anumit set de reguli:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {halfVRows.map(r => <HalfVRow key={r.id} rule={r} />)}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Admin Panel Section ──────────────────────────────────────────────────────
function AdminPanelSection({ role, currentUser }) {
  const isGA = role === "general_admin";
  const [accountList, setAccountList] = useState([]);
  const [logs, setLogs] = useState([]);
  const [addNickname, setAddNickname] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState("member");
  const [a2Password, setA2Password] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addOk, setAddOk] = useState("");
  const [logLoading, setLogLoading] = useState(true);
  const [panelTab, setPanelTab] = useState("conturi");
  const [gaNewNickname, setGaNewNickname] = useState(currentUser?.nickname || "");
  const [gaNickSaving, setGaNickSaving] = useState(false);
  const [gaNickMsg, setGaNickMsg] = useState("");
  const [resetId, setResetId] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  const fetchAccounts = () => {
    if (!isGA) return;
    supabase.rpc("list_accounts").then(({ data }) => setAccountList(data || []));
  };

  useEffect(() => {
    fetchAccounts();
    if (isGA) {
      // General Admin: authenticated JWT can read admin_logs directly + realtime.
      supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(200)
        .then(({ data, error }) => {
          if (error) console.error("[AdminPanel] logs fetch error:", error.message);
          setLogs(data || []);
          setLogLoading(false);
        });
      const ch1 = supabase.channel("admin_logs_panel_rt")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_logs" }, payload => {
          setLogs(prev => [payload.new, ...prev].slice(0, 200));
        }).subscribe();
      return () => { supabase.removeChannel(ch1); };
    }
    // Admin 2 (no JWT): reads are server-enforced via a token-validated RPC.
    // Realtime isn't available for anon reads, so poll periodically instead.
    const loadLogs = () => {
      if (!_accountToken) { setLogLoading(false); return; }
      supabase.rpc("sess_list_logs", { p_token: _accountToken })
        .then(({ data, error }) => {
          if (error) console.error("[AdminPanel] logs fetch error:", error.message);
          setLogs(data || []);
          setLogLoading(false);
        });
    };
    loadLogs();
    const poll = setInterval(loadLogs, 15000);
    return () => clearInterval(poll);
  }, [isGA]);

  const addAccount = async () => {
    if (!addNickname.trim() || !addPassword.trim()) { setAddError("Completează nickname-ul și parola."); return; }
    setAddLoading(true); setAddError(""); setAddOk("");
    let error;
    if (isGA) {
      ({ error } = await supabase.rpc("create_account", { p_nickname: addNickname.trim(), p_password: addPassword.trim(), p_role: addRole }));
    } else {
      // Admin 2 has no JWT; must re-verify with own password to create a Member.
      if (!a2Password.trim()) { setAddError("Introdu parola ta de Admin 2 pentru confirmare."); setAddLoading(false); return; }
      ({ error } = await supabase.rpc("admin2_create_member", { p_admin_nickname: currentUser?.nickname, p_admin_password: a2Password.trim(), p_new_nickname: addNickname.trim(), p_new_password: addPassword.trim() }));
    }
    if (error) {
      setAddError(error.message?.includes("duplicate") || error.code === "23505" ? "Acest nickname există deja." : (error.message?.includes("Access denied") ? "Parola de Admin 2 este incorectă." : "Eroare: " + error.message));
    } else {
      const created = isGA ? addRole : "member";
      logAction(`Adăugat cont ${created === "admin2" ? "Admin 2" : "Membru"}`, addNickname.trim());
      setAddOk(`Cont ${created === "admin2" ? "Admin 2" : "Membru"} creat.`);
      setAddNickname(""); setAddPassword(""); setA2Password("");
      fetchAccounts();
      setTimeout(() => setAddOk(""), 2500);
    }
    setAddLoading(false);
  };

  const removeAccount = async (entry) => {
    await supabase.rpc("delete_account", { p_id: entry.id });
    logAction(`Eliminat cont ${entry.role === "admin2" ? "Admin 2" : "Membru"}`, entry.nickname);
    fetchAccounts();
  };

  const openReset = (entry) => {
    setResetId(entry.id); setResetPassword(""); setResetMsg("");
  };

  const cancelReset = () => {
    setResetId(null); setResetPassword(""); setResetMsg("");
  };

  const submitReset = async (entry) => {
    if (!resetPassword.trim()) { setResetMsg("Introdu parola nouă."); return; }
    setResetLoading(true); setResetMsg("");
    const { error } = await supabase.rpc("reset_account_password", { p_id: entry.id, p_new_password: resetPassword.trim() });
    if (error) {
      setResetMsg(error.message?.includes("Access denied") ? "Acces refuzat." : "Eroare: " + error.message);
    } else {
      logAction(`Resetat parola cont ${entry.role === "admin2" ? "Admin 2" : "Membru"}`, entry.nickname);
      cancelReset();
    }
    setResetLoading(false);
  };

  const saveGaNickname = async () => {
    if (!gaNewNickname.trim()) return;
    setGaNickSaving(true); setGaNickMsg("");
    const { error } = await supabase.from("user_roles").update({ nickname: gaNewNickname.trim() }).eq("email", currentUser?.email);
    if (error) { setGaNickMsg("Eroare: " + error.message); }
    else {
      _actorDisplayName = gaNewNickname.trim();
      logAction("Actualizat nickname GA", gaNewNickname.trim());
      setGaNickMsg("Salvat!");
      setTimeout(() => setGaNickMsg(""), 2500);
    }
    setGaNickSaving(false);
  };

  const tabBtn = (label, key) => (
    <button key={key} onClick={() => setPanelTab(key)} style={{ background:"transparent", border:"none", borderBottom: panelTab===key?"2px solid #c9a030":"2px solid transparent", color: panelTab===key?"#e6def5":"#555", fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:13, padding:"0 18px", height:42, cursor:"pointer", letterSpacing:"0.04em", whiteSpace:"nowrap" }}>
      {label}
    </button>
  );

  const inp = { background:"#050305", border:"1px solid #1a1506", borderRadius:6, color:"#e6def5", fontFamily:"'Barlow', sans-serif", fontSize:13, padding:"8px 12px", outline:"none", width:"100%" };
  const canSubmit = addNickname.trim() && addPassword.trim() && (isGA || a2Password.trim());

  return (
    <div style={{ padding:"24px", maxWidth:900, margin:"0 auto", display:"flex", flexDirection:"column", gap:24 }}>
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        <div className="ev-gold-text" style={{ fontFamily:"'Cinzel', serif", fontWeight:700, fontSize:20, letterSpacing:"0.12em" }}>PANEL {isGA ? "ADMIN" : "ADMIN 2"}</div>
        <div style={{ color:"#352808", fontSize:12, fontFamily:"'Barlow', sans-serif" }}>
          Conectat ca: <span style={{ color:"#c9a030" }}>{currentUser?.nickname || currentUser?.email}</span>
        </div>
      </div>

      <div style={{ display:"flex", borderBottom:"1px solid #1c1728" }}>
        {tabBtn("CONTURI", "conturi")}
        {tabBtn("JURNALE ACȚIUNI", "jurnale")}
        {isGA && tabBtn("SETĂRI CONT", "setari")}
      </div>

      {panelTab === "conturi" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ background:"#0b0715", border:"1px solid #0e0a02", borderRadius:10, padding:"18px 20px", display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:14, color:"#c9a030", letterSpacing:"0.08em" }}>{isGA ? "ADAUGĂ CONT" : "ADAUGĂ CONT MEMBRU"}</div>
            {isGA && (
              <div style={{ display:"flex", gap:8 }}>
                <select value={addRole} onChange={e => setAddRole(e.target.value)} style={{ ...inp, cursor:"pointer" }}>
                  <option value="member">Membru</option>
                  <option value="admin2">Admin 2</option>
                </select>
              </div>
            )}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <input value={addNickname} onChange={e => setAddNickname(e.target.value)} placeholder="Nickname (nou cont)"
                style={{ ...inp, flex:1, minWidth:140 }} onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor="#1a1506"} />
              <input type="password" value={addPassword} onChange={e => setAddPassword(e.target.value)} onKeyDown={e => e.key==="Enter" && addAccount()} placeholder="Parolă (nou cont)"
                style={{ ...inp, flex:1, minWidth:140 }} onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor="#1a1506"} />
            </div>
            {!isGA && (
              <input type="password" value={a2Password} onChange={e => setA2Password(e.target.value)} onKeyDown={e => e.key==="Enter" && addAccount()} placeholder="Parola ta de Admin 2 (confirmare)"
                style={inp} onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor="#1a1506"} />
            )}
            <button onClick={addAccount} disabled={addLoading || !canSubmit}
              style={{ alignSelf:"flex-start", background:canSubmit?"#c9a030":"#1c1728", border:"none", borderRadius:6, color:canSubmit?"#0e0a18":"#444", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:13, padding:"8px 24px", cursor:canSubmit?"pointer":"default", whiteSpace:"nowrap" }}>
              {addLoading ? "..." : "+ ADAUGĂ CONT"}
            </button>
            {addError && <div style={{ color:"#f87171", fontFamily:"'Barlow', sans-serif", fontSize:12 }}>{addError}</div>}
            {addOk && <div style={{ color:"#4ade80", fontFamily:"'Barlow', sans-serif", fontSize:12 }}>{addOk}</div>}
          </div>

          {isGA && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ color:"#352808", fontSize:10, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.12em", textTransform:"uppercase" }}>
              CONTURI ACTIVE ({accountList.length})
            </div>
            {accountList.length === 0 ? (
              <div style={{ background:"#0b0715", border:"1px dashed #1d1528", borderRadius:8, padding:"28px", textAlign:"center", color:"#251a06", fontFamily:"'Barlow', sans-serif", fontSize:13 }}>
                Niciun cont adăugat încă.
              </div>
            ) : accountList.map(entry => (
              <div key={entry.id} className="ev-list-row" style={{ background:"#0b0715", border:"1px solid #1c1728", borderRadius:8, padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                    <span style={{ fontFamily:"'Barlow', sans-serif", fontSize:14, color:"#e6def5" }}>{entry.nickname}</span>
                    <span style={{ fontFamily:"'Barlow', sans-serif", fontSize:11, color:entry.role==="admin2"?"#60a5fa":"#a3e635" }}>{entry.role==="admin2"?"Admin 2":"Membru"} · Adăugat {new Date(entry.created_at).toLocaleDateString("ro-RO")}</span>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => resetId === entry.id ? cancelReset() : openReset(entry)}
                      style={{ background:"transparent", border:"1px solid #251a3d", borderRadius:6, color:"#c9a030", fontFamily:"'Barlow', sans-serif", fontSize:12, padding:"5px 14px", cursor:"pointer" }}>
                      {resetId === entry.id ? "Anulează" : "Resetează parola"}
                    </button>
                    <button onClick={() => removeAccount(entry)}
                      style={{ background:"transparent", border:"1px solid #2e1a3d", borderRadius:6, color:"#f87171", fontFamily:"'Barlow', sans-serif", fontSize:12, padding:"5px 14px", cursor:"pointer" }}>
                      Elimină
                    </button>
                  </div>
                </div>
                {resetId === entry.id && (
                  <div style={{ display:"flex", flexDirection:"column", gap:8, borderTop:"1px solid #0e0a02", paddingTop:10 }}>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      <input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} onKeyDown={e => e.key==="Enter" && submitReset(entry)} placeholder="Parolă nouă"
                        style={{ ...inp, flex:1, minWidth:140 }} onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor="#1a1506"} autoFocus />
                      <button onClick={() => submitReset(entry)} disabled={resetLoading || !resetPassword.trim()}
                        style={{ background:resetPassword.trim()?"#c9a030":"#1c1728", border:"none", borderRadius:6, color:resetPassword.trim()?"#0e0a18":"#444", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:13, padding:"8px 20px", cursor:resetPassword.trim()?"pointer":"default", whiteSpace:"nowrap" }}>
                        {resetLoading ? "..." : "SALVEAZĂ"}
                      </button>
                    </div>
                    {resetMsg && <div style={{ color:"#f87171", fontFamily:"'Barlow', sans-serif", fontSize:12 }}>{resetMsg}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {panelTab === "jurnale" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ color:"#352808", fontSize:10, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.12em", textTransform:"uppercase" }}>
            ULTIMELE {logs.length} ACȚIUNI
          </div>
          {logLoading ? (
            <div style={{ color:"#2a1f06", fontFamily:"'Barlow', sans-serif", fontSize:13, padding:"32px", textAlign:"center" }}>Se încarcă...</div>
          ) : logs.length === 0 ? (
            <div style={{ background:"#0b0715", border:"1px dashed #1d1528", borderRadius:8, padding:"28px", textAlign:"center", color:"#251a06", fontFamily:"'Barlow', sans-serif", fontSize:13 }}>Nicio acțiune înregistrată.</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {logs.map(log => (
                <div key={log.id} className="ev-list-row" style={{ background:"#0b0715", border:"1px solid #1c1728", borderRadius:7, padding:"10px 14px", display:"flex", gap:12, alignItems:"flex-start", flexWrap:"wrap" }}>
                  <div style={{ flexShrink:0, minWidth:130, color:"#241a06", fontFamily:"'Barlow', sans-serif", fontSize:11 }}>
                    {new Date(log.created_at).toLocaleDateString("ro-RO")} {new Date(log.created_at).toLocaleTimeString("ro-RO", { hour:"2-digit", minute:"2-digit" })}
                  </div>
                  <div style={{ flexShrink:0, minWidth:160, display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:8.5, fontFamily:"'Barlow', sans-serif", fontWeight:700, letterSpacing:"0.06em", padding:"1px 6px", borderRadius:4, textTransform:"uppercase", color: log.kind==="visit"?"#8a6c1e":"#60a5fa", background: log.kind==="visit"?"rgba(91,63,160,0.12)":"rgba(96,165,250,0.1)", border:`1px solid ${log.kind==="visit"?"#251a3d":"#1e2a3a"}` }}>{log.kind==="visit"?"Vizită":"Admin"}</span>
                    <span style={{ color:"#5a4210", fontFamily:"'Barlow', sans-serif", fontSize:11 }}>{log.actor_email}</span>
                  </div>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", gap:2, minWidth:180 }}>
                    <span style={{ fontFamily:"'Barlow', sans-serif", fontWeight:600, fontSize:12, color:"#e6def5" }}>{log.action}</span>
                    {log.details && <span style={{ fontFamily:"'Barlow', sans-serif", fontSize:11, color:"#352808" }}>{log.details}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {panelTab === "setari" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ background:"#0b0715", border:"1px solid #0e0a02", borderRadius:10, padding:"18px 20px", display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:14, color:"#c9a030", letterSpacing:"0.08em" }}>NICKNAME AFIȘAT ÎN JURNALE</div>
            <div style={{ color:"#352808", fontFamily:"'Barlow', sans-serif", fontSize:12 }}>
              Setează nickname-ul care va apărea în jurnalele de acțiuni în locul email-ului.
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <input value={gaNewNickname} onChange={e => setGaNewNickname(e.target.value)} onKeyDown={e => e.key==="Enter" && saveGaNickname()} placeholder="Nickname"
                style={inp} onFocus={e => e.target.style.borderColor="#c9a030"} onBlur={e => e.target.style.borderColor="#1a1506"} />
              <button onClick={saveGaNickname} disabled={gaNickSaving || !gaNewNickname.trim()}
                style={{ background:gaNewNickname.trim()?"#c9a030":"#1c1728", border:"none", borderRadius:6, color:gaNewNickname.trim()?"#0e0a18":"#444", fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:13, padding:"8px 20px", cursor:gaNewNickname.trim()?"pointer":"default", whiteSpace:"nowrap" }}>
                {gaNickSaving ? "..." : "SALVEAZĂ"}
              </button>
            </div>
            {gaNickMsg && <div style={{ color: gaNickMsg.startsWith("Eroare") ? "#f87171" : "#4ade80", fontFamily:"'Barlow', sans-serif", fontSize:12 }}>{gaNickMsg}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
const TABS = ["Membri", "Heists", "Informații Zone", "Aprobări Zonă", "Sistem Puncte"];
const ALL_TABS = [...TABS, "Panel Admin"];

export default function App() {
  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem("ev_tab");
    return ALL_TABS.includes(saved) ? saved : "Membri";
  });
  const [visited, setVisited] = useState(() => {
    const saved = localStorage.getItem("ev_tab");
    const initial = ALL_TABS.includes(saved) ? saved : "Membri";
    return new Set(["Membri", initial]);
  });
  const [userRole, setUserRole] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loading, setLoading] = useState(true);

  const isGeneralAdmin = userRole === "general_admin";
  const isAdmin2 = userRole === "admin2";
  const isVisitor = userRole === "visitor";
  const isAccount = userRole === "general_admin" || userRole === "admin2" || userRole === "member";
  const navTabs = isGeneralAdmin ? [...TABS, "Panel Admin"] : isAdmin2 ? [...TABS, "Panel Admin"] : ["Membri"];

  const switchTab = (t) => {
    setTab(t);
    localStorage.setItem("ev_tab", t);
    setVisited(prev => prev.has(t) ? prev : new Set([...prev, t]));
  };

  const fetchUserRole = async (user) => {
    if (!user) { setUserRole(null); setCurrentUser(null); _actorDisplayName = ""; return; }
    const emailLower = user.email.toLowerCase().trim();
    const { data, error } = await supabase
      .from("user_roles")
      .select("role, nickname")
      .ilike("email", emailLower)
      .maybeSingle();
    if (error) console.error("[fetchUserRole] error:", error.message, "| email:", emailLower);
    const displayName = data?.nickname || emailLower;
    _actorDisplayName = displayName;
    setCurrentUser({ id: user.id, email: user.email, nickname: data?.nickname || null });
    setUserRole(data?.role || null);
  };

  useEffect(() => {
    const initAuth = async () => {
      // 1) Nickname/password account (Admin 2 or Member)
      const accRaw = localStorage.getItem("ev_account_session");
      if (accRaw) {
        try {
          const parsed = JSON.parse(accRaw);
          if (parsed?.nickname && parsed?.role && parsed?.token) {
            _actorDisplayName = parsed.nickname;
            _accountToken = parsed.token;
            _accountRole = parsed.role;
            setUserRole(parsed.role);
            setCurrentUser({ nickname: parsed.nickname });
            setLoading(false);
            return;
          }
          // Legacy session without a token — force re-login to mint one.
          localStorage.removeItem("ev_account_session");
        } catch { localStorage.removeItem("ev_account_session"); }
      }
      // 2) General Admin (Supabase Auth session)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUserRole(session.user);
        setLoading(false);
        return;
      }
      // 3) Returning visitor
      const visRaw = localStorage.getItem("ev_visitor");
      if (visRaw) {
        try {
          const parsed = JSON.parse(visRaw);
          if (parsed?.nickname) {
            _actorDisplayName = parsed.nickname;
            setUserRole("visitor");
            setCurrentUser({ nickname: parsed.nickname });
            setLoading(false);
            return;
          }
        } catch { localStorage.removeItem("ev_visitor"); }
      }
      setLoading(false);
    };
    initAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Never let GA auth events overwrite an active admin2/member session
      if (localStorage.getItem("ev_account_session")) return;
      if (session?.user) {
        fetchUserRole(session.user);
      } else if (event === "SIGNED_OUT") {
        setUserRole(null);
        setCurrentUser(null);
        _actorDisplayName = "";
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !navTabs.includes(tab)) {
      setTab("Membri");
      localStorage.setItem("ev_tab", "Membri");
    }
  }, [loading, userRole, tab]);

  const login = async (email, password) => {
    const { data: { session }, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && session?.user) {
      await fetchUserRole(session.user);
      setShowLogin(false);
    }
    return error;
  };

  const loginAccount = async (nickname, password) => {
    // Server-issued session token: verifies credentials and mints a short-lived token.
    const { data, error } = await supabase.rpc("login_account", { p_nickname: nickname, p_password: password });
    const session = Array.isArray(data) ? data[0] : data;
    if (error || !session?.token || !session?.role) return { message: "Nickname sau parolă incorectă." };
    const { role, token } = session;
    localStorage.setItem("ev_account_session", JSON.stringify({ nickname, role, token }));
    localStorage.removeItem("ev_visitor");
    _actorDisplayName = nickname;
    _accountToken = token;
    _accountRole = role;
    setUserRole(role);
    setCurrentUser({ nickname });
    setShowLogin(false);
    logAction("Autentificat", `${nickname} (${role})`);
    return null;
  };

  const enterAsVisitor = (nickname) => {
    const n = (nickname || "").trim() || "vizitator";
    localStorage.setItem("ev_visitor", JSON.stringify({ nickname: n }));
    _actorDisplayName = n;
    setUserRole("visitor");
    setCurrentUser({ nickname: n });
    logVisit(n);
  };

  const logout = async () => {
    logAction("Deconectat", currentUser?.nickname || currentUser?.email || "");
    if (_accountToken) await supabase.rpc("logout_account", { p_token: _accountToken });
    localStorage.removeItem("ev_account_session");
    localStorage.removeItem("ev_visitor");
    _actorDisplayName = "";
    _accountToken = null;
    _accountRole = null;
    await supabase.auth.signOut();
    setUserRole(null);
    setCurrentUser(null);
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#050305", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:18 }}>
      <img src={logoUrl} alt="Aldrick Enterprises" style={{ width:110, height:110, objectFit:"contain", opacity:0.9, filter:"drop-shadow(0 0 24px rgba(180,140,30,0.25))" }} />
      <div className="ev-gold-text" style={{ fontFamily:"'Cinzel', serif", fontWeight:700, fontSize:16, letterSpacing:"0.18em" }}>ALDRICK ENTERPRISES</div>
      <div style={{ color:"#a07820", fontFamily:"'Rajdhani', sans-serif", fontSize:12, letterSpacing:"0.28em", opacity:0.6 }}>SE ÎNCARCĂ...</div>
    </div>
  );

  if (!userRole) return (
    <>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={login} onLoginAccount={loginAccount} />}
      <EntryGate onEnter={enterAsVisitor} onOpenLogin={() => setShowLogin(true)} />
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800;900&family=Rajdhani:wght@500;600;700;800&family=Barlow:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #050305; }

        /* ── Light vignette ── */
        .ev-vignette {
          position: fixed; inset: 0; z-index: 9999; pointer-events: none;
          background: radial-gradient(ellipse at 50% 50%,
            transparent 62%, rgba(0,0,0,0.14) 82%, rgba(0,0,0,0.34) 100%);
        }

        /* ── Film grain (visible) ── */
        .ev-noise {
          position: fixed; inset: 0; z-index: 9997; pointer-events: none; opacity: 0.055;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat; background-size: 180px 180px;
        }

        /* ── Top accent bar — violet glow ── */
        .ev-top-accent {
          height: 2px; flex-shrink: 0; position: relative; z-index: 101;
          background: linear-gradient(90deg,
            transparent 0%, rgba(180,140,30,0.9) 20%,
            rgba(212,168,48,1) 50%,
            rgba(180,140,30,0.9) 80%, transparent 100%
          );
          box-shadow: 0 0 10px rgba(201,160,48,0.4), 0 0 28px rgba(201,160,48,0.15), 0 0 6px rgba(212,168,48,0.3);
        }

        /* ── Gold shimmer ── */
        @keyframes ev-shimmer-sweep {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .ev-brand-title, .ev-gold-text {
          color: #c9a030;
          background: linear-gradient(90deg,
            #7a5210 0%, #c9a030 18%, #f0d878 42%, #fff8dc 50%, #f0d878 58%, #c9a030 82%, #7a5210 100%
          );
          background-size: 240% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: ev-shimmer-sweep 5s linear infinite;
        }

        /* ── Entry gate ornate frame ── */
        .ev-entry-frame {
          position: relative;
          width: 340px;
          max-width: 100%;
          padding: 38px 32px 32px;
          background: rgba(6,4,1,0.84);
          border: 1px solid rgba(201,160,48,0.18);
        }
        .ev-entry-frame::before {
          content: '';
          position: absolute;
          inset: -44px;
          background: url('/frame.png') no-repeat center center / contain;
          opacity: 0.48;
          pointer-events: none;
          z-index: 0;
        }
        .ev-entry-frame > * { position: relative; z-index: 1; }

        /* ── Login modal ornate frame ── */
        .ev-modal-frame {
          position: relative;
          width: 340px;
          max-width: calc(100vw - 32px);
          padding: 28px 28px 24px;
          background: rgba(6,4,1,0.92);
          border: 1px solid rgba(201,160,48,0.18);
          display: flex; flex-direction: column; gap: 14px;
        }
        .ev-modal-frame::before {
          content: '';
          position: absolute;
          inset: -44px;
          background: url('/frame.png') no-repeat center center / contain;
          opacity: 0.44;
          pointer-events: none;
          z-index: 0;
        }
        .ev-modal-frame > * { position: relative; z-index: 1; }

        /* ── Nav bar ── */
        .ev-nav-glow {
          box-shadow: 0 6px 50px rgba(0,0,0,0.9) !important;
          border-bottom: none !important;
          position: relative;
        }
        .ev-nav-glow::after {
          content: '';
          position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg,
            transparent 0%, rgba(170,130,28,0.6) 15%,
            rgba(212,168,48,0.45) 40%, rgba(212,168,48,0.45) 60%,
            rgba(170,130,28,0.6) 85%, transparent 100%
          );
        }

        /* ── Tab reshape ── */
        .ev-tab {
          position: relative !important;
          letter-spacing: 0.07em !important;
          font-size: 11.5px !important;
          padding: 0 18px !important;
          border-top: 2px solid transparent !important;
          border-bottom: 2px solid transparent !important;
          transition: all 0.18s !important;
        }
        .ev-tab-active {
          color: #f0d878 !important;
          text-shadow: 0 0 18px rgba(212,168,48,0.6) !important;
          background: linear-gradient(180deg, rgba(180,140,30,0.18) 0%, rgba(120,80,15,0.06) 100%) !important;
          border-top: 2px solid rgba(201,160,48,0.55) !important;
          border-bottom: 2px solid #c9a030 !important;
        }
        .ev-tab:not(.ev-tab-active):hover {
          color: #aaa !important;
          background: rgba(160,110,20,0.07) !important;
        }
        .ev-nav-tabs::-webkit-scrollbar { display: none; }

        /* ── Brand emblem block ── */
        .ev-brand-block {
          position: relative;
          display: flex; align-items: center; gap: 10px;
          padding: 0 18px 0 0;
          margin-right: 8px;
          flex-shrink: 0;
        }
        .ev-brand-block::after {
          content: '';
          position: absolute; right: 0; top: 20%; bottom: 20%;
          width: 1px;
          background: linear-gradient(180deg, transparent, rgba(201,160,48,0.7) 40%, rgba(201,160,48,0.7) 60%, transparent);
        }

        /* ── Button reshape ── */
        .ev-btn-gold {
          border-radius: 2px !important;
          border-left: 2px solid rgba(212,168,48,0.6) !important;
          letter-spacing: 0.09em !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
        }
        .ev-btn-gold:hover {
          background: #c9a030 !important;
          box-shadow: 0 0 18px rgba(212,168,48,0.35), -2px 0 10px rgba(212,168,48,0.2) !important;
        }
        .ev-add-dashed { border-radius: 2px !important; }
        .ev-cycle { border-radius: 3px !important; }
        .ev-license { border-radius: 3px !important; font-size: 10px !important; letter-spacing: 0.06em !important; }

        /* ── Nav right-side user badge ── */
        .ev-user-badge {
          background: rgba(16,12,4,0.8);
          border: 1px solid rgba(160,110,20,0.4);
          border-left: 2px solid rgba(201,160,48,0.7);
          border-radius: 2px;
          padding: 4px 10px;
          display: flex; flex-direction: column; align-items: flex-end; gap: 1px;
        }
        .ev-logout-btn {
          background: transparent !important;
          border: 1px solid rgba(140,100,20,0.5) !important;
          border-radius: 2px !important;
          color: #5a4210 !important;
          font-family: 'Barlow', sans-serif !important;
          font-size: 10px !important;
          letter-spacing: 0.08em !important;
          padding: 4px 10px !important;
          cursor: pointer !important;
          text-transform: uppercase !important;
          transition: all 0.15s !important;
        }
        .ev-logout-btn:hover {
          border-color: rgba(201,160,48,0.7) !important;
          color: #c04040 !important;
          background: rgba(160,110,20,0.1) !important;
        }
        .ev-login-btn {
          background: rgba(14,10,3,0.9) !important;
          border: 1px solid rgba(160,110,20,0.5) !important;
          border-left: 2px solid rgba(201,160,48,0.8) !important;
          border-radius: 2px !important;
          color: #6a5218 !important;
          font-family: 'Rajdhani', sans-serif !important;
          font-weight: 700 !important;
          font-size: 12px !important;
          letter-spacing: 0.14em !important;
          padding: 6px 14px !important;
          cursor: pointer !important;
          text-transform: uppercase !important;
          transition: all 0.18s !important;
        }
        .ev-login-btn:hover {
          border-color: rgba(201,160,48,0.9) !important;
          border-left-color: #c9a030 !important;
          color: #c9a030 !important;
          background: rgba(160,110,20,0.15) !important;
          box-shadow: 0 0 16px rgba(201,160,48,0.2) !important;
        }

        /* ── Scrollbar — blood red ── */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #050305; }
        ::-webkit-scrollbar-thumb { background: rgba(180,140,30,0.35); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(201,160,48,0.55); }

        /* ── Footer ── */
        .ev-footer {
          text-align: center; padding: 10px 16px;
          font-family: 'Barlow', sans-serif; font-size: 11px;
          letter-spacing: 0.08em; color: #5a4210;
          border-top: 1px solid rgba(201,160,48,0.15);
          background: rgba(0,0,0,0.65); flex-shrink: 0; user-select: none;
          position: relative; z-index: 1;
        }
        .ev-footer span { color: #4a3210; }
        .ev-footer .ev-footer-dot { color: #c9a030; opacity: 0.55; margin: 0 5px; }
        .ev-footer .ev-footer-gold { color: #8a6218; letter-spacing: 0.06em; }

        /* ── Selection ── */
        ::selection { background: rgba(180,140,30,0.3); color: #f0d878; }

        /* ── Buttons ── */
        button { transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.1s, opacity 0.15s; }
        button:not(:disabled):active { transform: scale(0.955); }

        /* ── Inputs ── */
        input:not([type=range]):not([type=file]), textarea, select { transition: border-color 0.18s, box-shadow 0.18s; }
        input:not([type=range]):not([type=file]):focus, textarea:focus {
          box-shadow: 0 0 0 2px rgba(180,140,30,0.2) !important;
          outline: none !important;
        }
        select:focus { outline: none !important; border-color: #c9a030 !important; box-shadow: 0 0 0 2px rgba(91,63,160,0.15); }
        select option { background: #100d06; color: #e6def5; }

        /* ── Range slider ── */
        input[type=range] { -webkit-appearance: none; background: transparent; width: 100%; }
        input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: linear-gradient(90deg, #8a1010 0%, #222 100%); }
        input[type=range]:disabled::-webkit-slider-runnable-track { background: #1e1e1e; }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%;
          background: #c9a030; border: 2px solid #050305; margin-top: -6px;
          cursor: pointer; box-shadow: 0 0 8px rgba(212,168,48,0.45);
          transition: transform 0.12s, box-shadow 0.12s;
        }
        input[type=range]:not(:disabled)::-webkit-slider-thumb:hover { transform: scale(1.22); box-shadow: 0 0 14px rgba(212,168,48,0.6); }
        input[type=range]:disabled::-webkit-slider-thumb { background: #2a2a2a; box-shadow: none; cursor: default; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }

        /* ── Member cards ── */
        .ev-member-card { transition: border-color 0.2s, box-shadow 0.22s !important; }
        .ev-member-card:hover { border-color: #251a06 !important; box-shadow: 0 4px 24px rgba(0,0,0,0.7), 0 0 0 1px rgba(180,140,30,0.12), 0 0 20px rgba(160,110,20,0.08) !important; }

        /* ── Grid cards ── */
        .ev-grid-card { transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s !important; }
        .ev-grid-card:hover { transform: translateY(-3px) !important; box-shadow: 0 10px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(180,140,30,0.15) !important; border-color: #251a06 !important; }

        /* ── Approval cards ── */
        .ev-approval-card { transition: transform 0.15s, box-shadow 0.18s, border-color 0.15s !important; }
        .ev-approval-card:hover { transform: translateY(-2px) !important; box-shadow: 0 6px 28px rgba(0,0,0,0.65) !important; border-color: #241a06 !important; }

        /* ── Puncte rows ── */
        .ev-p-row { transition: background 0.12s, border-color 0.12s !important; }
        .ev-p-row:hover { background: #100c1e !important; border-color: #1c1728 !important; }
        .ev-reg-row { transition: background 0.12s !important; }
        .ev-reg-row:hover { background: rgba(170,130,28,0.06) !important; }

        /* ── Misc interactive ── */
        .ev-cycle:not(:disabled):hover { filter: brightness(1.18); transform: scale(1.03); }
        .ev-license:not(:disabled):hover { filter: brightness(1.15); transform: scale(1.04); }
        .ev-chip { transition: transform 0.12s, filter 0.12s !important; }
        .ev-chip:hover { transform: scale(1.04) !important; filter: brightness(1.1) !important; }
        .ev-add-dashed { transition: border-color 0.15s, color 0.15s, background 0.15s !important; }
        .ev-add-dashed:hover { border-color: #c9a030 !important; color: #c9a030 !important; background: rgba(201,160,48,0.04) !important; }
        .ev-btn-gold { transition: background 0.15s, box-shadow 0.15s, transform 0.1s !important; }
        .ev-btn-gold:hover { background: #d4aa38 !important; box-shadow: 0 2px 14px rgba(201,160,48,0.3) !important; }
        .ev-list-row { transition: background 0.1s !important; }
        .ev-list-row:hover { background: rgba(170,130,28,0.05) !important; }
      `}</style>

      {/* Fixed background effects */}
      <div className="ev-vignette" />
      <div className="ev-noise" />

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={login} onLoginAccount={loginAccount} />}

      <div style={{ minHeight:"100vh", background:"transparent", color:"#e6def5", fontFamily:"'Barlow', sans-serif", display:"flex", flexDirection:"column", position:"relative", zIndex:1 }}>
        {/* Top accent bar */}
        <div className="ev-top-accent" />
        {/* Top nav */}
        <div className="ev-nav-glow" style={{ background:"linear-gradient(180deg, rgba(8,6,2,0.98) 0%, rgba(6,4,1,0.97) 100%)", backdropFilter:"blur(20px)", padding:"0 0 0 16px", display:"flex", alignItems:"stretch", height:62, gap:0, flexShrink:0, minWidth:0, position:"sticky", top:0, zIndex:100 }}>

          {/* Brand block */}
          <div className="ev-brand-block" style={{ alignItems:"center", gap:10 }}>
            <img src={logoUrl} alt="Aldrick" style={{ width:38, height:38, objectFit:"contain", flexShrink:0 }} />
            <div>
              <span className="ev-brand-title" style={{ fontFamily:"'Cinzel', serif", fontWeight:800, fontSize:15, letterSpacing:"0.14em", display:"block", lineHeight:1.1 }}>ALDRICK</span>
              <span style={{ fontFamily:"'Cinzel', serif", fontWeight:600, fontSize:9, letterSpacing:"0.28em", color:"#7a5a18", display:"block", lineHeight:1.2 }}>ENTERPRISES</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="ev-nav-tabs" style={{ display:"flex", height:"100%", gap:0, flex:1, overflowX:"auto", scrollbarWidth:"none" }}>
            {navTabs.map(t => (
              <button key={t} onClick={() => switchTab(t)} className={`ev-tab${tab===t?" ev-tab-active":""}`}
                style={{ background:"transparent", border:"none", color:tab===t?"#e6def5":"#5a4210", fontFamily:"'Barlow', sans-serif", fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0, height:"100%" }}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* User / Login */}
          <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:8, paddingRight:16 }}>
            <div className="ev-user-badge">
              <span style={{ fontSize:10, fontFamily:"'Barlow', sans-serif", letterSpacing:"0.1em", color: isGeneralAdmin ? "#c9a030" : isAdmin2 ? "#60a5fa" : userRole === "member" ? "#a3e635" : "#8a6c1e", textTransform:"uppercase" }}>
                {isGeneralAdmin ? "⬡ General Admin" : isAdmin2 ? "⬡ Admin 2" : userRole === "member" ? "⬡ Membru" : "◇ Vizitator"}
              </span>
              <span style={{ fontSize:9.5, fontFamily:"'Barlow', sans-serif", color:"rgba(150,140,180,0.6)", letterSpacing:"0.04em" }}>
                {currentUser?.nickname || currentUser?.email || ""}
              </span>
            </div>
            {isVisitor && (
              <button className="ev-login-btn" onClick={() => setShowLogin(true)}>⬡ Acces cont</button>
            )}
            <button className="ev-logout-btn" onClick={logout}>Ieșire</button>
          </div>
        </div>

        {/* Section content — lazy mount on first visit, then keep mounted for instant switching */}
        <div style={{ flex:1, overflowY:"auto", position:"relative" }}>
          {visited.has("Membri") && <div style={{ display: tab==="Membri" ? "block" : "none" }}><MembersSection role={userRole} currentUser={currentUser} /></div>}
          {(isGeneralAdmin || isAdmin2) && visited.has("Heists") && <div style={{ display: tab==="Heists" ? "block" : "none" }}><HeistsSection isAdmin={isGeneralAdmin} /></div>}
          {(isGeneralAdmin || isAdmin2) && visited.has("Informații Zone") && <div style={{ display: tab==="Informații Zone" ? "block" : "none" }}><ZoneInfoSection isAdmin={isGeneralAdmin} /></div>}
          {(isGeneralAdmin || isAdmin2) && visited.has("Aprobări Zonă") && <div style={{ display: tab==="Aprobări Zonă" ? "block" : "none" }}><ZoneApprovalsSection isAdmin={isGeneralAdmin} /></div>}
          {(isGeneralAdmin || isAdmin2) && visited.has("Sistem Puncte") && <div style={{ display: tab==="Sistem Puncte" ? "block" : "none" }}><SistemPuncteSection isAdmin={isGeneralAdmin} /></div>}
          {(isGeneralAdmin || isAdmin2) && visited.has("Panel Admin") && <div style={{ display: tab==="Panel Admin" ? "block" : "none" }}><AdminPanelSection role={userRole} currentUser={currentUser} /></div>}
        </div>

        {/* Footer */}
        <div className="ev-footer" style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <span className="ev-gold-text" style={{ fontFamily:"'Cinzel', serif", fontWeight:600, fontSize:11, letterSpacing:"0.14em" }}>
            Family is Everything and Everything is Family
          </span>
          <div>
            <span className="ev-footer-dot">©</span>
            <span>2025 – 2026</span>
            <span className="ev-footer-dot">·</span>
            <span className="ev-footer-gold">ALDRICK ENTERPRISES</span>
            <span className="ev-footer-dot">·</span>
            <span>Toate drepturile rezervate</span>
            <span className="ev-footer-dot">·</span>
            <span style={{ color:"#7a5a18" }}>sebastian.0115</span>
          </div>
        </div>
      </div>
    </>
  );
}
