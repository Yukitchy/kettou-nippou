# 血糖の日報係（kettou-nippou）SPEC v1 — 2026-10-06 受付(鴨志田セイ)

## 用事
リブレ（FreeStyle Libre CGM）ユーザーが、LibreViewの書き出しCSVと前日のご飯写真を投げると、
「翌朝届く前日レポート」が1画面で読める。食事ごとの上がり幅・ルールコメント・推定A1c。
元ネタ: voice-memo-transcript.txt（相談者の生声）

## 構成（箱ファースト）
~/kettou-nippou/
  index.html        … 単一ページPWA風。ライブラリ無し（グラフはcanvas/SVG自前）。EXIFだけ exifr を cdnjs から
  engine/app.js, engine/style.css
  packs/sample/     … sample.csv（LibreView形式・3日分・1日3食で上がり方が違う）＋ meals.json（サンプル食事: 時刻＋名前＋絵文字。写真は無しでOK）
  VERSION
判定「他人が packs/ に1つ足すだけで動くか」

## 入力
1. LibreView CSV（1行目はメタ行、2行目がヘッダ。列: Device, Serial Number, Device Timestamp(MM-DD-YYYY HH:MM), Record Type(0=自動15分,1=スキャン,2=メモ…), Historic Glucose mg/dL, Scan Glucose mg/dL, …）
   Record Type 0 の Historic Glucose と 1 の Scan Glucose を時系列にマージ。日本版は mmol/L でなく mg/dL。
2. ご飯写真（複数JPEG）: EXIF DateTimeOriginal → 無ければ file.lastModified。写真はサムネを食事カードに表示（ローカルのみ・送信しない）
3. 任意: Claude APIキー（localStorage）。あれば写真を claude-sonnet-5-5 に送って「料理名＋主食の量(多/普/少)＋野菜先食べの可能性」をJSONで返させ、コメントに混ぜる。キー無しでも全部動くこと（必須）

## 計算
- 日次: 平均・最高・最低・TIR(70〜180の割合%)・推定A1c = GMI = 3.31 + 0.02392 × 平均mg/dL（小数1桁）
- 食事ごと: 食前値=食事時刻直前の値 ／ ピーク=食後120分以内の最大 ／ 上昇幅=ピーク−食前 ／ ピークまでの分 ／ 2時間後値
- ルールコメント（必ず出る）: 上昇幅>=60「主食が多かったかも。白米を減らす／野菜から」 ／ 30〜59「ふつう」 ／ <30「緩やか。この食べ方を続ける」 ／ 2時間後が食前+30以上「戻りが遅い。食後に10分歩く」
- 前日比: 平均・TIR の差分を矢印で

## 画面（スマホ縦1列、PCは max-width 720 中央。ライト配色固定・ダークテーマCSS禁止）
1. 朝のレポートカード（最上段）: 日付・「昨日の平均 ○○」特大・TIR・推定A1c・前日比
2. 1日のカーブ: 0〜24h、70〜180帯を薄く塗る、食事の印（絵文字/サムネ）を時刻に置く。タップで食事カードへ
3. 食事カード×N: 写真サムネ・時刻・食前→ピーク（+幅）・ピークまでの分・2h後・コメント1〜2行
4. 入力欄（最下段・折りたたみ）: CSVドロップ／写真ドロップ／「サンプル3日分」ボタン／日付切替／APIキー
- フォント: 道具なので system sans（-apple-system, Hiragino Sans）800 + letter-spacing:-.02em。丸ゴシック禁止
- 色: 白地、文字 #1a1a1a、アクセント1色（血糖=落ち着いたオレンジ系 #e8742c 推奨）、目標帯は薄い緑、高値は赤系。色は3〜4色まで
- CRAP: 見出しは本文の2倍以上／全部左揃え／ラベルは数値の直上に密着
- 受賞作ベンチマーク: Any Distance（ADA 2023）の「数字特大＋下に小ラベル」骨格、Gentler Streak の追い込まない言い回し（「上がりすぎ」でなく「主食が多かったかも」）

## 公開
GitHub repo Yukitchy/kettou-nippou（public）→ GitHub Pages → https://yukitchy.github.io/kettou-nippou/
