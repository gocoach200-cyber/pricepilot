import { useState } from "react";
 
// ─── Config ───────────────────────────────────────────────────────────────────
const DRIVER_RATE    = 14.50;
const FUEL_PER_LITRE = 1.75;  // current diesel price per litre
const MILES_PER_LITRE = 6;    // realistic for loaded minibus
const RUNNING_UPLIFT  = 1.25; // 25% uplift for wear, tyres, maintenance
const FUEL_PER_MILE   = (FUEL_PER_LITRE / MILES_PER_LITRE) * RUNNING_UPLIFT; // ~36p per mile
const API_KEY = process.env.REACT_APP_ANTHROPIC_KEY;
 
// ─── Survey Questions ────────────────────────────────────────────────────────
const VEHICLE_SIZES = ["8-seater","12-seater","16-seater","24-seater","32-seater","49-seater"];
 
const UK_CITIES = [
  "London","Birmingham","Manchester","Leeds","Bristol","Sheffield",
  "Liverpool","Newcastle","Nottingham","Cardiff","Edinburgh","Glasgow",
  "Reading","Brighton","Southampton","Leicester","Coventry","Oxford"
];
 
const TRIPS_BY_BASE = {
  "London":       [
    { from:"Peckham SE15, London",    to:"Manchester Piccadilly", type:"Same day return", time:"09:00-18:30" },
    { from:"Central London",          to:"Birmingham City Centre", type:"Same day return", time:"09:00-17:30" },
    { from:"Brixton, London",         to:"Heathrow Airport",      type:"Return diff day", time:"06:00"       },
    { from:"Hackney E8, London",      to:"Wembley Stadium",       type:"Same day return", time:"17:00-23:00" },
    { from:"Central London",          to:"Gatwick Airport",       type:"Return diff day", time:"05:00"       },
  ],
  "Birmingham":   [
    { from:"Birmingham City Centre",  to:"Manchester Piccadilly", type:"Same day return", time:"09:00-18:30" },
    { from:"Birmingham City Centre",  to:"Leeds City Centre",     type:"Same day return", time:"09:00-17:30" },
    { from:"Birmingham City Centre",  to:"London Victoria",       type:"Same day return", time:"08:00-19:00" },
    { from:"Birmingham City Centre",  to:"Bristol City Centre",   type:"Same day return", time:"09:00-17:00" },
    { from:"Birmingham City Centre",  to:"Cardiff City Centre",   type:"Same day return", time:"09:00-17:00" },
  ],
  "Manchester":   [
    { from:"Manchester Piccadilly",   to:"Leeds City Centre",     type:"Same day return", time:"10:00-18:30" },
    { from:"Manchester Piccadilly",   to:"Liverpool City Centre", type:"Same day return", time:"10:00-18:00" },
    { from:"Manchester Piccadilly",   to:"London Victoria",       type:"Same day return", time:"08:00-19:00" },
    { from:"Manchester Piccadilly",   to:"Newcastle City Centre", type:"Same day return", time:"09:00-18:00" },
    { from:"Manchester Airport",      to:"Leeds City Centre",     type:"Return diff day", time:"06:00"       },
  ],
  "Leeds":        [
    { from:"Leeds City Centre",       to:"Manchester Piccadilly", type:"Same day return", time:"09:00-18:00" },
    { from:"Leeds City Centre",       to:"Newcastle City Centre", type:"Same day return", time:"09:00-17:00" },
    { from:"Leeds City Centre",       to:"London Victoria",       type:"Same day return", time:"08:00-19:00" },
    { from:"Leeds City Centre",       to:"Birmingham City Centre",type:"Same day return", time:"09:00-17:30" },
    { from:"Leeds Bradford Airport",  to:"London Victoria",       type:"Return diff day", time:"06:00"       },
  ],
  "Bristol":      [
    { from:"Bristol City Centre",     to:"London Victoria",       type:"Same day return", time:"09:00-18:00" },
    { from:"Bristol City Centre",     to:"Birmingham City Centre",type:"Same day return", time:"09:00-17:00" },
    { from:"Bristol City Centre",     to:"Cardiff City Centre",   type:"Same day return", time:"10:00-18:00" },
    { from:"Bristol City Centre",     to:"Manchester Piccadilly", type:"Same day return", time:"08:00-19:00" },
    { from:"Bristol Airport",         to:"London Victoria",       type:"Return diff day", time:"06:00"       },
  ],
  "Reading":      [
    { from:"Reading Town Centre",     to:"London Victoria",       type:"Same day return", time:"09:00-18:00" },
    { from:"Reading Town Centre",     to:"Birmingham City Centre",type:"Same day return", time:"09:00-17:30" },
    { from:"Reading Town Centre",     to:"Bristol City Centre",   type:"Same day return", time:"09:00-17:00" },
    { from:"Reading Town Centre",     to:"Heathrow Airport",      type:"Return diff day", time:"05:00"       },
    { from:"Reading Town Centre",     to:"Manchester Piccadilly", type:"Same day return", time:"08:00-19:00" },
  ],
  "default":      [
    { from:"City Centre",             to:"London Victoria",       type:"Same day return", time:"09:00-18:00" },
    { from:"City Centre",             to:"Manchester Piccadilly", type:"Same day return", time:"09:00-18:30" },
    { from:"City Centre",             to:"Birmingham City Centre",type:"Same day return", time:"09:00-17:30" },
  ],
};
 
