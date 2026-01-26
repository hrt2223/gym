const ALL_PARTS = ["胸", "背中", "肩", "腕", "脚", "腹"] as const;

export type TargetPart = (typeof ALL_PARTS)[number];

export function inferTargetParts(name: string): TargetPart[] {
  const n = name.toLowerCase();

  const parts = new Set<TargetPart>();

  // 胸
  if (n.includes("ベンチ") || n.includes("チェスト") || n.includes("フライ") || n.includes("push") || n.includes("press")) {
    parts.add("胸");
  }

  // 背中
  if (
    n.includes("デッド") ||
    n.includes("ロー") ||
    n.includes("ラット") ||
    n.includes("懸垂") ||
    n.includes("pull")
  ) {
    parts.add("背中");
  }

  // 肩
  if (n.includes("ショルダー") || n.includes("サイド") || n.includes("リア") || n.includes("upright") || n.includes("オーバー")) {
    parts.add("肩");
  }

  // 腕
  if (n.includes("カール") || n.includes("アーム") || n.includes("トライ") || n.includes("ディップ") || n.includes("biceps") || n.includes("triceps")) {
    parts.add("腕");
  }

  // 脚
  if (n.includes("スクワ") || n.includes("レッグ") || n.includes("ブルガリア") || n.includes("カーフ") || n.includes("ランジ")) {
    parts.add("脚");
  }

  // 腹
  if (n.includes("腹") || n.includes("クランチ") || n.includes("プランク") || n.includes("ab") || n.includes("core")) {
    parts.add("腹");
  }

  // 何も推定できない場合は空（ユーザーが選ぶ）
  return Array.from(parts).filter((p) => ALL_PARTS.includes(p));
}
