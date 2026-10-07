# 血糖の日報係 開発引き継ぎ（タカさん向け）

ユウキのボイスメモ（2026-10-06）から作った試作です。ここから先はタカさん自身が、自分のAI（Claude / ChatGPT / Cursor など）に続きを作らせる前提で書いています。

## 1. いま動いているもの
- デモ: https://yukitchy.github.io/kettou-nippou/ （ブラウザだけで動く。データはスマホの外に出ない）
- コード: https://github.com/Yukitchy/kettou-nippou （public）
- 仕様書: `SPEC-for-AI.md`（AIに読ませる用。計算式・出力の形・コメントのルールが全部ここ）

## 2. まず5分でやること
1. GitHubで `Yukitchy/kettou-nippou` を **Fork**（自分のアカウントにコピー）
2. Fork先の Settings → Pages → Branch を `main` / `/ (root)` にして保存。数分で `https://<あなたのID>.github.io/kettou-nippou/` で動く
3. libreview.com から「血糖値データのダウンロード」でCSVを落とし、デモに投げる（LibreLinkアプリからは出せない）

## 3. ファイルの地図
```
index.html            画面の骨。ボタンと入力欄だけ
engine/app.js         全部ここ。CSV読み込み(parseCsv)／食事ごとの計算(evalMeal)／コメント(say)／SVGグラフ(drawChart)／写真のEXIF(shotTime)
engine/style.css      見た目（白地・文字#1a1a1a・オレンジ#e8742c・薄緑の目標帯の4色）
packs/sample/         サンプル3日分（sample.csv は LibreView と同じ形式）
SPEC-for-AI.md        仕様書
```
ライブラリは exifr（写真の撮影時刻を読む）だけ。ビルド工程なし。ファイルを直してpushすれば公開が更新される。

## 4. AIに続きを作らせる時の頼み方（コピペ用）
最初に `SPEC-for-AI.md` と `engine/app.js` を丸ごと渡して、こう言う:
> この仕様書と app.js を読んで。仕様書の計算式と出力の形は変えずに、次の機能を足して: ＜やりたいこと＞

## 5. 次に足すとよさそうなもの（優先順）
1. **毎朝の自動配信** — LibreViewに公開APIは無い。現実的なのは「iPhoneショートカットで朝7時にLibreViewのCSVをダウンロード→Claude/ChatGPTのプロジェクト（SPEC-for-AI.md を指示に貼ったもの）へ投げる」。または週1でCSVを手で落として7日分を一気に見る
2. **写真の中身判定** — `engine/app.js` の `ask()` に Claude API を呼ぶ入口がある（APIキーを入れた時だけ動く）。ChatGPT派なら同じ場所を OpenAI の Vision に差し替える
3. **食事メモの手入力** — 写真が無い食事を「12:30 カツ丼」と打てる欄（いまは写真のみ）
4. **週のまとめ** — 7日分の平均・目標内%・上昇幅60以上の食事一覧（仕様書の4章）
5. **A1cの目安の見せ方** — GMIは推定。病院の検査値とずれるので、画面上も「推定」のまま

## 6. 守ってほしいこと
- 医療判断を出さない（薬・インスリンの話はしない）。仕様書5章
- 血糖データと写真を外部に送るのは、本人がAPIキーを入れた時だけ
- 推定A1cは必ず「推定」と書く