const getPaxFromVehicle = (vehicle) => {
  if (vehicle === "8-seater")  return 8;
  if (vehicle === "12-seater") return 12;
  if (vehicle === "16-seater") return 16;
  if (vehicle === "24-seater") return 24;
  if (vehicle === "32-seater") return 30;
  if (vehicle === "49-seater") return 45;
  return 16;
};
 
const getSurveyTrips = (base, vehicle) => {
  const trips = TRIPS_BY_BASE[base] || TRIPS_BY_BASE["default"];
  const pax   = getPaxFromVehicle(vehicle);
  return trips.slice(0, 3).map(t => ({ ...t, pax }));
};
 
// ─── Real Market Data (collected from UK operators, May 2025) ─────────────────
const MARKET_DATA = [
  { from:"birmingham", to:"manchester", pax:16, type:"return", avg:583, low:575, high:600 },
  { from:"birmingham", to:"manchester", pax:30, type:"return", avg:783, low:600, high:900 },
  { from:"birmingham", to:"manchester", pax:50, type:"return", avg:730, low:575, high:895 },
  { from:"hackney",    to:"luton",      pax:23, type:"return", avg:1194, low:865, high:1620 },
  { from:"hackney",    to:"wembley",    pax:16, type:"return", avg:400, low:400, high:400 },
  { from:"london",     to:"o2",         pax:16, type:"return", avg:450, low:450, high:450 },
  { from:"manchester", to:"leeds",      pax:30, type:"return", avg:728, low:575, high:895 },
  { from:"manchester", to:"leeds",      pax:16, type:"return", avg:350, low:350, high:350 },
  { from:"london",     to:"stansted",   pax:12, type:"one-way", avg:275, low:275, high:275 },
  { from:"reading",    to:"birmingham", pax:30, type:"return", avg:952, low:895, high:995 },
  { from:"brixton",    to:"windsor",    pax:16, type:"return", avg:510, low:495, high:525 },
  { from:"peckham",    to:"heathrow",   pax:14, type:"one-way", avg:470, low:420, high:495 },
];
 
// Known UK road distances (miles, one way)
const KNOWN_DISTANCES = [
  { from:"london", to:"manchester",  miles:200 },
  { from:"london", to:"birmingham",  miles:120 },
  { from:"london", to:"leeds",       miles:195 },
  { from:"london", to:"bristol",     miles:115 },
  { from:"london", to:"edinburgh",   miles:415 },
  { from:"london", to:"cardiff",     miles:155 },
  { from:"london", to:"liverpool",   miles:215 },
  { from:"london", to:"sheffield",   miles:170 },
  { from:"london", to:"nottingham",  miles:130 },
  { from:"london", to:"newcastle",   miles:285 },
  { from:"london", to:"heathrow",    miles:15  },
  { from:"london", to:"gatwick",     miles:28  },
  { from:"london", to:"stansted",    miles:35  },
  { from:"london", to:"luton",       miles:35  },
  { from:"london", to:"brighton",    miles:55  },
  { from:"london", to:"wembley",     miles:12  },
  { from:"london", to:"o2",          miles:8   },
  { from:"london", to:"windsor",     miles:25  },
  { from:"peckham", to:"stansted",   miles:35  },
  { from:"peckham", to:"heathrow",   miles:20  },
  { from:"peckham", to:"manchester", miles:200 },
  { from:"peckham", to:"birmingham", miles:120 },
  { from:"brixton", to:"heathrow",   miles:16  },
  { from:"brixton", to:"manchester", miles:200 },
  { from:"hackney", to:"luton",      miles:35  },
  { from:"hackney", to:"stansted",   miles:35  },
  { from:"birmingham", to:"manchester", miles:85  },
  { from:"birmingham", to:"leeds",      miles:115 },
  { from:"birmingham", to:"bristol",    miles:90  },
  { from:"birmingham", to:"cardiff",    miles:100 },
  { from:"birmingham", to:"liverpool",  miles:100 },
  { from:"manchester", to:"leeds",      miles:45  },
  { from:"manchester", to:"liverpool",  miles:35  },
  { from:"manchester", to:"sheffield",  miles:40  },
  { from:"manchester", to:"newcastle",  miles:145 },
  { from:"leeds",      to:"newcastle",  miles:95  },
  { from:"reading",    to:"london",     miles:40  },
  { from:"reading",    to:"birmingham", miles:100 },
  { from:"reading",    to:"bristol",    miles:75  },
];
 
const findKnownDistance = (from, to) => {
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  for (const d of KNOWN_DISTANCES) {
    const fromMatch = f.includes(d.from) || d.from.includes(f.split(/[ ,]+/)[0]);
    const toMatch   = t.includes(d.to)   || d.to.includes(t.split(/[ ,]+/)[0]);
    if (fromMatch && toMatch) return d.miles;
    // Check reverse
    const fromMatchR = f.includes(d.to)   || d.to.includes(f.split(/[ ,]+/)[0]);
    const toMatchR   = t.includes(d.from) || d.from.includes(t.split(/[ ,]+/)[0]);
    if (fromMatchR && toMatchR) return d.miles;
  }
  return null;
};
 
