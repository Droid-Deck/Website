const ROMAN = { ii: "2", iii: "3", iv: "4", vi: "6", vii: "7", viii: "8" };
const EDITIONS = /\s+(classic|remastered|remaster|redux|hd|goty|game of the year edition|definitive edition|enhanced edition|complete edition|deluxe edition|gold edition|directors cut|anniversary edition|legacy)$/;
const SEQUEL = /\s(\d+|ii|iii|iv|v|vi|vii|viii|ix|x)$/;
const MAKERS = /^(samsung galaxy|samsung|ayaneo|ayn|xiaomi|oneplus|google|lenovo|asus|nubia|retroid|redmagic|poco|honor|motorola) /;
const OURS = /droid\s?deck/i;

export function clean(text) {
  return text.toLowerCase().replace(/[™®©]/g, "").replace(/['"’‘`]/g, "").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

function variants(name) {
  const full = clean(name);
  const found = new Map([[full, 3]]);
  const add = (text, rank) => {
    const value = text.trim();
    if (value.length > 3 && value.includes(" ") && (found.get(value) || 0) < rank) found.set(value, rank);
  };
  let bare = full;
  while (EDITIONS.test(bare)) bare = bare.replace(EDITIONS, "");
  add(bare, 2);
  const cut = full.split(/\s*(?::| - )\s*/)[0].replace(EDITIONS, "");
  if (cut !== full && SEQUEL.test(cut)) add(cut, 1);
  for (const [value, rank] of [...found]) {
    add(value.replace(/\b(ii|iii|iv|vi|vii|viii)\b/g, (numeral) => ROMAN[numeral]), rank);
    add(value.replace(/^grand theft auto\b/, "gta"), rank);
  }
  return found;
}

function pattern(value) {
  const words = value.split(/[\s:-]+/).filter(Boolean).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?<![a-z0-9])${words.join("[\\s:-]*\\s*")}(?![a-z0-9])(?![\\s-]*([2-9]|ii|iii|iv|v|vi)(?![a-z0-9]))`, "g");
}

export function matcher(names, devices = []) {
  const owners = new Map();
  for (const name of names) {
    for (const [value, rank] of variants(name)) {
      const entry = owners.get(value);
      if (!entry || rank > entry.rank) owners.set(value, { rank, names: [name] });
      else if (rank === entry.rank && !entry.names.includes(name)) entry.names.push(name);
    }
  }
  const tests = [];
  for (const [value, { rank, names: owned }] of owners) {
    if (owned.length > 1 && rank < 3) continue;
    tests.push({ test: pattern(value), names: owned });
  }
  const hardware = [/(?<![a-z0-9])[a-z]+ \d+ portal(?![a-z0-9])/g, ...[...new Set(devices.flatMap((device) => [clean(device), clean(device).replace(MAKERS, "")]))]
    .filter((device) => device.includes(" "))
    .sort((a, b) => b.length - a.length)
    .map(pattern)];
  return (title) => {
    if (!OURS.test(title)) return [];
    let text = clean(title);
    for (const device of hardware) text = text.replace(device, " ");
    const hits = [];
    for (const { test, names: owned } of tests) {
      test.lastIndex = 0;
      for (const match of text.matchAll(test)) hits.push({ from: match.index, to: match.index + match[0].length, names: owned });
    }
    const kept = hits.filter((hit) => !hits.some((other) => other !== hit && other.from <= hit.from && other.to >= hit.to && other.to - other.from > hit.to - hit.from));
    return [...new Set(kept.flatMap((hit) => hit.names))].sort();
  };
}
