import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, Alert, StyleSheet, useColorScheme, Modal, Clipboard, StatusBar, KeyboardAvoidingView, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

const KEY = "budget-v1";
const SERIF = Platform.select({ ios: "Georgia", default: "serif" });
const LIGHT = { bg: "#f7f3ec", card: "#fffdf8", text: "#241c14", mute: "#7d7265", line: "#e8ddc9", accent: "#2e2117", gold: "#c9a227", on: "#f8f4ea", ok: "#2f7a52", okT: "#e2f0e7", warn: "#9c6a1f", warnT: "#f6ecd6", bad: "#a23b3b", badT: "#f5e1de", track: "#ece3d2" };
const DARK = { bg: "#15110c", card: "#201810", text: "#f3ece0", mute: "#a89a86", line: "#30271c", accent: "#caa46b", gold: "#e6c468", on: "#161008", ok: "#6fc196", okT: "#15291f", warn: "#e3b765", warnT: "#332712", bad: "#ef8a84", badT: "#3a1d1b", track: "#2b2318" };
const CATS = [["Rent", 26], ["Electricity", 4], ["Water", 2], ["Repairs", 3], ["Miscellaneous", 4], ["Dry groceries", 8], ["Meat", 6], ["Vegetables", 4], ["Savings", 9], ["Subscriptions", 2], ["Black tax", 8], ["Fuel", 5], ["Personal care / Grooming", 3], ["Entertainment", 4], ["Travel and gifts", 4], ["License", 3], ["Insurance", 5]];
const PALETTE = ["#c9a227", "#5b4636", "#7c8471", "#8a3b3b", "#355070", "#6b705c", "#b56576", "#495057", "#9a6a3c", "#3c6e5c"];
const DEF = { name: "", income: 0, expenses: [], limits: {}, lastSeenMonth: "" };

const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDate(new Date());
const monthKey = (s) => (s || today()).slice(0, 7);
const CM = monthKey(today());
const m = (n) => "$" + (Math.round(n * 100) / 100).toLocaleString();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const num = (v) => parseFloat(String(v || "").replace(",", ".")) || 0;

export default function App() {
  return <SafeAreaProvider><Budget /></SafeAreaProvider>;
}