// Find closest market data match
const findMarketPrice = (from, to, pax, type) => {
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  const p = parseInt(pax) || 0;
  let best = null, bestScore = 0;
  for (const d of MARKET_DATA) {
    let score = 0;
    // Location matching - both from AND to must match to get a good score
    const fromMatch = f.includes(d.from) || d.from.includes(f.split(/[\s,]+/)[0]);
    const toMatch   = t.includes(d.to)   || d.to.includes(t.split(/[\s,]+/)[0]);
    if (fromMatch) score += 3;
    if (toMatch)   score += 3;
    // Trip type must match - penalise mismatch
    if (d.type === type) score += 3;
    else score -= 2;
    // Passenger count
    const paxDiff = Math.abs(d.pax - p);
    if (paxDiff === 0)       score += 2;
    else if (paxDiff <= 4)   score += 1;
    else if (paxDiff > 10)   score -= 1;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  // Require both locations to match (score >= 6) to show market data
  return bestScore >= 6 ? best : null;
};
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (n) => typeof n === "number" ? "£" + Math.round(n).toLocaleString("en-GB") : n;
 
const isBusy = (d) => {
  if (!d) return null;
  const dt = new Date(d), m = dt.getMonth(), day = dt.getDate();
  if (m === 11 && day >= 20) return "Christmas period — consider pricing higher";
  if (m === 0  && day <= 3)  return "New Year period — consider pricing higher";
  if (m === 7)               return "Summer holidays — high demand period";
  if (m === 3 && day <= 14)  return "Easter period — consider pricing higher";
  return null;
};
 
const isLondon = (a, b) =>
  ["london","heathrow","gatwick","stansted","wembley","luton","canary wharf","o2","brixton","peckham","hackney","camden","islington"]
  .some(k => (a + b).toLowerCase().includes(k));
 
const waMsg = (from, to, pax, date, price, vehicle) => {
  const d = date ? new Date(date).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" }) : "";
  return "Hi, thank you for your enquiry!\n\n" +
    "Here is your quote:\n" +
    "Route: " + from + " to " + to + "\n" +
    "Date: " + d + "\n" +
    "Passengers: " + pax + "\n" +
    "Vehicle: " + vehicle + "\n" +
    "Price: " + fmt(price) + "\n\n" +
    "This includes a professional licensed driver and a fully insured vehicle.\n\n" +
    "Please don't hesitate to get in touch if you have any questions. We look forward to travelling with you!";
};
 
const buildPrompt = (from, to, pax, date, time, trip, retDate, retTime, jobs, variation, miles) => {
  const retLine = trip === "return" ? "\nReturn: " + retDate + " " + retTime : "";
  const varLine = variation === "higher" ? "\nPrice 10% HIGHER." : variation === "lower" ? "\nPrice 10% LOWER." : "";
  const milesLine = miles ? "\nKnown miles: " + miles : "";
  const hist = jobs.length > 0
    ? "\nOperator past jobs: " + jobs.slice(0, 8).map(j => j.from + "->" + j.to + " " + j.pax + "pax=£" + j.actual).join(", ")
    : "";
  return "UK minibus hire pricing expert. Price at UPPER end of market rate.\n" +
    "Real market data: Birmingham-Manchester 16pax return £583, 30pax return £783. " +
    "Hackney-Luton 23pax return £1194. Manchester-Leeds 30pax return £728, 16pax return £350. " +
    "Reading-Birmingham 30pax return £952. Brixton-Windsor 16pax return £510. " +
    "Peckham-Heathrow 14pax one-way £470. London-Stansted 12pax one-way £275. " +
    "London-Wembley 16pax return £400. London-O2 16pax return £450.\n" +
    "Return same day = driving both ways + full waiting time. Airport transfer different day = two one-way trips, no accommodation.\n\n" +
    "From: " + from + "\nTo: " + to + "\nPassengers: " + pax +
    "\nDate: " + date + " " + time + "\nTrip: " + trip + retLine + milesLine + hist + varLine + "\n\n" +
    'Reply ONLY with JSON:\n{"price":450,"low":420,"high":490,"vehicle":"16-seater","miles":90,"notes":"One sentence."}';
};
 
const TAGS = {
  accepted:    { bg:"#16a34a22", color:"#4ade80", border:"1px solid #16a34a55", label:"Accepted"           },
  rejected:    { bg:"#ef444422", color:"#f87171", border:"1px solid #ef444455", label:"Rejected"           },
  no_response: { bg:"#21262d",   color:"#7d8590", border:"1px solid #30363d",   label:"No Response"        },
  different:   { bg:"#1e3a5f",   color:"#60a5fa", border:"1px solid #2563eb44", label:"Quoted Differently"  },
};
 
// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [from,       setFrom]       = useState("");
  const [to,         setTo]         = useState("");
  const [pax,        setPax]        = useState("");
  const [date,       setDate]       = useState("");
  const [time,       setTime]       = useState("");
  const [trip,       setTrip]       = useState("return");
  const [retDate,    setRetDate]    = useState("");
  const [retTime,    setRetTime]    = useState("");
  const [manualMiles,setManualMiles]= useState("");
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [jobs,       setJobs]       = useState([]);
  const [logged,     setLogged]     = useState(false);
  const [altPrice,   setAltPrice]   = useState("");
  const [isReg,      setIsReg]      = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [showSurvey,   setShowSurvey]   = useState(true);
  const [setupDone,    setSetupDone]    = useState(false);
  const [operatorBase, setOperatorBase] = useState("");
  const [operatorVehicle, setOperatorVehicle] = useState("");
  const [surveyTrips,  setSurveyTrips]  = useState([]);
  const [surveyStep,   setSurveyStep]   = useState(0);
  const [surveyAnswers,setSurveyAnswers]= useState([]);
  const [surveyInput,  setSurveyInput]  = useState("");
  const [surveyDone,   setSurveyDone]   = useState(false);
 
  const callAPI = async (variation) => {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", max_tokens: 200,
          messages: [{ role:"user", content: buildPrompt(from,to,pax,date,time,trip,retDate,retTime,jobs,variation,manualMiles) }]
        })
      });
      clearTimeout(tid);
      const data = await r.json();
      if (data.error) throw new Error(data.error.message);
      const match = (data.content?.[0]?.text || "").match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No price returned");
      return JSON.parse(match[0]);
    } catch(e) { clearTimeout(tid); throw e; }
  };
 
  const getPrice = async (variation) => {
    if (!from || !to || !pax || !date) { setError("Please fill in pickup, dropoff, passengers and date."); return; }
    setError(""); setResult(null); setLogged(false); setAltPrice(""); setIsReg(false); setLoading(true);
    try { setResult(await callAPI(variation || "normal")); }
    catch(e) { setError(e.name === "AbortError" ? "Timed out. Please try again." : "Error: " + e.message); }
    setLoading(false);
  };
 
  const logJob = (outcome) => {
    const actual = outcome === "different" && altPrice ? parseInt(altPrice) : result.price;
    setJobs(prev => [{ id:Date.now(), from, to, pax, trip, date, aiPrice:result.price, actual, outcome }, ...prev]);
    setLogged(true);
  };
 
  const copyWA = () => {
    navigator.clipboard.writeText(waMsg(from, to, pax, date, displayPrice, result.vehicle));
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };
 
  // ── Derived values ──
  const marketMatch   = result ? findMarketPrice(from, to, pax, trip) : null;
  const similarJobs   = jobs.filter(j => from.length > 3 && (
    j.from.toLowerCase().includes(from.toLowerCase().slice(0,5)) ||
    j.to.toLowerCase().includes(to.toLowerCase().slice(0,5))
  )).slice(0, 3);
  const myAvgPrice    = similarJobs.length
    ? Math.round(similarJobs.reduce((a,j) => a + j.actual, 0) / similarJobs.length) : null;
 
  const accepted      = jobs.filter(j => j.outcome === "accepted").length;
  const avgP          = jobs.length ? Math.round(jobs.reduce((a,j) => a+j.actual,0) / jobs.length) : 0;
  const displayPrice  = result ? (isReg ? Math.round(result.price * 0.9) : result.price) : 0;
  // ONE WAY miles only - system multiplies for return trips
  const knownMiles  = findKnownDistance(from, to);
  const oneWayMiles = manualMiles ? parseInt(manualMiles)
                    : knownMiles  ? knownMiles
                    : (result     ? result.miles : 0);
  const milesSource = manualMiles ? "entered" : knownMiles ? "known route" : "AI estimate";
 
  // Total miles calculation:
  // One way:              A->B                    = 1x one way
  // Same day return:      A->B->A                 = 2x one way
  // Different day return: A->B->A + A->B->A       = 4x one way (two separate days)
  const totalMiles = trip === "return-different" ? oneWayMiles * 4
                   : trip === "return"           ? oneWayMiles * 2
                   : oneWayMiles;
  const fuel          = Math.round(totalMiles * FUEL_PER_MILE);
  const litres        = Math.round(totalMiles / MILES_PER_LITRE);
 
  const driverHours   = (() => {
    if (trip === "return-different") {
      // Two separate one-way drives on different days
      const oneWayHrs = oneWayMiles ? oneWayMiles / 40 : 0;
      return Math.round(oneWayHrs * 2 * 10) / 10;
    }
    if (trip === "return" && date && time && retDate && retTime && date === retDate) {
      // Same day - count full hours operator is on the job
      const hrs = (new Date(retDate + "T" + retTime) - new Date(date + "T" + time)) / 3600000;
      return hrs > 0 ? Math.round(hrs * 10) / 10 : 0;
    }
    // One way or fallback - driving time only
    return oneWayMiles ? Math.round((oneWayMiles / 40) * 10) / 10 : 0;
  })();
 
  const MIN_DRIVER_PAY = 60; // minimum 4 hours at £14.50 = £58, rounded to £60
  const driverCost    = Math.max(MIN_DRIVER_PAY, Math.round(driverHours * DRIVER_RATE));
  const costs         = fuel + driverCost;
  const margin        = displayPrice - costs;
  const marginPct     = displayPrice > 0 ? Math.round((margin / displayPrice) * 100) : 0;
  const floorPrice    = Math.round(costs * 1.15);
  const perPerson     = pax && displayPrice ? Math.round(displayPrice / parseInt(pax)) : 0;
  const season        = isBusy(date);
  const congestion    = from && to && isLondon(from, to);
 
  return (
    <div style={{ minHeight:"100vh", background:"#0d1117", color:"#e6edf3", fontFamily:"sans-serif", padding:20 }}>
    <div style={{ maxWidth:520, margin:"0 auto" }}>
 
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:22, fontWeight:800, color:"#f59e0b" }}>PricePilot</div>
        <div style={{ fontSize:13, color:"#7d8590" }}>Minibus Operator Pricing Tool</div>
      </div>
 
      {/* ── Survey Popup ── */}
      {(showSurvey === true && surveyDone === false) ? (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.75)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:24, maxWidth:480, width:"100%" }}>
 
            {/* Screen 1 - Setup */}
            {!setupDone && (
              <>
                <div style={{ fontSize:11, color:"#f59e0b", textTransform:"uppercase", letterSpacing:"1px", marginBottom:8 }}>Quick Setup</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#f0f6fc", marginBottom:6 }}>Welcome to PricePilot</div>
                <div style={{ fontSize:13, color:"#7d8590", marginBottom:20 }}>Tell us a bit about your operation so we can show you the most relevant pricing data.</div>
 
                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#7d8590", textTransform:"uppercase", marginBottom:6 }}>Where are you based?</label>
                <select style={{ ...I, marginBottom:14 }} value={operatorBase} onChange={e => setOperatorBase(e.target.value)}>
                  <option value="">Select your city...</option>
                  {UK_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
 
                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#7d8590", textTransform:"uppercase", marginBottom:6 }}>What is your largest vehicle?</label>
                <select style={{ ...I, marginBottom:20 }} value={operatorVehicle} onChange={e => setOperatorVehicle(e.target.value)}>
                  <option value="">Select vehicle size...</option>
                  {VEHICLE_SIZES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
 
                <div style={{ display:"flex", gap:10 }}>
                  <button
                    onClick={() => {
                      if (!operatorBase || !operatorVehicle) return;
                      const trips = getSurveyTrips(operatorBase, operatorVehicle);
                      setSurveyTrips(trips);
                      setSetupDone(true);
                    }}
                    style={{ flex:1, padding:12, background:operatorBase && operatorVehicle ? "#f59e0b" : "#333", border:"none", borderRadius:8, color:operatorBase && operatorVehicle ? "#000" : "#777", fontWeight:700, fontSize:14, cursor:"pointer" }}
                  >
                    Continue
                  </button>
                  <button onClick={() => setShowSurvey(false)} style={{ padding:12, background:"#21262d", border:"1px solid #30363d", borderRadius:8, color:"#7d8590", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                    Skip
                  </button>
                </div>
                <div style={{ fontSize:11, color:"#484f58", marginTop:12, textAlign:"center" }}>Takes 60 seconds · Helps improve your quotes</div>
              </>
            )}
 
            {/* Screen 2 - Survey Questions */}
            {setupDone && surveyTrips.length > 0 && (
              <>
                <div style={{ fontSize:11, color:"#f59e0b", textTransform:"uppercase", letterSpacing:"1px", marginBottom:8 }}>Question {surveyStep + 1} of {surveyTrips.length}</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#f0f6fc", marginBottom:6 }}>What would you charge?</div>
                <div style={{ fontSize:13, color:"#7d8590", marginBottom:16 }}>Your answer is anonymous and helps build accurate market pricing.</div>
 
                <div style={{ background:"#0d1117", borderRadius:8, padding:14, marginBottom:16 }}>
                  <div style={{ fontSize:13, color:"#e6edf3", marginBottom:6 }}>
                    <span style={{ color:"#f59e0b", fontWeight:700 }}>{surveyTrips[surveyStep].from}</span>
                    <span style={{ color:"#484f58" }}> → </span>
                    <span style={{ color:"#f59e0b", fontWeight:700 }}>{surveyTrips[surveyStep].to}</span>
                  </div>
                  <div style={{ fontSize:12, color:"#7d8590" }}>
                    {surveyTrips[surveyStep].pax} passengers · {surveyTrips[surveyStep].type} · {surveyTrips[surveyStep].time}
                  </div>
                </div>
 
                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#7d8590", textTransform:"uppercase", marginBottom:6 }}>Your price (£)</label>
                <input
                  style={{ ...I, marginBottom:16, fontSize:18, fontWeight:700 }}
                  type="number"
                  placeholder="e.g. 650"
                  value={surveyInput}
                  onChange={e => setSurveyInput(e.target.value)}
                />
 
                {/* Progress dots */}
                <div style={{ display:"flex", gap:6, justifyContent:"center", marginBottom:16 }}>
                  {surveyTrips.map((_, i) => (
                    <div key={i} style={{ width:8, height:8, borderRadius:"50%", background: i <= surveyStep ? "#f59e0b" : "#30363d" }} />
                  ))}
                </div>
 
                <div style={{ display:"flex", gap:10 }}>
                  <button
                    onClick={() => {
                      if (!surveyInput) return;
                      const updated = [...surveyAnswers, { ...surveyTrips[surveyStep], price: parseInt(surveyInput) }];
                      setSurveyAnswers(updated);
                      setSurveyInput("");
                      if (surveyStep + 1 < surveyTrips.length) {
                        setSurveyStep(surveyStep + 1);
                      } else {
                        setSurveyDone(true);
                        setShowSurvey(false);
                      }
                    }}
                    style={{ flex:1, padding:12, background:surveyInput ? "#f59e0b" : "#333", border:"none", borderRadius:8, color:surveyInput ? "#000" : "#777", fontWeight:700, fontSize:14, cursor:"pointer" }}
                  >
                    {surveyStep + 1 < surveyTrips.length ? "Next" : "Submit"}
                  </button>
                  <button onClick={() => setShowSurvey(false)} style={{ padding:12, background:"#21262d", border:"1px solid #30363d", borderRadius:8, color:"#7d8590", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                    Skip
                  </button>
                </div>
              </>
            )}
 
          </div>
        </div>
      ) : null}
 
      {/* Survey thank you banner */}
      {surveyDone && (
        <div style={{ background:"#16a34a22", border:"1px solid #16a34a55", borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:13, color:"#4ade80", textAlign:"center" }}>
          Thank you! Your pricing data helps make PricePilot more accurate for everyone.
        </div>
      )}
 
      {/* ── Form ── */}
      <div style={C}>
        <Lbl>Pickup location</Lbl>
        <input style={I} placeholder="e.g. Peckham SE15, London" value={from} onChange={e => setFrom(e.target.value)} />
        <Lbl>Dropoff location</Lbl>
        <input style={I} placeholder="e.g. Manchester Piccadilly" value={to} onChange={e => setTo(e.target.value)} />
 
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div><Lbl>Passengers</Lbl>
            <input style={I} type="number" min="1" max="70" placeholder="e.g. 16" value={pax} onChange={e => setPax(e.target.value)} />
          </div>
          <div><Lbl>Trip type</Lbl>
            <select style={I} value={trip} onChange={e => setTrip(e.target.value)}>
              <option value="return">Return (same day)</option>
              <option value="return-different">Return (different day)</option>
              <option value="one-way">One Way</option>
            </select>
          </div>
          <div><Lbl>Pickup date</Lbl>
            <input style={I} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div><Lbl>Pickup time</Lbl>
            <input style={I} type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>
 
        {(trip === "return" || trip === "return-different") && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:4 }}>
            <div><Lbl>Return date</Lbl>
              <input style={I} type="date" value={retDate} onChange={e => setRetDate(e.target.value)} />
            </div>
            <div><Lbl>Return time</Lbl>
              <input style={I} type="time" value={retTime} onChange={e => setRetTime(e.target.value)} />
            </div>
          </div>
        )}
 
        <div style={{ marginTop:12 }}>
          <Lbl>Miles — optional (enter if you know the exact distance)</Lbl>
          <input style={I} type="number" placeholder="e.g. 200 for London to Manchester" value={manualMiles} onChange={e => setManualMiles(e.target.value)} />
          <div style={{ fontSize:11, color:"#484f58", marginTop:3 }}>Leave blank and the AI will estimate.</div>
        </div>
 
        {season     && <Alert color="#f59e0b">{season}</Alert>}
        {congestion && <Alert color="#f87171">London route detected — remember Congestion Charge / ULEZ if applicable.</Alert>}
 
        {similarJobs.length > 0 && (
          <div style={{ marginTop:10, padding:"10px 12px", background:"#1f6feb11", border:"1px solid #1f6feb44", borderRadius:7 }}>
            <div style={{ color:"#60a5fa", fontWeight:700, fontSize:12, marginBottom:6 }}>Your similar past jobs:</div>
            {similarJobs.map(j => (
              <div key={j.id} style={{ color:"#7d8590", fontSize:12, marginBottom:2 }}>
                {j.from} to {j.to} · {j.pax} pax · <span style={{ color:"#f59e0b" }}>{fmt(j.actual)}</span> · {TAGS[j.outcome]?.label}
              </div>
            ))}
          </div>
        )}
 
        {error && <Alert color="#f85149">{error}</Alert>}
 
        <button onClick={() => getPrice("normal")} disabled={loading}
          style={{ width:"100%", marginTop:16, padding:13, background:loading?"#333":"#f59e0b", border:"none", borderRadius:8, fontSize:15, fontWeight:700, color:loading?"#777":"#000", cursor:loading?"not-allowed":"pointer" }}>
          {loading ? "Calculating..." : "Get Price"}
        </button>
      </div>
 
      {/* ── Result ── */}
      {result && (
        <div style={C}>
 
          {/* New / Regular toggle */}
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            <button onClick={() => setIsReg(false)} style={{ flex:1, padding:8, borderRadius:7, border:"none", fontWeight:700, fontSize:13, cursor:"pointer", background:!isReg?"#f59e0b":"#21262d", color:!isReg?"#000":"#7d8590" }}>New Customer</button>
            <button onClick={() => setIsReg(true)}  style={{ flex:1, padding:8, borderRadius:7, border:"none", fontWeight:700, fontSize:13, cursor:"pointer", background:isReg?"#7c3aed":"#21262d",  color:isReg?"#fff":"#7d8590"  }}>Regular (10% off)</button>
          </div>
 
          {/* ── Two price display ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
 
            {/* Market price */}
            <div style={{ background:"#0d1117", borderRadius:8, padding:14 }}>
              <div style={{ fontSize:10, color:"#7d8590", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>Market Average</div>
              {marketMatch ? (
                <>
                  <div style={{ fontSize:28, fontWeight:800, color:"#60a5fa", letterSpacing:"-1px" }}>{fmt(marketMatch.avg)}</div>
                  <div style={{ fontSize:11, color:"#484f58", marginTop:2 }}>{fmt(marketMatch.low)} – {fmt(marketMatch.high)}</div>
                  <div style={{ fontSize:10, color:"#484f58", marginTop:2 }}>Based on real operator data</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize:22, fontWeight:800, color:"#484f58" }}>—</div>
                  <div style={{ fontSize:10, color:"#484f58", marginTop:2 }}>No data for this route yet</div>
                </>
              )}
            </div>
 
            {/* Your historical price */}
            <div style={{ background:"#0d1117", borderRadius:8, padding:14 }}>
              <div style={{ fontSize:10, color:"#7d8590", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>Your Average</div>
              {myAvgPrice ? (
                <>
                  <div style={{ fontSize:28, fontWeight:800, color:"#4ade80", letterSpacing:"-1px" }}>{fmt(myAvgPrice)}</div>
                  <div style={{ fontSize:10, color:"#484f58", marginTop:2 }}>From {similarJobs.length} similar job{similarJobs.length > 1 ? "s" : ""}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize:22, fontWeight:800, color:"#484f58" }}>—</div>
                  <div style={{ fontSize:10, color:"#484f58", marginTop:2 }}>Log jobs to unlock</div>
                </>
              )}
            </div>
          </div>
 
          {/* AI suggested price */}
          <div style={{ fontSize:13, color:"#7d8590", marginBottom:4 }}>{isReg ? "Loyalty price (10% off)" : "AI Suggested Quote"}</div>
          <div style={{ fontSize:48, fontWeight:800, color:isReg?"#a78bfa":"#f59e0b", letterSpacing:"-2px", lineHeight:1 }}>
            {fmt(displayPrice)}
          </div>
          {isReg && (
            <div style={{ fontSize:12, color:"#7d8590", marginTop:2 }}>Full price: {fmt(result.price)} — saving {fmt(result.price - displayPrice)}</div>
          )}
          <div style={{ fontSize:13, color:"#7d8590", marginTop:4, marginBottom:16 }}>
            Range: {fmt(result.low)} – {fmt(result.high)}
          </div>
 
          {/* Re-quote buttons */}
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            <button onClick={() => getPrice("higher")} disabled={loading} style={{ flex:1, padding:8, background:"#21262d", border:"1px solid #30363d", borderRadius:7, color:"#4ade80", fontWeight:700, fontSize:12, cursor:"pointer" }}>Quote Higher</button>
            <button onClick={() => getPrice("normal")} disabled={loading} style={{ flex:1, padding:8, background:"#21262d", border:"1px solid #30363d", borderRadius:7, color:"#7d8590", fontWeight:700, fontSize:12, cursor:"pointer" }}>Refresh</button>
            <button onClick={() => getPrice("lower")}  disabled={loading} style={{ flex:1, padding:8, background:"#21262d", border:"1px solid #30363d", borderRadius:7, color:"#f87171", fontWeight:700, fontSize:12, cursor:"pointer" }}>Quote Lower</button>
          </div>
 
          {/* Chips */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
            <Chip label="VEHICLE"    value={result.vehicle} />
            <Chip label="TOTAL MILES" value={totalMiles + " mi"} subtitle={milesSource + " (" + oneWayMiles + " mi each way)"} />
            <Chip label="PER PERSON" value={"~" + fmt(perPerson)} color="#a78bfa" />
          </div>
 
          {/* Cost breakdown */}
          <div style={{ background:"#0d1117", borderRadius:8, padding:14, marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#7d8590", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:10 }}>Operator Cost Estimate</div>
            <BRow label={"Fuel + running costs (" + totalMiles + " mi, ~" + litres + " litres)"} value={fmt(fuel)} />
            <BRow label={"Driver (" + driverHours + " hrs at £14.50/hr" + (driverCost === 60 ? ", min charge applied" : "") + ")"} value={fmt(driverCost)} />
            <BRow label="Total est. costs"                                        value={fmt(costs)} />
            <BRow label="Min floor price (never go below)"                        value={fmt(floorPrice)} highlight />
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, paddingTop:8, fontWeight:700, color:margin > 0 ? "#4ade80" : "#f87171" }}>
              <span>Est. margin</span><span>{fmt(margin)} ({marginPct}%)</span>
            </div>
          </div>
 
          {result.notes && (
            <div style={{ background:"#0d1117", borderRadius:7, padding:"10px 12px", fontSize:13, color:"#8d96a0", lineHeight:1.5, marginBottom:10 }}>
              {result.notes}
            </div>
          )}
 
          {trip === "return-different" && oneWayMiles > 100 && (
            <div style={{ marginBottom:16, padding:"10px 12px", background:"#f59e0b11", border:"1px solid #f59e0b44", borderRadius:7, fontSize:12, color:"#f59e0b" }}>
              Long distance overnight trip — driver accommodation and meals not included above. Factor in separately if required (typically £80-£150 per night).
            </div>
          )}
 
          {/* WhatsApp button */}
          <button onClick={copyWA}
            style={{ width:"100%", padding:11, background:copied?"#16a34a":"#25D366", border:"none", borderRadius:8, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:16 }}>
            {copied ? "Copied! Paste into WhatsApp" : "Copy WhatsApp Quote Message"}
          </button>
 
          {/* Job logger */}
          <div style={{ borderTop:"1px solid #21262d", paddingTop:16 }}>
            {!logged ? (
              <>
                <div style={{ fontSize:13, color:"#7d8590", marginBottom:12 }}>How did this job go?</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                  <button onClick={() => logJob("accepted")}    style={{ padding:10, background:"#16a34a", border:"none", borderRadius:7, color:"#fff",    fontWeight:700, fontSize:13, cursor:"pointer" }}>Accepted</button>
                  <button onClick={() => logJob("rejected")}    style={{ padding:10, background:"#7f1d1d", border:"none", borderRadius:7, color:"#f87171", fontWeight:700, fontSize:13, cursor:"pointer" }}>Rejected</button>
                  <button onClick={() => logJob("no_response")} style={{ padding:10, background:"#21262d", border:"1px solid #30363d", borderRadius:7, color:"#7d8590", fontWeight:700, fontSize:13, cursor:"pointer" }}>No Response</button>
                  <button onClick={() => logJob("different")}   style={{ padding:10, background:"#1e3a5f", border:"none", borderRadius:7, color:"#60a5fa", fontWeight:700, fontSize:13, cursor:"pointer" }}>Quoted Differently</button>
                </div>
                <div style={{ background:"#0d1117", borderRadius:7, padding:"10px 12px", fontSize:12, color:"#7d8590" }}>
                  If you quoted differently, enter your actual price first:
                  <input style={{ ...I, marginTop:8 }} type="number" placeholder="e.g. 680" value={altPrice} onChange={e => setAltPrice(e.target.value)} />
                </div>
              </>
            ) : (
              <div style={{ background:"#16a34a22", border:"1px solid #16a34a55", color:"#4ade80", borderRadius:8, padding:12, textAlign:"center", fontSize:14, fontWeight:600 }}>
                Logged! Your pricing history is building up.
              </div>
            )}
          </div>
 
          <div style={{ fontSize:11, color:"#484f58", marginTop:14, textAlign:"center" }}>
            AI suggestion only — use your own judgement before quoting.
          </div>
        </div>
      )}
 
      {/* ── Job Log ── */}
      {jobs.length > 0 && (
        <div style={C}>
          <div style={{ fontSize:13, fontWeight:700, color:"#f0f6fc", marginBottom:14 }}>Job Log</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
            <Chip label="TOTAL"      value={jobs.length} />
            <Chip label="ACCEPTED"   value={accepted} color="#4ade80" />
            <Chip label="AVG QUOTED" value={fmt(avgP)} color="#f59e0b" />
          </div>
          {jobs.map(j => {
            const t = TAGS[j.outcome] || TAGS.different;
            return (
              <div key={j.id} style={{ background:"#0d1117", borderRadius:8, padding:"12px 14px", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ fontWeight:600, color:"#f0f6fc", fontSize:13 }}>{j.from} to {j.to}</div>
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20, background:t.bg, color:t.color, border:t.border }}>{t.label}</span>
                </div>
                <div style={{ fontSize:12, color:"#7d8590" }}>
                  {j.pax} pax · {j.trip} · {j.date} · <span style={{ color:"#f59e0b", fontWeight:700 }}>{fmt(j.actual)}</span>
                  {j.outcome === "different" && j.actual !== j.aiPrice && (
                    <span style={{ color:"#60a5fa", marginLeft:6 }}>(AI: {fmt(j.aiPrice)})</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
 
    </div>
    </div>
  );
}
 
// ─── Components ───────────────────────────────────────────────────────────────
const Lbl   = ({ children }) => <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#7d8590", textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:5, marginTop:12 }}>{children}</label>;
const Chip  = ({ label, value, color, subtitle }) => <div style={{ background:"#21262d", borderRadius:7, padding:"8px 10px" }}><div style={{ fontSize:10, color:"#7d8590", textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:2 }}>{label}</div><div style={{ fontWeight:700, color:color||"#f0f6fc", fontSize:13 }}>{value}</div>{subtitle && <div style={{ fontSize:9, color:"#484f58", marginTop:1 }}>{subtitle}</div>}</div>;
const BRow  = ({ label, value, highlight }) => <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"5px 0", borderBottom:"1px solid #21262d", color:highlight?"#f59e0b":"#8d96a0" }}><span>{label}</span><span>{value}</span></div>;
const Alert = ({ children, color }) => <div style={{ marginTop:10, padding:"10px 12px", background:color+"11", border:"1px solid "+color+"44", borderRadius:7, color:color, fontSize:13 }}>{children}</div>;
 
// ─── Styles ───────────────────────────────────────────────────────────────────
const I = { width:"100%", background:"#0d1117", border:"1px solid #30363d", borderRadius:7, padding:"10px 12px", color:"#e6edf3", fontSize:14, outline:"none", boxSizing:"border-box" };
const C = { background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:22, marginBottom:16 };