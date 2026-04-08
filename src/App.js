// PricePilot v4 - April 2026
/* eslint-disable */
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

// ─── Config ───────────────────────────────────────────────────────────────────
const DRIVER_RATE    = 14.50;
const FUEL_PER_LITRE = 1.75;  // current diesel price per litre
const MILES_PER_LITRE = 6;    // realistic for loaded minibus
const RUNNING_UPLIFT  = 1.25; // 25% uplift for wear, tyres, maintenance
const FUEL_PER_MILE   = (FUEL_PER_LITRE / MILES_PER_LITRE) * RUNNING_UPLIFT; // ~36p per mile
const API_KEY = process.env.REACT_APP_API_KEY;

// ─── Survey Questions ────────────────────────────────────────────────────────
const VEHICLE_SIZES = ["8-seater","12-seater","16-seater","24-seater","32-seater","49-seater"];

const UK_CITIES = [
  "London","Birmingham","Manchester","Leeds","Bristol","Sheffield",
  "Liverpool","Newcastle","Nottingham","Cardiff","Edinburgh","Glasgow",
  "Reading","Brighton","Southampton","Leicester","Coventry","Oxford"
];

const TRIPS_BY_BASE = {
  "London":       [
    { from:"Peckham SE15, London",    to:"Heathrow Airport",      type:"One way",         time:"05:00"       },
    { from:"Brixton SW2, London",     to:"Gatwick Airport",       type:"One way",         time:"06:00"       },
    { from:"Hackney E8, London",      to:"Luton Airport",         type:"One way",         time:"04:30"       },
    { from:"Lewisham SE13, London",   to:"Stansted Airport",      type:"One way",         time:"05:00"       },
    { from:"Central London",          to:"O2 Arena",              type:"Same day return", time:"17:00-23:00" },
    { from:"Peckham SE15, London",    to:"Wembley Stadium",       type:"Same day return", time:"13:00-19:00" },
    { from:"Brixton SW2, London",     to:"Brighton City Centre",  type:"Same day return", time:"09:00-18:00" },
    { from:"Central London",          to:"Birmingham City Centre", type:"Same day return", time:"09:00-17:30" },
    { from:"Hackney E8, London",      to:"Manchester Piccadilly", type:"Same day return", time:"09:00-18:30" },
    { from:"South London",            to:"Oxford City Centre",    type:"Same day return", time:"09:00-17:00" },
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
  const allTrips = TRIPS_BY_BASE[base] || TRIPS_BY_BASE["default"];
  const pax = getPaxFromVehicle(vehicle);
  // Randomly select 3 trips from the pool so repeat visitors see different routes
  const shuffled = [...allTrips].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map(t => ({ ...t, pax }));
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
  { from:"dartford",   to:"godstone",      pax:50, type:"return",   avg:825,  low:700,  high:900  },
  { from:"heathrow",   to:"walworth",      pax:12, type:"one-way",  avg:242,  low:200,  high:300  },
  { from:"heathrow",   to:"walworth",      pax:18, type:"one-way",  avg:461,  low:350,  high:575  },
  { from:"se12",       to:"o2",            pax:15, type:"return",   avg:312,  low:200,  high:450  },
  { from:"london",     to:"luton",         pax:13, type:"one-way",  avg:270,  low:200,  high:330  },
  { from:"london",     to:"gatwick",       pax:16, type:"one-way",  avg:253,  low:190,  high:300  },
  { from:"dartford",   to:"piccadilly",    pax:13, type:"one-way",  avg:394,  low:356,  high:450  },
  { from:"bromley",    to:"heathrow",      pax:16, type:"one-way",  avg:280,  low:220,  high:350  },
  { from:"bromley",    to:"o2",            pax:16, type:"return",   avg:300,  low:240,  high:380  },
  { from:"dartford",   to:"heathrow",      pax:16, type:"one-way",  avg:290,  low:230,  high:360  },
  { from:"maidstone",  to:"london",        pax:16, type:"one-way",  avg:350,  low:280,  high:420  },
  { from:"gravesend",  to:"heathrow",      pax:16, type:"one-way",  avg:310,  low:250,  high:380  },
  { from:"chatham",    to:"london",        pax:16, type:"one-way",  avg:380,  low:300,  high:450  },
  { from:"canterbury", to:"london",        pax:16, type:"one-way",  avg:450,  low:380,  high:550  },
  { from:"birmingham", to:"coventry",      pax:16, type:"return",   avg:331,  low:280,  high:400  },
  { from:"birmingham", to:"coventry",      pax:16, type:"return",   avg:433,  low:370,  high:500,  note:"luxury" },
  { from:"birmingham", to:"northampton",   pax:16, type:"return",   avg:383,  low:320,  high:430  },
  { from:"birmingham", to:"stoke",         pax:16, type:"return",   avg:361,  low:320,  high:420  },
  { from:"birmingham", to:"stoke",         pax:16, type:"return",   avg:474,  low:420,  high:520,  note:"luxury" },
  { from:"birmingham", to:"nottingham",    pax:16, type:"return",   avg:364,  low:320,  high:400  },
  { from:"birmingham", to:"nottingham",    pax:16, type:"return",   avg:491,  low:475,  high:500,  note:"luxury" },
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
  { from:"dartford",   to:"godstone",      miles:45  },
  { from:"dartford",   to:"piccadilly",    miles:25  },
  { from:"dartford",   to:"heathrow",      miles:35  },
  { from:"dartford",   to:"o2",            miles:18  },
  { from:"dartford",   to:"wembley",       miles:30  },
  { from:"dartford",   to:"gatwick",       miles:45  },
  { from:"dartford",   to:"luton",         miles:55  },
  { from:"dartford",   to:"stansted",      miles:50  },
  { from:"dartford",   to:"birmingham",    miles:120 },
  { from:"dartford",   to:"manchester",    miles:220 },
  { from:"dartford",   to:"brighton",      miles:70  },
  { from:"dartford",   to:"cambridge",     miles:75  },
  { from:"bromley",    to:"heathrow",      miles:28  },
  { from:"bromley",    to:"o2",            miles:14  },
  { from:"bromley",    to:"wembley",       miles:25  },
  { from:"bromley",    to:"gatwick",       miles:22  },
  { from:"bromley",    to:"luton",         miles:48  },
  { from:"bromley",    to:"stansted",      miles:45  },
  { from:"bromley",    to:"birmingham",    miles:115 },
  { from:"bromley",    to:"manchester",    miles:215 },
  { from:"bromley",    to:"brighton",      miles:50  },
  { from:"maidstone",  to:"london",        miles:35  },
  { from:"maidstone",  to:"heathrow",      miles:55  },
  { from:"maidstone",  to:"gatwick",       miles:35  },
  { from:"maidstone",  to:"wembley",       miles:50  },
  { from:"gravesend",  to:"london",        miles:25  },
  { from:"gravesend",  to:"heathrow",      miles:40  },
  { from:"chatham",    to:"london",        miles:35  },
  { from:"chatham",    to:"heathrow",      miles:55  },
  { from:"chatham",    to:"wembley",       miles:50  },
  { from:"canterbury", to:"london",        miles:60  },
  { from:"canterbury", to:"heathrow",      miles:80  },
  { from:"sevenoaks",  to:"london",        miles:25  },
  { from:"sevenoaks",  to:"heathrow",      miles:30  },
  { from:"tunbridge",  to:"london",        miles:35  },
  { from:"tunbridge",  to:"heathrow",      miles:50  },
  { from:"folkestone", to:"london",        miles:75  },
  { from:"dover",      to:"london",        miles:80  },
  { from:"dover",      to:"heathrow",      miles:95  },
  { from:"ashford",    to:"london",        miles:60  },
  { from:"ashford",    to:"heathrow",      miles:75  },
  { from:"aylesbury",  to:"london",        miles:45  },
  { from:"aylesbury",  to:"heathrow",      miles:35  },
  { from:"aylesbury",  to:"wembley",       miles:40  },
  { from:"oxford",     to:"heathrow",      miles:45  },
  { from:"oxford",     to:"wembley",       miles:55  },
  { from:"oxford",     to:"birmingham",    miles:65  },
  { from:"highwycombe",to:"london",        miles:30  },
  { from:"highwycombe",to:"heathrow",      miles:20  },
  { from:"eltham",     to:"o2",            miles:5   },
  { from:"eltham",     to:"wembley",       miles:20  },
  { from:"lewisham",   to:"wembley",       miles:18  },
  { from:"greenwich",  to:"heathrow",      miles:22  },
  { from:"woolwich",   to:"heathrow",      miles:20  },
  { from:"sidcup",     to:"heathrow",      miles:25  },
  { from:"bexleyheath",to:"heathrow",      miles:25  },
  { from:"bexley",     to:"heathrow",      miles:25  },
  { from:"erith",      to:"heathrow",      miles:28  },
  { from:"thamesmead", to:"heathrow",      miles:22  },
  { from:"birmingham", to:"coventry",      miles:20  },
  { from:"birmingham", to:"northampton",   miles:45  },
  { from:"birmingham", to:"stoke",         miles:40  },
  { from:"birmingham", to:"nottingham",    miles:50  },
  { from:"birmingham", to:"wolverhampton", miles:15  },
  { from:"birmingham", to:"derby",         miles:40  },
  { from:"birmingham", to:"leicester",     miles:40  },
  { from:"birmingham", to:"stratford",     miles:25  },
  { from:"birmingham", to:"cheltenham",    miles:45  },
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

// UK Events Calendar - dates that affect demand
const UK_EVENTS = [
  { month:0,  day:1,  name:"New Year's Day", advice:"Price higher — very high demand", uplift:20 },
  { month:2,  day:14, name:"Cheltenham Festival", advice:"Price higher near Cheltenham — race day surge", uplift:15 },
  { month:3,  day:4,  name:"Grand National", advice:"Price higher near Liverpool — race day surge", uplift:15 },
  { month:4,  day:25, name:"FA Cup Final", advice:"Price higher for Wembley jobs — FA Cup Final", uplift:15 },
  { month:5,  day:20, name:"Glastonbury Festival", advice:"Price higher for Somerset/Bristol routes — Glastonbury", uplift:20 },
  { month:6,  day:1,  name:"Wimbledon", advice:"Price higher for SW London — Wimbledon fortnight", uplift:15 },
  { month:7,  day:23, name:"Notting Hill Carnival", advice:"Price higher for West London — Notting Hill Carnival weekend", uplift:20 },
  { month:10, day:5,  name:"Bonfire Night", advice:"Evening jobs price higher — Bonfire Night demand", uplift:10 },
  { month:11, day:20, name:"Christmas Period", advice:"Price higher — Christmas party season peak", uplift:15 },
  { month:11, day:31, name:"New Year's Eve", advice:"Price significantly higher — New Year's Eve, highest demand night of year", uplift:25 },
];

const getEventAlert = (dateStr) => {
  if (!dateStr) return null;
  const dt = new Date(dateStr);
  const m = dt.getMonth(), d = dt.getDate();
  for (const ev of UK_EVENTS) {
    if (ev.month === m && Math.abs(ev.day - d) <= 2) {
      return { name: ev.name, advice: ev.advice, uplift: ev.uplift };
    }
  }
  return null;
};

const getDayAdvice = (dateStr) => {
  if (!dateStr) return null;
  const day = new Date(dateStr).getDay(); // 0=Sun, 5=Fri, 6=Sat
  if (day === 5) return { advice: "Friday — popular booking day, consider pricing 5-10% higher", type: "peak" };
  if (day === 6) return { advice: "Saturday — highest demand day of the week, price confidently", type: "peak" };
  if (day === 0) return { advice: "Sunday — popular for day trips and events, good demand", type: "peak" };
  if (day === 1) return { advice: "Monday — quieter day, consider competitive pricing to secure the booking", type: "quiet" };
  if (day === 2) return { advice: "Tuesday — quieter mid-week, competitive pricing recommended", type: "quiet" };
  if (day === 3) return { advice: "Wednesday — mid-week, standard pricing", type: "normal" };
  if (day === 4) return { advice: "Thursday — demand picks up towards weekend, standard pricing", type: "normal" };
  return null;
};

const getMonthAdvice = (dateStr) => {
  if (!dateStr) return null;
  const m = new Date(dateStr).getMonth();
  if (m === 0)  return { advice: "January — very quiet period. Consider pricing 10-15% lower to secure bookings.", type: "quiet" };
  if (m === 1)  return { advice: "February — quiet month. Competitive pricing recommended to win jobs.", type: "quiet" };
  if (m === 4)  return { advice: "May — bank holidays and wedding season starting. Good demand.", type: "peak" };
  if (m === 5)  return { advice: "June — peak summer season. Price confidently, demand is high.", type: "peak" };
  if (m === 6)  return { advice: "July — peak summer season. High demand, price at upper end.", type: "peak" };
  if (m === 7)  return { advice: "August — peak season. Highest demand of the year, price accordingly.", type: "peak" };
  if (m === 8)  return { advice: "September — post-summer slowdown. Monitor demand carefully.", type: "normal" };
  if (m === 10) return { advice: "November — quieter period. Consider competitive pricing to secure bookings.", type: "quiet" };
  if (m === 11) return { advice: "December — Christmas party season. Very high demand, price higher.", type: "peak" };
  return null;
};

const isBusy = (d) => {
  if (!d) return null;
  const dt = new Date(d), m = dt.getMonth(), day = dt.getDate();
  if (m === 11 && day >= 20) return "Christmas period — high demand, price 15% higher";
  if (m === 0  && day <= 3)  return "New Year period — high demand, price higher";
  if (m === 5)               return "June — peak season, consider 10% uplift";
  if (m === 6)               return "July — peak season, consider 10% uplift";
  if (m === 7)               return "August — peak season, high demand, consider 10% uplift";
  if (m === 3 && day <= 14)  return "Easter period — high demand, price 10% higher";
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

const buildPrompt = (from, to, pax, date, time, trip, retDate, retTime, jobs, variation, miles, purpose, isLuxury) => {
  const retLine = trip === "return" ? "\nReturn: " + retDate + " " + retTime : "";
  const varLine = variation === "higher" ? "\nPrice 10% HIGHER." : variation === "lower" ? "\nPrice 10% LOWER." : "";
  const luxLine = isLuxury ? "\nVEHICLE TYPE: LUXURY — price 25-35% higher than standard. Customer has specifically requested luxury vehicle." : "\nVEHICLE TYPE: STANDARD";
  const milesLine = miles ? "\nKnown miles: " + miles : "";
  const hist = jobs.length > 0
    ? "\nOperator past jobs: " + jobs.slice(0, 8).map(j => j.from + "->" + j.to + " " + j.pax + "pax=£" + j.actual).join(", ")
    : "";
  return "UK minibus hire pricing expert. Price at UPPER end of market rate.\n" +
    "PURPOSE PREMIUMS — apply on top of base price: Stag Do +15%, Hen Do +15%, Festival +20%, Night Out +15%, Football +15%, Rugby +15%, Horse Racing +15%, Concert +15%, Corporate/Business +20%, School Prom +15%, Golf Day +10%, Birthday Party +10%. Wedding/Funeral/Airport/Cruise/Day Trip/Educational/Charity/School Trip = standard rate, no premium.\n" +
    "SEASONAL PREMIUMS: June/July/August = high season add 10%. December = Christmas period add 15%. Easter weekend add 10%.\n" + +
    "Real market data: Birmingham-Coventry 16pax return avg £331 standard/£433 luxury. Birmingham-Stoke 16pax return avg £361 standard/£474 luxury. Birmingham-Nottingham 16pax return avg £364 standard/£491 luxury. Birmingham-Northampton 16pax return avg £383. Luxury 16-seater commands 25-35% premium over standard. Dartford-Godstone 50pax return avg £825 (£700-£900). Heathrow-Walworth 12pax one-way avg £242. Heathrow-Walworth 18pax one-way avg £461. SE12-O2 15pax return avg £312. London-Luton 13pax one-way avg £270. London-Gatwick 16pax one-way avg £253. Dartford-Piccadilly 13pax one-way avg £394. Bromley-Heathrow 16pax one-way avg £280. Maidstone-London 16pax one-way avg £350. Canterbury-London 16pax one-way avg £450. Birmingham-Manchester 16pax return £583, 30pax return £783. " +
    "Hackney-Luton 23pax return £1194. Manchester-Leeds 30pax return £728, 16pax return £350. " +
    "Reading-Birmingham 30pax return £952. Brixton-Windsor 16pax return £510. " +
    "Peckham-Heathrow 14pax one-way £470. London-Stansted 12pax one-way £275. " +
    "London-Wembley 16pax return £400. London-O2 16pax return £450.\n" +
    "Return same day = driving both ways + full waiting time. Airport transfer different day = two one-way trips, no accommodation.\n\n" +
    "From: " + from + "\nTo: " + to + "\nPassengers: " + pax + (purpose ? "\nPurpose: " + purpose : "") +
    "\nDate: " + date + " " + time + "\nTrip: " + trip + retLine + milesLine + hist + varLine + luxLine + "\n\n" +
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
  const [isReg,      setIsReg]      = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [eventAlert,  setEventAlert]  = useState(null);
  const [shareMsg,    setShareMsg]    = useState("");
  const [quoteId,     setQuoteId]     = useState(null);
  const [quoteCopied, setQuoteCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLink,   setShareLink]   = useState("");
  const [linkCopied,  setLinkCopied]  = useState(false);
  const [dayAdvice,   setDayAdvice]   = useState(null);
  const [monthAdvice, setMonthAdvice] = useState(null);
  const [purpose,    setPurpose]    = useState("");
  const [isOwnerDriver, setIsOwnerDriver] = useState(false);
  const [isLuxury,     setIsLuxury]     = useState(false);
  const [operatorPrice, setOperatorPrice] = useState("");
  const [priceFeedback, setPriceFeedback] = useState("");
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
          messages: [{ role:"user", content: buildPrompt(from,to,pax,date,time,trip,retDate,retTime,jobs,variation,manualMiles,purpose,isLuxury) }]
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
    setError(""); setResult(null); setLogged(false); setIsReg(false); setLoading(true);
    try {
      const res = await callAPI(variation || "normal");
      setResult(res);
      try { await supabase.from("quotes").insert({ from_location:from, to_location:to, passengers:parseInt(pax), trip_type:trip, ai_price:res.price }); } catch(se) {}
    }
    catch(e) { setError(e.name === "AbortError" ? "Timed out. Please try again." : "Error: " + e.message); }
    setLoading(false);
  };

  const logJob = async (outcome) => {
    const actual = outcome === "unhappy" && operatorPrice ? parseInt(operatorPrice) : result.price;
    setJobs(prev => [{ id:Date.now(), from, to, pax, trip, date, aiPrice:result.price, actual, outcome }, ...prev]);
    setLogged(true);
    try {
      await supabase.from("job_logs").insert({
        from_location:from, to_location:to,
        passengers:parseInt(pax), trip_type:trip,
        ai_price:result.price, actual_price:actual,
        outcome, notes: purpose || null
      });
    } catch(se) {}
  };

  const copyWA = () => {
    navigator.clipboard.writeText(waMsg(from, to, pax, date, displayPrice, result.vehicle));
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  const copyShareApp = () => {
    const msg = "Hi, thought you'd find this useful — it's a free tool that shows you what customers are actually willing to pay for minibus and coach jobs in your area. No more guessing. Worth a look: https://pricepilot-eight.vercel.app";
    navigator.clipboard.writeText(msg);
    setShareCopied(true); setTimeout(() => setShareCopied(false), 2500);
  };

  const copyQuoteLink = () => {
    const link = "https://pricepilot-eight.vercel.app?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to) + "&pax=" + pax + "&price=" + displayPrice + "&vehicle=" + encodeURIComponent(result.vehicle || "");
    const msg = "Hi, I checked what customers are willing to pay for this job:\n\n" +
      "Route: " + from + " to " + to + "\n" +
      "Passengers: " + pax + "\n" +
      "Customer willing to pay: " + fmt(displayPrice) + "\n\n" +
      "Full breakdown here: " + link + "\n\n" +
      "PricePilot shows you what customers actually pay for minibus and coach hire — worth trying for free: https://pricepilot-eight.vercel.app";
    navigator.clipboard.writeText(msg);
    setQuoteCopied(true); setTimeout(() => setQuoteCopied(false), 2500);
  };

  const shareApp = () => {
    const msg = "Hi, found this free pricing tool for minibus and coach operators. Gives you an instant market rate price for any job — really useful for quoting. Worth trying: pricepilot-eight.vercel.app";
    navigator.clipboard.writeText(msg);
    setShareMsg("Copied! Paste into WhatsApp and send to other operators.");
    setTimeout(() => setShareMsg(""), 3000);
  };

  const shareQuote = async () => {
    if (!result) return;
    try {
      const { data, error } = await supabase.from("quotes").insert({
        from_location: from, to_location: to,
        passengers: parseInt(pax), trip_type: trip,
        ai_price: displayPrice
      }).select();
      if (data && data[0]) {
        const link = window.location.origin + "?quote=" + data[0].id;
        setShareLink(link);
        navigator.clipboard.writeText(
          "Hi, I have a job I need cover for. Here are the details and a suggested price — let me know if you can help: " + link
        );
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 3000);
      }
    } catch(e) {
      // Fallback - just copy the details as text
      const msg = "Job details: " + from + " to " + to + " | " + pax + " passengers | " + trip + " | Suggested price: " + fmt(displayPrice);
      navigator.clipboard.writeText(msg);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    }
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

  // Best conversion price — price most likely to win the job
  // Based on market data: slightly below market average but above floor
  // Adjusts for day of week and season
  const conversionPrice = (() => {
    if (!result) return 0;
    const base = displayPrice;
    const dow = date ? new Date(date).getDay() : 3;
    const month = date ? new Date(date).getMonth() : 6;
    // On quiet days price slightly lower to win job
    const dayFactor = (dow === 1 || dow === 2) ? 0.92 : (dow === 5 || dow === 6) ? 1.0 : 0.95;
    // On quiet months price lower
    const monthFactor = (month === 0 || month === 1 || month === 10) ? 0.90 : (month === 5 || month === 6 || month === 7 || month === 11) ? 1.0 : 0.95;
    const conv = Math.round(base * dayFactor * monthFactor / 5) * 5;
    return Math.max(conv, Math.round(base * 0.85));
  })();

  // Maximum price — upper end for premium days/jobs
  const maxPrice = (() => {
    if (!result) return 0;
    return Math.round(result.high * (isReg ? 0.9 : 1.0));
  })();
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
  const driverCost    = isOwnerDriver ? 0 : Math.max(MIN_DRIVER_PAY, Math.round(driverHours * DRIVER_RATE));
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

      {/* ── Header ── */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:26, fontWeight:800, color:"#f59e0b", letterSpacing:"-0.5px" }}>PricePilot</div>
        <div style={{ fontSize:13, color:"#7d8590", marginBottom:12 }}>Know What Customers Will Pay</div>

        <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:10, padding:"14px 16px", marginBottom:4 }}>
          <div style={{ fontSize:14, color:"#e6edf3", fontWeight:600, marginBottom:6 }}>
            Find out what customers are willing to pay for any minibus or coach job
          </div>
          <div style={{ fontSize:12, color:"#7d8590", marginBottom:12 }}>
            Stop guessing what customers will pay — PricePilot tells you.
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ fontSize:12, color:"#7d8590", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:"#f59e0b", fontWeight:700 }}>1</span>
              <span>Enter your route, passengers and trip details</span>
            </div>
            <div style={{ fontSize:12, color:"#7d8590", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:"#f59e0b", fontWeight:700 }}>2</span>
              <span>See what customers in your area are willing to pay</span>
            </div>
            <div style={{ fontSize:12, color:"#7d8590", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:"#f59e0b", fontWeight:700 }}>3</span>
              <span>Quote confidently — knowing you're pricing right</span>
            </div>
          </div>
          <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid #21262d" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#4ade80", marginBottom:4 }}>Your customers are safe</div>
            <div style={{ fontSize:11, color:"#484f58", lineHeight:1.5 }}>
              We never ask for customer names, phone numbers or email addresses. 
              We do not contact your customers. We do not store any customer personal information. 
              PricePilot only uses anonymous route and pricing data to show you what customers pay — nothing else.
            </div>
          </div>
        </div>
      </div>

      {/* ── Shared Quote Banner ── */}
      {(() => {
        const params = new URLSearchParams(window.location.search);
        const sharedFrom = params.get("from");
        const sharedTo = params.get("to");
        const sharedPax = params.get("pax");
        const sharedPrice = params.get("price");
        const sharedVehicle = params.get("vehicle");
        if (!sharedFrom || !sharedTo || !sharedPrice) return null;
        return (
          <div style={{ background:"#1e3a5f", border:"1px solid #2563eb44", borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ fontSize:11, color:"#60a5fa", textTransform:"uppercase", letterSpacing:"1px", marginBottom:8, fontWeight:700 }}>Shared Quote</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#f0f6fc", marginBottom:6 }}>
              {sharedFrom} <span style={{ color:"#484f58" }}>→</span> {sharedTo}
            </div>
            <div style={{ fontSize:13, color:"#7d8590", marginBottom:12 }}>
              {sharedPax} passengers · {sharedVehicle}
            </div>
            <div style={{ fontSize:32, fontWeight:800, color:"#60a5fa", letterSpacing:"-1px", marginBottom:8 }}>
              {fmt(parseInt(sharedPrice))}
            </div>
            <div style={{ fontSize:12, color:"#484f58", marginBottom:12 }}>Market rate price generated by PricePilot</div>
            <button
              onClick={() => { setFrom(sharedFrom); setTo(sharedTo); setPax(sharedPax); }}
              style={{ padding:"10px 16px", background:"#2563eb", border:"none", borderRadius:7, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}
            >
              Get my own price for this job
            </button>
          </div>
        );
      })()}

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
                    onClick={async () => {
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
                <div style={{ fontSize:11, color:"#484f58", marginTop:12, textAlign:"center" }}>Takes 60 seconds · No customer data required · 100% anonymous</div>
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
                    onClick={async () => {
                      if (!surveyInput) return;
                      const updated = [...surveyAnswers, { ...surveyTrips[surveyStep], price: parseInt(surveyInput) }];
                      setSurveyAnswers(updated);
                      setSurveyInput("");
                      // Save to Supabase
                      try {
                        await supabase.from("survey_answers").insert({
                          operator_base: operatorBase,
                          vehicle_size: operatorVehicle,
                          from_location: surveyTrips[surveyStep].from,
                          to_location: surveyTrips[surveyStep].to,
                          passengers: surveyTrips[surveyStep].pax,
                          trip_type: surveyTrips[surveyStep].type,
                          quoted_price: parseInt(surveyInput)
                        });
                      } catch(e) { console.log("Survey save error:", e); }
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
          <div><Lbl>Trip purpose</Lbl>
            <select style={I} value={purpose} onChange={e => setPurpose(e.target.value)}>
              <option value="">General / Not specified</option>
              <option value="airport">Airport transfer</option>
              <option value="cruise">Airport / Cruise port transfer</option>
              <option value="corporate">Business / Corporate</option>
              <option value="day_trip">Day Trip</option>
              <option value="wedding">Wedding</option>
              <option value="funeral">Funeral</option>
              <option value="stag">Stag Do</option>
              <option value="hen">Hen Do</option>
              <option value="birthday">Birthday Party</option>
              <option value="night_out">Night Out</option>
              <option value="festival">Festival</option>
              <option value="football">Football Match</option>
              <option value="rugby">Rugby Match</option>
              <option value="horse_racing">Horse Racing</option>
              <option value="golf">Golf Day</option>
              <option value="other_sport">Other Sport Event</option>
              <option value="concert">Concert</option>
              <option value="theme_park">Theme Park</option>
              <option value="school_trip">School Trip</option>
              <option value="school_prom">School Prom</option>
              <option value="educational">Educational</option>
              <option value="charity">Charity</option>
              <option value="holiday">Holiday / Tour</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div><Lbl>Pickup date</Lbl>
            <input style={I} type="date" value={date} onChange={e => {
              setDate(e.target.value);
              setEventAlert(getEventAlert(e.target.value));
              setDayAdvice(getDayAdvice(e.target.value));
              setMonthAdvice(getMonthAdvice(e.target.value));
            }} />
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

        {eventAlert && (
          <div style={{ marginTop:10, padding:"12px 14px", background:"#7c3aed22", border:"1px solid #7c3aed55", borderRadius:7 }}>
            <div style={{ color:"#a78bfa", fontWeight:700, fontSize:12, marginBottom:2 }}>{eventAlert.name} nearby</div>
            <div style={{ color:"#c4b5fd", fontSize:12 }}>{eventAlert.advice}</div>
          </div>
        )}
        {dayAdvice && (
          <div style={{ marginTop:8, padding:"10px 14px", background: dayAdvice.type==="peak" ? "#16a34a22" : dayAdvice.type==="quiet" ? "#f59e0b22" : "#21262d", border: "1px solid " + (dayAdvice.type==="peak" ? "#16a34a55" : dayAdvice.type==="quiet" ? "#f59e0b55" : "#30363d"), borderRadius:7 }}>
            <div style={{ color: dayAdvice.type==="peak" ? "#4ade80" : dayAdvice.type==="quiet" ? "#f59e0b" : "#7d8590", fontSize:12 }}>{dayAdvice.advice}</div>
          </div>
        )}
        {monthAdvice && (
          <div style={{ marginTop:8, padding:"10px 14px", background: monthAdvice.type==="peak" ? "#16a34a22" : monthAdvice.type==="quiet" ? "#ef444422" : "#21262d", border: "1px solid " + (monthAdvice.type==="peak" ? "#16a34a55" : monthAdvice.type==="quiet" ? "#ef444455" : "#30363d"), borderRadius:7 }}>
            <div style={{ color: monthAdvice.type==="peak" ? "#4ade80" : monthAdvice.type==="quiet" ? "#f87171" : "#7d8590", fontSize:12 }}>{monthAdvice.advice}</div>
          </div>
        )}
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

        {/* Privacy reassurance */}
        <div style={{ marginTop:10, padding:"10px 12px", background:"#0d1117", border:"1px solid #21262d", borderRadius:7 }}>
          <div style={{ fontSize:11, color:"#4ade80", fontWeight:700, marginBottom:3 }}>No customer information needed</div>
          <div style={{ fontSize:11, color:"#484f58" }}>
            Do not enter any customer names, numbers or emails. We only need the route and job details - never who the customer is.
          </div>
        </div>

        {/* Vehicle type and owner driver toggles */}
        <div style={{ display:"flex", gap:8, marginTop:12, marginBottom:4, flexWrap:"wrap" }}>
          <button
            onClick={() => setIsLuxury(!isLuxury)}
            style={{ padding:"8px 14px", background:isLuxury?"#f59e0b":"#21262d", border:"1px solid #30363d", borderRadius:7, color:isLuxury?"#000":"#7d8590", fontWeight:700, fontSize:12, cursor:"pointer" }}
          >
            {isLuxury ? "Luxury Vehicle ✓" : "Luxury Vehicle?"}
          </button>
          <button
            onClick={() => setIsOwnerDriver(!isOwnerDriver)}
            style={{ padding:"8px 14px", background:isOwnerDriver?"#7c3aed":"#21262d", border:"1px solid #30363d", borderRadius:7, color:isOwnerDriver?"#fff":"#7d8590", fontWeight:700, fontSize:12, cursor:"pointer" }}
          >
            {isOwnerDriver ? "Owner-Driver ✓" : "Owner-Driver?"}
          </button>
        </div>
        <div style={{ fontSize:11, color:"#484f58", marginBottom:4 }}>
          {isLuxury ? "Luxury pricing applied - premium vehicles command 25-35% more" : "Standard vehicle pricing"}
          {isOwnerDriver ? " · Owner-driver: no driver wage" : ""}
        </div>

        <button onClick={() => getPrice("normal")} disabled={loading}
          style={{ width:"100%", marginTop:16, padding:13, background:loading?"#333":"#f59e0b", border:"none", borderRadius:8, fontSize:15, fontWeight:700, color:loading?"#777":"#000", cursor:loading?"not-allowed":"pointer" }}>
          {loading ? "Calculating..." : "Get Price"}
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div style={C}>

          {/* New / Regular / Luxury toggle */}
          <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
            <button onClick={() => setIsReg(false)} style={{ flex:1, padding:8, borderRadius:7, border:"none", fontWeight:700, fontSize:13, cursor:"pointer", background:!isReg?"#f59e0b":"#21262d", color:!isReg?"#000":"#7d8590" }}>New Customer</button>
            <button onClick={() => setIsReg(true)}  style={{ flex:1, padding:8, borderRadius:7, border:"none", fontWeight:700, fontSize:13, cursor:"pointer", background:isReg?"#7c3aed":"#21262d",  color:isReg?"#fff":"#7d8590"  }}>Regular (10% off)</button>
          </div>

          {/* ── Three price display ── */}
          <div style={{ marginBottom:16 }}>

            {/* Main price - Best conversion */}
            <div style={{ background:"#0d1117", borderRadius:10, padding:16, marginBottom:10, border:"1px solid #16a34a44" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <div style={{ fontSize:11, color:"#4ade80", textTransform:"uppercase", letterSpacing:"0.5px", fontWeight:700 }}>Best Conversion Price</div>
                <div style={{ fontSize:10, color:"#484f58", background:"#16a34a22", padding:"2px 8px", borderRadius:10 }}>Most likely to win the job</div>
              </div>
              <div style={{ fontSize:44, fontWeight:800, color:"#4ade80", letterSpacing:"-2px", lineHeight:1 }}>
                {fmt(conversionPrice)}
              </div>
              <div style={{ fontSize:12, color:"#484f58", marginTop:4 }}>
                Estimated best price to close the deal — based on market data and demand
              </div>
              <div style={{ fontSize:11, color:"#484f58", marginTop:2, fontStyle:"italic" }}>
                Improves as more operators log outcomes
              </div>
            </div>

            {/* Two columns - Market rate and Max price */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>

              {/* Market rate */}
              <div style={{ background:"#0d1117", borderRadius:8, padding:14 }}>
                <div style={{ fontSize:10, color:"#7d8590", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>Market Rate</div>
                <div style={{ fontSize:26, fontWeight:800, color:"#60a5fa", letterSpacing:"-1px" }}>{fmt(displayPrice)}</div>
                <div style={{ fontSize:10, color:"#484f58", marginTop:2 }}>What operators typically charge</div>
                {isReg && <div style={{ fontSize:10, color:"#a78bfa", marginTop:2 }}>Loyalty -10% applied</div>}
              </div>

              {/* Maximum price */}
              <div style={{ background:"#0d1117", borderRadius:8, padding:14 }}>
                <div style={{ fontSize:10, color:"#7d8590", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>Maximum Price</div>
                <div style={{ fontSize:26, fontWeight:800, color:"#f59e0b", letterSpacing:"-1px" }}>{fmt(maxPrice)}</div>
                <div style={{ fontSize:11, color:"#484f58", marginTop:2 }}>{fmt(result.low)} – {fmt(result.high)}</div>
                <div style={{ fontSize:10, color:"#484f58", marginTop:2 }}>For peak days or premium jobs</div>
              </div>
            </div>

            {/* Your average if available */}
            {myAvgPrice && (
              <div style={{ background:"#0d1117", borderRadius:8, padding:12, border:"1px solid #21262d" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:10, color:"#7d8590", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:2 }}>Your Average</div>
                    <div style={{ fontSize:20, fontWeight:800, color:"#a78bfa" }}>{fmt(myAvgPrice)}</div>
                  </div>
                  <div style={{ fontSize:11, color:"#484f58", textAlign:"right" }}>
                    From {similarJobs.length} similar<br/>job{similarJobs.length > 1 ? "s" : ""} you logged
                  </div>
                </div>
              </div>
            )}

            {/* Market data note */}
            {marketMatch && (
              <div style={{ fontSize:11, color:"#484f58", marginTop:8, textAlign:"center" }}>
                Market data: {fmt(marketMatch.low)} – {fmt(marketMatch.high)} · {fmt(marketMatch.avg)} avg
              </div>
            )}
          </div>

          {/* Re-quote buttons */}
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            <button onClick={() => getPrice("higher")} disabled={loading} style={{ flex:1, padding:8, background:"#21262d", border:"1px solid #30363d", borderRadius:7, color:"#4ade80", fontWeight:700, fontSize:12, cursor:"pointer" }}>Quote Higher</button>
            <button onClick={() => getPrice("normal")} disabled={loading} style={{ flex:1, padding:8, background:"#21262d", border:"1px solid #30363d", borderRadius:7, color:"#7d8590", fontWeight:700, fontSize:12, cursor:"pointer" }}>Refresh</button>
            <button onClick={() => getPrice("lower")}  disabled={loading} style={{ flex:1, padding:8, background:"#21262d", border:"1px solid #30363d", borderRadius:7, color:"#f87171", fontWeight:700, fontSize:12, cursor:"pointer" }}>Quote Lower</button>
          </div>

          {/* Chips */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
            <Chip label="VEHICLE" value={result.vehicle + (isLuxury ? " (Luxury)" : "")} color={isLuxury ? "#f59e0b" : undefined} />
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

          {/* Simplified Job Logger */}
          <div style={{ borderTop:"1px solid #21262d", paddingTop:16 }}>
            {!logged ? (
              <>
                <div style={{ fontSize:13, fontWeight:700, color:"#f0f6fc", marginBottom:4 }}>Happy with this price to send to the customer?</div>
                <div style={{ fontSize:12, color:"#484f58", marginBottom:12 }}>Your feedback helps improve accuracy for everyone.</div>
                <div style={{ display:"flex", gap:10, marginBottom:12 }}>
                  <button
                    onClick={() => { setPriceFeedback("happy"); logJob("happy"); }}
                    style={{ flex:1, padding:11, background:"#16a34a", border:"none", borderRadius:7, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}
                  >
                    Yes — sending it ✓
                  </button>
                  <button
                    onClick={() => setPriceFeedback("unhappy")}
                    style={{ flex:1, padding:11, background:"#21262d", border:"1px solid #30363d", borderRadius:7, color:"#f87171", fontWeight:700, fontSize:13, cursor:"pointer" }}
                  >
                    No — too high / low
                  </button>
                </div>

                {priceFeedback === "unhappy" && (
                  <div style={{ background:"#0d1117", borderRadius:8, padding:14, marginBottom:10 }}>
                    <div style={{ fontSize:13, color:"#f0f6fc", marginBottom:8, fontWeight:600 }}>What would you charge for this job?</div>
                    <div style={{ fontSize:12, color:"#484f58", marginBottom:10 }}>Your price helps us improve the AI for this route.</div>
                    <input
                      style={{ ...I, marginBottom:10, fontSize:16, fontWeight:700 }}
                      type="number"
                      placeholder="e.g. 650"
                      value={operatorPrice}
                      onChange={e => setOperatorPrice(e.target.value)}
                    />
                    <button
                      onClick={() => { if(operatorPrice) logJob("unhappy"); }}
                      style={{ width:"100%", padding:10, background:operatorPrice?"#f59e0b":"#333", border:"none", borderRadius:7, color:operatorPrice?"#000":"#777", fontWeight:700, fontSize:13, cursor:"pointer" }}
                    >
                      Submit my price
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ background:"#16a34a22", border:"1px solid #16a34a55", color:"#4ade80", borderRadius:8, padding:12, textAlign:"center", fontSize:14, fontWeight:600 }}>
                Thank you! Your feedback improves pricing for everyone.
              </div>
            )}
          </div>

          <div style={{ fontSize:11, color:"#484f58", marginTop:14, textAlign:"center" }}>
            AI suggestion only — use your own judgement before quoting.
          </div>

          {/* Share buttons */}
          <div style={{ borderTop:"1px solid #21262d", paddingTop:16, marginTop:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#f0f6fc", marginBottom:4 }}>Share what customers will pay</div>
            <div style={{ fontSize:12, color:"#484f58", marginBottom:12 }}>Send this to another operator — show them what customers pay for this job</div>
            <button onClick={copyQuoteLink}
              style={{ width:"100%", padding:11, background:quoteCopied?"#16a34a":"#1e3a5f", border:"1px solid #2563eb44", borderRadius:8, color:quoteCopied?"#fff":"#60a5fa", fontWeight:700, fontSize:13, cursor:"pointer", marginBottom:8 }}>
              {quoteCopied ? "Copied! Paste into WhatsApp" : "Share this quote with an operator"}
            </button>
            <div style={{ fontSize:12, color:"#484f58", marginBottom:12, marginTop:4, textAlign:"center" }}>or</div>
            <button onClick={copyShareApp}
              style={{ width:"100%", padding:11, background:shareCopied?"#16a34a":"#21262d", border:"1px solid #30363d", borderRadius:8, color:shareCopied?"#fff":"#7d8590", fontWeight:700, fontSize:13, cursor:"pointer" }}>
              {shareCopied ? "Copied! Paste into WhatsApp" : "Recommend PricePilot to another operator"}
            </button>
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

      {/* ── Privacy Statement ── */}
      <div style={{ background:"#0d1117", border:"1px solid #21262d", borderRadius:10, padding:"14px 16px", marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#4ade80", marginBottom:6 }}>Your customers are always protected</div>
        <div style={{ fontSize:11, color:"#484f58", lineHeight:1.6 }}>
          PricePilot does not ask for, store or use any customer personal information. 
          No names. No phone numbers. No email addresses. We never contact your customers. 
          We only collect anonymous route and pricing data to show operators what customers are willing to pay. 
          Your customer relationships remain 100% yours.
        </div>
      </div>

      {/* ── Share PricePilot Footer ── */}
      <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:20, marginBottom:16, textAlign:"center" }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#f0f6fc", marginBottom:4 }}>Know another operator who's tired of guessing?</div>
        <div style={{ fontSize:12, color:"#7d8590", marginBottom:12 }}>Share PricePilot — the more operators who use it, the more accurately we can show what customers actually pay.</div>
        <button onClick={copyShareApp}
          style={{ padding:"10px 20px", background:shareCopied?"#16a34a":"#f59e0b", border:"none", borderRadius:8, color:shareCopied?"#fff":"#000", fontWeight:700, fontSize:13, cursor:"pointer" }}>
          {shareCopied ? "Copied! Paste into WhatsApp" : "Share with another operator"}
        </button>
      </div>

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
