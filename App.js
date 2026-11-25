import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, Alert, StyleSheet, useColorScheme, KeyboardAvoidingView, Platform, StatusBar } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

const CATS = [["Rent","🏠",30],["Electricity","💡",5],["Water","💧",3],["Repairs","🔧",4],["Miscellaneous","🧾",5],["Dry groceries","🛒",10],["Meat","🥩",7],["Vegetables","🥬",5],["Savings","🐷",15],["Subscriptions","📺",3],["Black tax","🤝",13]];
const CURS = ["R","₦","GH₵","KSh","$","£","€"];
const KEY = "budget-v1";
const LIGHT = { bg:"#eef1f4", card:"#fff", text:"#14202b", mute:"#60707e", line:"#d9e0e6", accent:"#0f6b6b", accentT:"#dcf0ee", warn:"#9a6700", warnT:"#fff1cc", bad:"#c62828", badT:"#fde3e1", track:"#e4e9ee", onAccent:"#fff" };
const DARK = { bg:"#0e151b", card:"#17212a", text:"#e9eef2", mute:"#8fa1af", line:"#26333e", accent:"#4fd1c5", accentT:"#12332f", warn:"#f0c15a", warnT:"#3b2f10", bad:"#ff8a80", badT:"#431d1b", track:"#243039", onAccent:"#06201d" };
const num = (v) => parseFloat(String(v || "").replace(",", ".")) || 0;

export default function App() {
  return <SafeAreaProvider><Budget /></SafeAreaProvider>;
}

