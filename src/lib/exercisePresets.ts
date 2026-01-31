export type ExercisePreset = {
  name: string;
  targetParts: string[];
};

export const GYM_MACHINE_PRESET_EXERCISES: ExercisePreset[] = [
  // 有酸素マシン
  { name: "ランニングマシン", targetParts: [] },
  { name: "クロストレーナー", targetParts: [] },
  { name: "リカンベントバイク", targetParts: [] },

  // 筋トレマシン
  { name: "MTSチェストプレス", targetParts: ["胸"] },
  { name: "MTSショルダープレス", targetParts: ["肩"] },
  { name: "MTSアブドミナルクランチ", targetParts: ["腹"] },
  { name: "アシストディップチン", targetParts: ["胸", "背中", "腕"] },
  { name: "ラットプルダウン", targetParts: ["背中"] },
  { name: "ペクトラルフライ/リアデルトイド", targetParts: ["胸", "肩"] },
  { name: "シーテッドロウ", targetParts: ["背中"] },
  { name: "ヒップアブダクション", targetParts: ["脚"] },
  { name: "ヒップアダクション", targetParts: ["脚"] },
  { name: "レッグカール", targetParts: ["脚"] },
  { name: "レッグエクステンション", targetParts: ["脚"] },
  { name: "シーテッドレッグプレス", targetParts: ["脚"] },
  { name: "トーソローテーション", targetParts: ["腹"] },
  { name: "レッグレイズ", targetParts: ["腹"] },
  { name: "45度バックエクステンション", targetParts: ["背中"] },
  { name: "デクライン/アブドミナルベンチ", targetParts: ["腹"] },

  // プレートロード マシン
  { name: "PLワイドチェスト", targetParts: ["胸"] },
  { name: "PLワイドプルダウン", targetParts: ["背中"] },
  { name: "PLリニアレッグプレス", targetParts: ["脚"] },
  { name: "PLグルートドライブ", targetParts: ["脚"] },

  // フリーウェイト（器具）
  { name: "ダンベル1~50kg", targetParts: [] },
  { name: "スミスマシン", targetParts: [] },
  { name: "パワーラック", targetParts: [] },
  { name: "デュアルアジャスタブルプーリー", targetParts: [] },
  { name: "アジャストベンチ", targetParts: [] },
  { name: "フラットベンチ", targetParts: [] },
  { name: "アームカールベンチ", targetParts: ["腕"] },
  { name: "オリンピックベンチ", targetParts: ["胸"] },
];
