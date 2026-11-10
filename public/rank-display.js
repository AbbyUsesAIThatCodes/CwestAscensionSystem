export function rankTone(b, r) {
  if (!r) return "#655c6e";
  const label = b?.ranks?.[r - 1]?.toLowerCase() || "";
  if (
    label.includes("obsidian") ||
    label.includes("mastery") ||
    r === b?.ranks?.length
  )
    return "#bc8bff";
  if (label.includes("introduced")) return "#e4dfeb";
  if (label.includes("advanced")) return "#ee657b";
  if (label.includes("beginner") || label.includes("intermediate"))
    return "#dfbf70";
  return r / Math.max(1, b?.ranks?.length) <= 0.4 ? "#dfbf70" : "#ee657b";
}
export function rankNumeral(r, badge) {
  const label = badge?.ranks?.[r - 1] || "";
  const sublevel = label.match(/ (I|II|III)$/);
  if (sublevel) return sublevel[1];
  if (["Introduced", "Obsidian Mastery"].includes(label)) return "";
  if (r < 1) return "";
  return (
    [
      "",
      "I",
      "II",
      "III",
      "IV",
      "V",
      "VI",
      "VII",
      "VIII",
      "IX",
      "X",
      "XI",
      "XII",
      "XIII",
      "XIV",
      "XV",
    ][r] || String(r)
  );
}