function Budget() {
  const dark = useColorScheme() === "dark";
  const t = dark ? DARK : LIGHT;
  const [S, setS] = useState(DEF);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("overview");
  const [drawer, setDrawer] = useState(false);
  const [coffee, setCoffee] = useState(false);
  const [onboardName, setOnboardName] = useState("");
  const [cat, setCat] = useState("Rent");
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [chartMode, setChartMode] = useState("week");

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) setS((s) => ({ ...s, ...JSON.parse(v) })); }).catch(() => {}).finally(() => setReady(true));
  }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEY, JSON.stringify(S)).catch(() => {}); }, [S, ready]);
  useEffect(() => {
    if (!ready) return;
    if (!S.lastSeenMonth) { setS((s) => ({ ...s, lastSeenMonth: CM })); return; }
    if (S.lastSeenMonth === CM) return;
    const prevKey = S.lastSeenMonth;
    const prevUsed = S.expenses.filter((e) => monthKey(e.date) === prevKey && e.cat !== "Savings").reduce((a, e) => a + e.amt, 0);
    const leftover = Math.round((num(S.income) - prevUsed) * 100) / 100;
    setS((s) => ({ ...s, lastSeenMonth: CM, expenses: leftover > 0 ? [{ id: uid(), cat: "Savings", amt: leftover, note: "Automatic month-end leftover", date: today() }, ...s.expenses] : s.expenses }));
    if (leftover > 0) setTimeout(() => Alert.alert("New month", `${m(leftover)} left over was moved to Savings automatically.`), 400);
  }, [ready]);

  const plan = (c) => +S.limits[c] || 0;
  const spent = (c) => S.expenses.filter((e) => e.cat === c && monthKey(e.date) === CM).reduce((a, e) => a + e.amt, 0);
  const income = num(S.income);
  let planned = 0, used = 0;
  const alerts = [];
  const rows = CATS.map(([c]) => { const L = plan(c), s = spent(c), sv = c === "Savings"; planned += L; used += s;
    let lv = "ok"; if (!sv) { if (s > L && s > 0) lv = "bad"; else if (L > 0 && s / L >= 0.8) lv = "warn"; else if (L === 0) lv = "none"; }
    if (lv === "bad") alerts.push({ k: c, lv: "bad", t: `${c} is over its limit by ${m(s - L)}.` });
    if (lv === "warn") alerts.push({ k: c, lv: "warn", t: `${c} is almost at its limit — ${m(L - s)} left.` });
    return { c, L, s, sv, lv };
  });
  if (income > 0 && used > income) alerts.unshift({ k: "inc", lv: "bad", t: `You've used ${m(used - income)} more than your income.` });
  if (income > 0 && planned > income) alerts.unshift({ k: "plan", lv: "warn", t: `Your limits add up to ${m(planned - income)} more than your income.` });
  else if (income > 0 && planned > 0 && !alerts.length) alerts.push({ k: "ok", lv: "good", t: `You're on track.${planned < income ? ` ${m(income - planned)} not assigned yet.` : ""}` });
  const left = income - used;

  const closeMonthNow = () => {
    const nonSave = CATS.filter(([c]) => c !== "Savings").reduce((a, [c]) => a + spent(c), 0);
    const leftover = Math.round((income - nonSave) * 100) / 100;
    if (leftover <= 0) { Alert.alert("No leftover to move yet."); return; }
    setS((s) => ({ ...s, expenses: [{ id: uid(), cat: "Savings", amt: leftover, note: "Closed early — moved to Savings", date: today() }, ...s.expenses] }));
    Alert.alert("Moved to savings", `${m(leftover)} was moved to Savings.`);
  };
  const addExpense = () => {
    const a = num(amt);
    if (!(a > 0)) { Alert.alert("Enter an amount first."); return; }
    setS((s) => ({ ...s, expenses: [{ id: uid(), cat, amt: a, note: note.trim(), date: today() }, ...s.expenses] }));
    setAmt(""); setNote("");
  };
  const suggest = () => {
    if (!(income > 0)) { Alert.alert("Enter your income first."); return; }
    const go = () => { const l = {}; CATS.forEach(([c, p]) => (l[c] = String(Math.round((income * p) / 100)))); setS((s) => ({ ...s, limits: l })); };
    if (Object.values(S.limits).some((v) => num(v) > 0)) Alert.alert("Replace your limits?", "", [{ text: "Cancel", style: "cancel" }, { text: "Replace", onPress: go }]);
    else go();
  };
  const wipe = () => Alert.alert("Erase all data?", "This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Erase", style: "destructive", onPress: () => setS({ ...DEF, name: S.name, lastSeenMonth: CM }) }]);
  const copyEco = () => { Clipboard.setString("0778600349"); Alert.alert("Copied", "EcoCash number copied — thank you!"); };
  const exportCsv = () => Alert.alert("Export", "CSV export needs a file-saving library in a custom build. Use the web version to export for now.");

  const weekData = () => { const out = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const ds = isoDate(d); const v = S.expenses.filter((e) => e.date === ds && e.cat !== "Savings").reduce((a, e) => a + e.amt, 0); out.push({ l: d.toLocaleDateString(undefined, { weekday: "short" }), v }); } return out; };
  const monthData = () => { const out = []; for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); const mk = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; const v = S.expenses.filter((e) => monthKey(e.date) === mk && e.cat !== "Savings").reduce((a, e) => a + e.amt, 0); out.push({ l: d.toLocaleDateString(undefined, { month: "short" }), v }); } return out; };
  const chartData = chartMode === "week" ? weekData() : monthData();
  const chartMax = Math.max(1, ...chartData.map((d) => d.v));

  const pieRows = CATS.map(([c]) => [c, spent(c)]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);
  const pieTotal = pieRows.reduce((a, x) => a + x[1], 0);

  const card = [st.card, { backgroundColor: t.card, borderColor: t.line }];
  const input = [st.input, { backgroundColor: t.bg, borderColor: t.line, color: t.text }];
  const h2 = (text, c) => <Text style={{ color: c || t.gold, fontSize: 11, fontWeight: "700", letterSpacing: 1.6, marginTop: 20, marginBottom: 10 }}>{text.toUpperCase()}</Text>;
  const rule = <View style={{ width: 30, height: 2, backgroundColor: t.gold, marginVertical: 10 }} />;
  const colFor = (lv) => (lv === "bad" ? t.bad : lv === "warn" ? t.warn : lv === "ok" ? t.ok : t.mute);
  const alertT = (lv) => (lv === "bad" ? t.badT : lv === "warn" ? t.warnT : t.okT);
  const alertC = (lv) => (lv === "bad" ? t.bad : lv === "warn" ? t.warn : t.ok);
  const btn = (key, text, onPress, primary) => (
    <Pressable key={key} onPress={onPress} style={[st.btn, { backgroundColor: primary ? t.accent : "transparent", borderColor: primary ? t.accent : t.line }]}>
      <Text style={{ color: primary ? t.on : t.text, fontWeight: "700", fontSize: 13 }}>{text}</Text>
    </Pressable>
  );

  const overview = () => (
    <View>
      <Text style={{ color: t.gold, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.6 }}>{S.name ? greetWord() + ", " + S.name : "OVERVIEW"}</Text>
      <Text style={[st.h1, { color: t.text }]}>Your budget, at a glance</Text>
      {rule}
      <View style={card}>
        {h2("Income this month")}
        <TextInput style={{ fontFamily: SERIF, fontSize: 26, fontWeight: "700", color: t.text }} value={String(S.income || "")} onChangeText={(v) => setS((s) => ({ ...s, income: num(v) }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.mute} />
        <View style={st.stats}>
          {[["Planned", m(planned)], ["Used", m(used)], ["Left", m(left), left < 0 ? t.bad : t.text]].map(([l, v, c]) => (
            <View key={l} style={[st.stat, { backgroundColor: t.bg }]}><Text style={{ color: t.mute, fontSize: 10, letterSpacing: 0.6, fontWeight: "700" }}>{l.toUpperCase()}</Text><Text style={{ color: c || t.text, fontFamily: SERIF, fontWeight: "700", fontSize: 17, marginTop: 2 }}>{v}</Text></View>
          ))}
        </View>
      </View>

      {h2("Spending overview")}
      <View style={card}>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          {[["week", "Weekly"], ["month", "Monthly"]].map(([k, l]) => (
            <Pressable key={k} onPress={() => setChartMode(k)} style={[st.chip, { backgroundColor: chartMode === k ? t.accent : t.bg, borderColor: chartMode === k ? t.accent : t.line }]}>
              <Text style={{ color: chartMode === k ? t.on : t.mute, fontWeight: "700", fontSize: 12 }}>{l.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 110, gap: 4 }}>
          {chartData.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center" }}>
              {d.v > 0 && <Text style={{ fontSize: 9, color: t.text, fontWeight: "700", marginBottom: 2 }}>{m(d.v).replace(".00", "")}</Text>}
              <View style={{ width: "55%", height: Math.max(3, (d.v / chartMax) * 70), backgroundColor: t.accent, borderRadius: 4 }} />
              <Text style={{ fontSize: 10, color: t.mute, marginTop: 5 }}>{d.l}</Text>
            </View>
          ))}
        </View>
      </View>

      {h2("This month's breakdown")}
      <View style={card}>
        {pieTotal === 0 ? <Text style={{ color: t.mute, fontStyle: "italic" }}>No spending logged yet this month.</Text> : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <Donut rows={pieRows} total={pieTotal} t={t} />
            <View style={{ flex: 1, minWidth: 160, gap: 7 }}>
              {pieRows.map(([c, v], i) => (
                <View key={c} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: PALETTE[i % PALETTE.length] }} />
                  <Text style={{ flex: 1, fontWeight: "600", fontSize: 13, color: t.text }}>{c}</Text>
                  <Text style={{ color: t.mute, fontSize: 12 }}>{m(v)} · {Math.round((v / pieTotal) * 100)}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {alerts.map((a) => (
        <View key={a.k} style={[st.alert, { backgroundColor: alertT(a.lv) }]}><Text style={{ color: alertC(a.lv), fontWeight: "600" }}>{a.t}</Text></View>
      ))}
    </View>
  );

  const budget = () => (
    <View>
      <Text style={[st.h1, { color: t.text }]}>Categories & limits</Text>
      {rule}
      <Pressable onPress={suggest} style={[st.save, { backgroundColor: t.accent, marginBottom: 14 }]}><Text style={{ color: t.on, fontWeight: "700" }}>Suggest limits</Text></Pressable>
      {rows.map((r) => (
        <View key={r.c} style={[...card, { borderLeftWidth: 3, borderLeftColor: colFor(r.lv) }]}>
          <View style={st.row}>
            <Text style={{ color: t.text, fontWeight: "700", fontSize: 15 }}>{r.c}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: t.mute, fontSize: 12 }}>{r.sv ? "Goal" : "Limit"}</Text>
              <TextInput style={[...input, { width: 86, textAlign: "right", paddingVertical: 6 }]} value={String(S.limits[r.c] ?? "")} onChangeText={(v) => setS((s) => ({ ...s, limits: { ...s.limits, [r.c]: num(v) } }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.mute} />
            </View>
          </View>
          <View style={[st.track, { backgroundColor: t.track, marginTop: 10 }]}><View style={{ height: 7, borderRadius: 9, width: `${r.L > 0 ? Math.min(100, (r.s / r.L) * 100) : r.s > 0 ? 100 : 0}%`, backgroundColor: colFor(r.lv) === t.mute ? t.mute : colFor(r.lv) }} /></View>
          <View style={st.row}>
            <Text style={{ color: t.mute, fontSize: 12.5 }}>{m(r.s)} {r.sv ? "saved" : "spent"}</Text>
            <Text style={{ color: r.lv === "ok" || r.lv === "none" ? t.mute : colFor(r.lv), fontWeight: r.lv === "ok" || r.lv === "none" ? "400" : "700", fontSize: 12.5 }}>
              {r.sv ? (r.L > 0 ? (r.s >= r.L ? "Goal reached" : m(r.L - r.s) + " to go") : "Set a goal") : r.L === 0 && r.s === 0 ? "Set a limit" : r.s > r.L ? m(r.s - r.L) + " over" : m(r.L - r.s) + " left"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  const expenses = () => (
    <View>
      <Text style={[st.h1, { color: t.text }]}>Add & review</Text>
      {rule}
      <View style={card}>
        {h2("Add an expense")}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {CATS.map(([c]) => (
            <Pressable key={c} onPress={() => setCat(c)} style={[st.chip2, { borderColor: cat === c ? t.accent : t.line, backgroundColor: cat === c ? t.accent : "transparent" }]}>
              <Text style={{ color: cat === c ? t.on : t.text, fontWeight: "500", fontSize: 13 }}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <TextInput style={input} value={amt} onChangeText={setAmt} keyboardType="decimal-pad" placeholder="Amount" placeholderTextColor={t.mute} />
        <TextInput style={[...input, { marginTop: 8 }]} value={note} onChangeText={setNote} placeholder="Note (optional)" placeholderTextColor={t.mute} maxLength={60} />
        <Pressable onPress={addExpense} style={[st.save, { backgroundColor: t.accent }]}><Text style={{ color: t.on, fontWeight: "700" }}>Add expense</Text></Pressable>
      </View>
      {h2("Recent expenses")}
      <View style={card}>
        {S.expenses.length === 0 && <Text style={{ color: t.mute, fontStyle: "italic" }}>Nothing logged yet.</Text>}
        {S.expenses.slice(0, 20).map((e) => (
          <View key={e.id} style={[st.row, { paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: "600" }}>{e.cat}{e.note ? " – " + e.note : ""}</Text>
              <Text style={{ color: t.mute, fontSize: 11.5 }}>{new Date(e.date).toLocaleDateString()}</Text>
            </View>
            <Text style={{ color: t.text, fontWeight: "700" }}>{m(e.amt)}</Text>
            <Pressable onPress={() => setS((s) => ({ ...s, expenses: s.expenses.filter((x) => x.id !== e.id) }))} hitSlop={10} style={{ paddingHorizontal: 8 }}><Text style={{ color: t.mute, fontSize: 20 }}>×</Text></Pressable>
          </View>
        ))}
      </View>
    </View>
  );

  const insights = () => {
    const savedAmt = spent("Savings");
    return (
      <View>
        <Text style={[st.h1, { color: t.text }]}>Where it's going</Text>
        {rule}
        <View style={card}>
          <View style={st.stats}>
            {[["Spent", m(pieTotal)], ["Saved", m(savedAmt)], ["% of income", income > 0 ? Math.round((pieTotal / income) * 100) + "%" : "0%"]].map(([l, v]) => (
              <View key={l} style={[st.stat, { backgroundColor: t.bg }]}><Text style={{ color: t.mute, fontSize: 10, fontWeight: "700" }}>{l.toUpperCase()}</Text><Text style={{ color: t.text, fontFamily: SERIF, fontWeight: "700", fontSize: 17 }}>{v}</Text></View>
            ))}
          </View>
        </View>
        {h2("Top categories this month")}
        <View style={card}>
          {pieRows.length === 0 && <Text style={{ color: t.mute, fontStyle: "italic" }}>No spending yet.</Text>}
          {pieRows.slice(0, 8).map(([c, v]) => (
            <View key={c} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.line }}>
              <Text style={{ width: 120, fontWeight: "600", fontSize: 13 }}>{c}</Text>
              <View style={{ flex: 1, height: 7, borderRadius: 9, backgroundColor: t.track, overflow: "hidden" }}><View style={{ height: 7, width: `${(v / (pieRows[0][1] || 1)) * 100}%`, backgroundColor: t.accent, borderRadius: 9 }} /></View>
              <Text style={{ fontSize: 12, color: t.mute }}>{m(v)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const settings = () => (
    <View>
      <Text style={[st.h1, { color: t.text }]}>Your details</Text>
      {rule}
      <View style={[...card, { gap: 8 }]}>
        <Text style={{ color: t.mute, fontSize: 12 }}>Your name</Text>
        <TextInput style={input} value={S.name} onChangeText={(v) => setS((s) => ({ ...s, name: v }))} />
      </View>
      {h2("Month-end")}
      <View style={card}>
        <Text style={{ color: t.mute, fontSize: 13, marginBottom: 10 }}>Any leftover income is added to Savings automatically when a new month begins. Use this to move it early.</Text>
        {btn("close", "Close month now", closeMonthNow)}
      </View>
      {h2("Data")}
      <View style={[card, { gap: 8 }]}>
        {btn("export", "Export this month (CSV)", exportCsv)}
        {btn("wipe", "Erase all data", wipe)}
      </View>
    </View>
  );

  const tabs = [["overview", "Overview"], ["budget", "Budget & categories"], ["expenses", "Expenses"], ["insights", "Insights"], ["settings", "Settings"]];
  const titles = { overview: "Overview", budget: "Budget", expenses: "Expenses", insights: "Insights", settings: "Settings" };

  if (!ready) return <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} />;

  if (!S.name && S.name !== undefined && S.name === "") {
    // onboarding
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: t.gold, fontSize: 11, fontWeight: "700", letterSpacing: 1.6 }}>WELCOME</Text>
        <Text style={{ color: t.text, fontFamily: SERIF, fontSize: 24, fontWeight: "700", textAlign: "center", marginTop: 6 }}>Let's set up your budget</Text>
        <Text style={{ color: t.mute, marginTop: 8, marginBottom: 16 }}>What should we call you?</Text>
        <TextInput style={[input, { width: 260, textAlign: "center", fontFamily: SERIF, fontSize: 18 }]} value={onboardName} onChangeText={setOnboardName} placeholder="Your name" placeholderTextColor={t.mute} />
        <Pressable onPress={() => setS((s) => ({ ...s, name: onboardName.trim() || "there" }))} style={[st.save, { backgroundColor: t.accent, width: 260, marginTop: 14 }]}><Text style={{ color: t.on, fontWeight: "700" }}>Continue</Text></Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <View style={[st.topbar, { backgroundColor: t.card, borderBottomColor: t.line }]}>
        <Pressable onPress={() => setDrawer(true)} hitSlop={10}><Text style={{ fontSize: 20, color: t.text }}>☰</Text></Pressable>
        <Text style={{ flex: 1, fontFamily: SERIF, fontWeight: "700", fontSize: 17, color: t.text }}>{titles[tab]}</Text>
        <Pressable onPress={() => setCoffee(true)} style={[st.coffeebtn, { backgroundColor: t.gold }]}><Text style={{ color: t.on, fontWeight: "700", fontSize: 12.5 }}>☕ Coffee</Text></Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {tab === "overview" && overview()}{tab === "budget" && budget()}{tab === "expenses" && expenses()}{tab === "insights" && insights()}{tab === "settings" && settings()}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={drawer} animationType="slide" transparent onRequestClose={() => setDrawer(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(10,10,8,.45)" }} onPress={() => setDrawer(false)}>
          <Pressable style={[st.drawer, { backgroundColor: t.card }]} onPress={() => {}}>
            <Text style={{ color: t.gold, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.6, marginBottom: 2 }}>BUDGET PLANNER</Text>
            <Text style={{ color: t.text, fontFamily: SERIF, fontSize: 20, fontWeight: "700", marginBottom: 14 }}>Menu</Text>
            {tabs.map(([k, l]) => (
              <Pressable key={k} onPress={() => { setTab(k); setDrawer(false); }} style={[st.dlink, { borderLeftColor: tab === k ? t.gold : "transparent", backgroundColor: tab === k ? t.bg : "transparent" }]}>
                <Text style={{ color: tab === k ? t.text : t.mute, fontWeight: "600" }}>{l}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={coffee} animationType="fade" transparent onRequestClose={() => setCoffee(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(10,10,8,.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: t.card, borderRadius: 16, padding: 24, width: "100%", maxWidth: 360, alignItems: "center" }}>
            <Text style={{ fontSize: 34 }}>☕</Text>
            <Text style={{ color: t.text, fontFamily: SERIF, fontSize: 20, fontWeight: "700", marginTop: 8 }}>Buy me a coffee</Text>
            <Text style={{ color: t.mute, textAlign: "center", marginTop: 6, marginBottom: 16, fontSize: 13.5 }}>If this app has made budgeting easier, a small thank-you is always appreciated — sent by EcoCash.</Text>
            <View style={{ backgroundColor: t.bg, borderRadius: 10, borderWidth: 1, borderColor: t.line, padding: 14, width: "100%", marginBottom: 16 }}>
              <Text style={{ color: t.mute, fontSize: 10, letterSpacing: 1, fontWeight: "700" }}>NAME</Text>
              <Text style={{ color: t.text, fontFamily: SERIF, fontSize: 16, fontWeight: "700", marginBottom: 10 }}>Blessing T Chinoda</Text>
              <Text style={{ color: t.mute, fontSize: 10, letterSpacing: 1, fontWeight: "700" }}>ECOCASH NUMBER</Text>
              <Text style={{ color: t.text, fontFamily: SERIF, fontSize: 16, fontWeight: "700" }}>0778 600 349</Text>
            </View>
            <Pressable onPress={copyEco} style={[st.save, { backgroundColor: t.accent, width: "100%", marginBottom: 8 }]}><Text style={{ color: t.on, fontWeight: "700" }}>Copy number</Text></Pressable>
            <Pressable onPress={() => setCoffee(false)} style={{ width: "100%", padding: 11, alignItems: "center" }}><Text style={{ color: t.text, fontWeight: "600" }}>Close</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function greetWord() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Donut({ rows, total, t }) {
  const r = 50, cx = 60, cy = 60, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <View style={{ width: 130, height: 130 }}>
      <Svg viewBox="0 0 120 120" width={130} height={130} style={{ transform: [{ rotate: "-90deg" }] }}>
        {rows.map(([c, v], i) => {
          const f = v / total, len = f * C;
          const el = <Circle key={c} cx={cx} cy={cy} r={r} stroke={PALETTE[i % PALETTE.length]} strokeWidth={20} fill="none" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
      </Svg>
    </View>
  );
}

const st = StyleSheet.create({
  h1: { fontSize: 26, fontFamily: SERIF, fontWeight: "700", marginVertical: 2 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  input: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  chip: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  chip2: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 13, paddingVertical: 7, marginRight: 6 },
  btn: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 10 },
  save: { borderRadius: 9, paddingVertical: 13, alignItems: "center" },
  stats: { flexDirection: "row", gap: 8, marginTop: 12 },
  stat: { flex: 1, borderRadius: 10, padding: 10 },
  alert: { borderRadius: 10, padding: 12, marginBottom: 8 },
  track: { height: 7, borderRadius: 9, overflow: "hidden", marginBottom: 8 },
  topbar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  coffeebtn: { borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8 },
  drawer: { position: "absolute", top: 0, bottom: 0, left: 0, width: "76%", maxWidth: 280, padding: 22, paddingTop: 56 },
  dlink: { paddingVertical: 12, paddingHorizontal: 10, borderLeftWidth: 3, borderRadius: 4, marginBottom: 2 },
});