function Budget() {
  const dark = useColorScheme() === "dark";
  const t = dark ? DARK : LIGHT;
  const [S, setS] = useState({ income: "", cur: "R", limits: {}, expenses: [] });
  const [ready, setReady] = useState(false);
  const [cat, setCat] = useState("Rent");
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) setS((s) => ({ ...s, ...JSON.parse(v) })); }).catch(() => {}).finally(() => setReady(true));
  }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEY, JSON.stringify(S)).catch(() => {}); }, [S, ready]);

  const m = (n) => S.cur + " " + (Math.round(n * 100) / 100).toLocaleString();
  const spent = (c) => S.expenses.filter((e) => e.cat === c).reduce((a, e) => a + e.amt, 0);
  const lim = (c) => num(S.limits[c]);
  const income = num(S.income);
  let planned = 0, used = 0;
  const alerts = [];
  const info = CATS.map(([c, ic]) => {
    const L = lim(c), s = spent(c), sv = c === "Savings";
    planned += L; used += s;
    let level = "ok";
    if (!sv) { if (s > L && s > 0) level = "bad"; else if (L > 0 && s / L >= 0.8) level = "warn"; }
    if (level === "bad") alerts.push({ k: c, lv: "bad", txt: `⚠️ ${ic} ${c} is over its limit by ${m(s - L)}.` });
    if (level === "warn") alerts.push({ k: c, lv: "warn", txt: `${ic} ${c} is almost at its limit. ${m(L - s)} left.` });
    return { c, ic, L, s, sv, level, pct: L > 0 ? Math.min(100, (s / L) * 100) : s > 0 ? 100 : 0 };
  });
  if (income > 0 && used > income) alerts.unshift({ k: "inc", lv: "bad", txt: `🚨 You have used ${m(used - income)} more than your income.` });
  if (income > 0 && planned > income) alerts.unshift({ k: "plan", lv: "warn", txt: `Your limits add up to ${m(planned - income)} more than your income. Lower some limits.` });
  const left = income - used;
  const col = { ok: t.accent, warn: t.warn, bad: t.bad };

  const setLimit = (c, v) => setS((s) => ({ ...s, limits: { ...s.limits, [c]: v } }));
  const add = () => {
    const a = num(amt);
    if (a <= 0) { Alert.alert("Enter an amount", "Type how much you spent."); return; }
    setS((s) => ({ ...s, expenses: [{ id: Date.now(), cat, amt: a, note: note.trim() }, ...s.expenses] }));
    setAmt(""); setNote("");
    if (cat !== "Savings") {
      const L = lim(cat), now = spent(cat) + a;
      if (now > L) Alert.alert("Over your limit", `${cat} is over its limit by ${m(now - L)}.`);
      else if (L > 0 && now / L >= 0.8) Alert.alert("Almost at your limit", `${cat} has only ${m(L - now)} left.`);
    }
  };
  const suggest = () => {
    if (income <= 0) { Alert.alert("Enter your income first"); return; }
    const go = () => { const l = {}; CATS.forEach(([c, , p]) => (l[c] = String(Math.round((income * p) / 100)))); setS((s) => ({ ...s, limits: l })); };
    if (Object.values(S.limits).some((v) => num(v) > 0)) Alert.alert("Replace your limits?", "This overwrites the limits you set.", [{ text: "Cancel", style: "cancel" }, { text: "Replace", onPress: go }]);
    else go();
  };
  const newMonth = () => Alert.alert("Start a new month?", "This clears your expenses. Your limits stay.", [{ text: "Cancel", style: "cancel" }, { text: "Start", style: "destructive", onPress: () => setS((s) => ({ ...s, expenses: [] })) }]);

  const card = [st.card, { backgroundColor: t.card, borderColor: t.line }];
  const input = [st.input, { backgroundColor: t.bg, borderColor: t.line, color: t.text }];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={[st.h1, { color: t.text }]}>Monthly budget</Text>
          <Text style={{ color: t.mute, marginBottom: 14 }}>Set your income and a limit for each category. You will be alerted when you go over.</Text>

          <View style={card}>
            <Text style={[st.h2, { color: t.text }]}>Your income this month</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {CURS.map((c) => (
                <Pressable key={c} onPress={() => setS((s) => ({ ...s, cur: c }))} style={[st.chip, { borderColor: t.line, backgroundColor: S.cur === c ? t.accent : t.bg }]}>
                  <Text style={{ color: S.cur === c ? t.onAccent : t.text, fontWeight: "600" }}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput style={[...input, { fontSize: 22, fontWeight: "700" }]} value={String(S.income || "")} onChangeText={(v) => setS((s) => ({ ...s, income: v }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.mute} />
            <View style={st.stats}>
              {[["Planned", m(planned), t.text], ["Used", m(used), t.text], ["Left", m(left), left < 0 ? t.bad : t.text]].map(([l, v, c]) => (
                <View key={l} style={[st.stat, { backgroundColor: t.bg }]}><Text style={{ color: t.mute, fontSize: 12 }}>{l}</Text><Text style={{ color: c, fontWeight: "700" }}>{v}</Text></View>
              ))}
            </View>
          </View>

          {alerts.map((a) => (
            <View key={a.k} style={[st.alert, { backgroundColor: a.lv === "bad" ? t.badT : t.warnT }]}>
              <Text style={{ color: a.lv === "bad" ? t.bad : t.warn, fontWeight: "600" }}>{a.txt}</Text>
            </View>
          ))}

          <View style={card}>
            <Text style={[st.h2, { color: t.text }]}>Add an expense</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {CATS.map(([c]) => (
                <Pressable key={c} onPress={() => setCat(c)} style={[st.chip, { borderColor: t.line, backgroundColor: cat === c ? t.accent : t.bg }]}>
                  <Text style={{ color: cat === c ? t.onAccent : t.text, fontWeight: "600" }}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput style={input} value={amt} onChangeText={setAmt} keyboardType="decimal-pad" placeholder="Amount" placeholderTextColor={t.mute} />
            <TextInput style={[...input, { marginTop: 8 }]} value={note} onChangeText={setNote} placeholder="Note (optional)" placeholderTextColor={t.mute} maxLength={60} />
            <Pressable onPress={add} style={[st.btn, { backgroundColor: t.accent, marginTop: 10 }]}><Text style={{ color: t.onAccent, fontWeight: "700" }}>Add expense</Text></Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <Pressable onPress={suggest} style={[st.btn, { flex: 1, backgroundColor: t.card, borderColor: t.line, borderWidth: 1 }]}><Text style={{ color: t.text, fontWeight: "600" }}>Suggest limits</Text></Pressable>
            <Pressable onPress={newMonth} style={[st.btn, { flex: 1, backgroundColor: t.card, borderColor: t.line, borderWidth: 1 }]}><Text style={{ color: t.text, fontWeight: "600" }}>Start new month</Text></Pressable>
          </View>

          {info.map((i) => (
            <View key={i.c} style={[...card, { borderLeftWidth: 5, borderLeftColor: col[i.level] }]}>
              <View style={st.row}>
                <Text style={{ color: t.text, fontWeight: "700", fontSize: 16 }}>{i.ic} {i.c}</Text>
                <View style={st.row}>
                  <Text style={{ color: t.mute, marginRight: 6 }}>{i.sv ? "Goal" : "Limit"}</Text>
                  <TextInput style={[...input, { width: 96, textAlign: "right", paddingVertical: 6 }]} value={String(S.limits[i.c] ?? "")} onChangeText={(v) => setLimit(i.c, v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.mute} />
                </View>
              </View>
              <View style={[st.track, { backgroundColor: t.track }]}><View style={{ height: 9, borderRadius: 9, width: `${i.pct}%`, backgroundColor: col[i.level] }} /></View>
              <View style={st.row}>
                <Text style={{ color: t.mute }}>{m(i.s)} {i.sv ? "saved" : "spent"}</Text>
                <Text style={{ color: i.level === "ok" ? t.mute : col[i.level], fontWeight: i.level === "ok" ? "400" : "700" }}>
                  {i.sv ? (i.L > 0 ? (i.s >= i.L ? "Goal reached 🎉" : m(i.L - i.s) + " to go") : "Set a goal") : i.L === 0 && i.s === 0 ? "Set a limit" : i.s > i.L ? m(i.s - i.L) + " over" : m(i.L - i.s) + " left"}
                </Text>
              </View>
            </View>
          ))}

          <View style={card}>
            <Text style={[st.h2, { color: t.text }]}>Recent expenses</Text>
            {S.expenses.length === 0 && <Text style={{ color: t.mute }}>Nothing logged yet. Add your first expense above.</Text>}
            {S.expenses.slice(0, 20).map((e) => (
              <View key={e.id} style={[st.row, { paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: "600" }}>{e.cat}{e.note ? " – " + e.note : ""}</Text>
                  <Text style={{ color: t.mute, fontSize: 12 }}>{new Date(e.id).toLocaleDateString()}</Text>
                </View>
                <Text style={{ color: t.text, fontWeight: "700" }}>{m(e.amt)}</Text>
                <Pressable onPress={() => setS((s) => ({ ...s, expenses: s.expenses.filter((x) => x.id !== e.id) }))} hitSlop={10} style={{ paddingHorizontal: 10 }}>
                  <Text style={{ color: t.mute, fontSize: 22 }}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: "800", marginTop: 4, marginBottom: 2 },
  h2: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  chip: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  stats: { flexDirection: "row", gap: 8, marginTop: 12 },
  stat: { flex: 1, borderRadius: 10, padding: 10 },
  alert: { borderRadius: 12, padding: 12, marginBottom: 8 },
  track: { height: 9, borderRadius: 9, overflow: "hidden", marginVertical: 10 },
});
