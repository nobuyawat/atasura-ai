import { DemoStepContent } from './types';

export const DEMO_STEPS: DemoStepContent[] = [
  {
    id: 1,
    label: "ステップ1",
    title: "テーマと時間を入れるだけ",
    description: [
      "講座テーマと所要時間を入力するだけ。",
      "構成はAIが後から整理してくれるので、この時点では深く考える必要はありません。"
    ],
    message: "キーワードと時間だけでOK",
    features: [
      { title: "シンプルな入力フォーム", description: "迷わず入力できる設計" },
      { title: "直感的なUI", description: "初見でも操作に迷わない" },
      { title: "所要時間の目安設定", description: "5分・10分など用途に合わせて調整可能" }
    ],
    ctaLabel: "内容を入力"
  },
  {
    id: 2,
    label: "ステップ2",
    title: "思いつくまま入力（音声OK）",
    description: [
      "整理や構成は、すべてAIが担当します。",
      "あなたは、思いついたことを入力するだけで大丈夫です。"
    ],
    message: "整理はAIがやるのでランダムでOK",
    features: [
      { title: "テキスト自由入力", description: "箇条書きでも、断片的な言葉でも可" },
      { title: "リアルタイム音声入力", description: "話した内容をそのままテキスト化" },
      { title: "自動整理機能", description: "AIが文脈を読み取って分類" }
    ],
    ctaLabel: "骨子を生成"
  },
  {
    id: 3,
    label: "ステップ3",
    title: "AIが骨子・台本を自動生成",
    description: [
      "入力された情報をAIが解析し、論理的な構成を提案します。",
      "構成案を確認しながら、必要に応じて微調整が可能です。"
    ],
    message: "構成をAIが考え、爆速で具体化",
    features: [
      { title: "階層構造の骨子生成", description: "見出しと要点を一瞬で構築" },
      { title: "編集可能なエディタ", description: "納得いくまでAIと修正可能" },
      { title: "台本自動作成", description: "各スライドで話すべき内容を生成" }
    ],
    ctaLabel: "台本化する"
  },
  {
    id: 4,
    label: "ステップ4",
    title: "スライド＆ノートで完成",
    description: [
      "視覚的なスライドと詳細なノートが同時に出来上がります。",
      "そのままプレゼンや会議、動画制作に活用いただけます。"
    ],
    message: "資料と話す内容が同時に完成",
    features: [
      { title: "AI画像生成", description: "スライドに最適な挿絵を自動作成" },
      { title: "スピーカーノート", description: "プロ級の喋りをサポートする原稿" },
      { title: "マルチユース", description: "朝礼から本格的な講座まで対応" }
    ],
    ctaLabel: "無料で始める"
  }
];
