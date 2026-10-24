# 2863王国 憲章サイト（kingdom2863.github.io）

Whiteout Survival #2863 の王国サイト。1ページ構成。公開URL：https://kingdom2863.github.io/

## 構成

| 場所 | 役割 |
|---|---|
| `index.html` | サイト本体。GitHub Pages（kingdom2863/kingdom2863.github.io の main・ルート）で公開 |
| Googleスプレッドシート | 文章・ルール・フォーム・同盟情報の管理（運用者が直接編集） |
| GAS（`gas/Code.gs`） | スプレッドシートを読んでJSONを返すWebアプリ。GASエディタ側で管理・デプロイ |

データの流れ：スプレッドシート → GAS（JSON） → index.html の `SCRIPT_URL` で fetch して描画

## 守ること

- **データ取得方式を変えない**。GAS経由で取得する。スプレッドシートを gviz / CSV などで直接読む方式にはしない
  （シートの公開が必要になる・「非表示」行の除外や同盟の時間表などGAS側の処理が効かなくなるため）
- `SCRIPT_URL` は運用者が指定したGASのURL。勝手に変えない
- **見た目を変える依頼がない限り、デザイン（クラス・配色・レイアウト）を変えない**
- 文言はできるだけスプレッドシート側で管理する。ページ内の文章をHTMLに直書きで増やさない

## CSS（重要）

- Tailwind は CDN ではなく**事前ビルドしたCSSを `<style>` に埋め込み済み**（`<!-- Tailwind（事前ビルド済み…） -->` の直後）
- HTMLに**新しいTailwindクラスを追加したら、CSSの再ビルドが必要**。再ビルドしないと、そのクラスは効かない
- 再ビルドの設定（tailwindcss v3.4.x、content は index.html）：

```js
module.exports = {
  content: ['./index.html'],
  theme: { extend: {
    fontFamily: { cinzel: ['Cinzel','serif'], sans: ['"Noto Sans JP"','sans-serif'] },
    colors: {
      navy:  { DEFAULT:'#0E2A47', soft:'#1E3A55', mute:'#4A6680' },
      ice:   { DEFAULT:'#4A90C2', light:'#DCEBF6', pale:'#EEF5FB', text:'#1E4E79' },
      gold:  { DEFAULT:'#E8C46A', pale:'#FBF3DD', line:'#E9D49B', text:'#3D2C05', deep:'#7A5A12' },
      act:   { DEFAULT:'#0F6E56', hover:'#0B5644', light:'#E1F5EE', line:'#9FE1CB', text:'#04342C' },
      alert: { DEFAULT:'#C8553D', pale:'#FFF4F2', light:'#F6D8D1', text:'#6E2A1E' },
      frost: '#F4F8FB',
    } } },
};
```

入力CSSは `@tailwind base; @tailwind components; @tailwind utilities;` の3行。出力（--minify）で `<style>` の中身を丸ごと置き換える。

## 配色ルール（色は「場所」ではなく「意味」で使う）

- 紺 navy：見出し・ヘッダー
- 氷青 ice：通常の情報（ルール・ガイド・イベント）
- 金 gold：王国の権威・特典（ダブルWIN、官職）
- 緑 act：アクション（申請ボタン）だけ
- 赤 alert：違反対応だけ

カードはすべて同じ型：アイコン付き見出し＋区切り線＋説明文＋白い中箱。

## スプレッドシートの構造（1シート＝ページの1つの大カード）

シート（タブの左から順＝ページの上から順）：表紙 / サーバーの特徴 / サーバーの約束 / イベントガイド / 同盟紹介

- シートID：`1vZQuzRFY62wWvovICo33Mj0ARVKG29NxctgujrQngtE`
- GASはシートを「名前→見つからなければタブの順番」で探す。**タブ名は変えてよいが、名前とタブ順を同時に変えない**

ページの階層：大カード（セクション）＞ 中カード（基本ルール等）＞ 小（中カード内の1項目）

全シート共通の列：`カード | 行の種類 | タイトル | 説明（旧：文章） | 表示`

- 行の種類：`大`＝大カードのタイトル／`中`＝中カードのタイトルと説明／`小`＝中カード内の1項目
  - 旧形式 `見出し`／`中身`、カード列 `セクション` も読める（現在のシートは旧形式のまま。移行は任意）
- カード：中の行だけ必須。基本ルール・違反対応・バフ使用ガイド・特典・時間表・同盟・フォーム等、**見た目の種類を決めるキー**なので名前を変えない。小の行は空欄なら直前の中カードに入る
- 表示：`非表示` の行だけ除外。**空白は表示扱い**（意図的。表示の選び忘れで内容が出なくなるのを防ぐ）
- タイトルも説明も空の行は表示しない（GAS・HTMLの両方で除外）
- 行の順番がそのまま表示順。セル内改行はページでも改行される（white-space: pre-line）
- 表紙シートの追加列：URL・開始・締切・グループ（申請フォーム。`表示`＝受付中）
- 同盟紹介シートの追加列：盟主・盟主アイコン、それより右の列はすべてイベント時間表の列（列名＝表の見出し）

## GASのJSON（index.html の adaptData() が描画用の形に変換している）

```
{ updated, cover: {title, cards}, feature: {...}, promise: {...}, event: {...},
  alliance: {title, cards, timeColumns} }
cards = { カード名: { title, desc, items: [{ title, body, ...追加列 }] } }
```

- 「サーバーの特徴」シートが無い間は、約束シートの「友好協定」を特徴の大カードに表示する（移行用の互換処理。現在は特徴シート作成済み）
- 特徴の大カードは、シート内の中カードを自動で全部並べる（中カードを足すとHTML修正なしで増える）
- 前回取得したデータを localStorage（`kingdom2863_data_v2`）に保存し、次回は即表示→裏で最新に差し替え。JSONの形を変えたらキー名のバージョンを上げる

## 公開手順

index.html を kingdom2863/kingdom2863.github.io の main ブランチ・ルートに置けば、数分で GitHub Pages に反映される。

## HTMLに固定している文言（シートでは変わらない）

ナビボタン（サーバーの特徴／サーバーの約束／イベントガイド／同盟紹介）、ヘッダー上の英字（WHITEOUT SURVIVAL · #2863）、
大カードの英字バッジ（FEATURE / PROMISE / EVENT / ALLIANCE / EVENT FORM）。変更は index.html で行う。

## 作業フローと公開

- 作業フォルダ：`D:\GitHub\ServerRule`（= kingdom2863/kingdom2863.github.io のクローン）
- 公開：GitHub Desktop で Commit → Push すると数分で https://kingdom2863.github.io/ に反映
- GASの更新：`gas/Code.gs` をGASエディタに貼り付け →「デプロイを管理」→ 既存デプロイを編集 →「新バージョン」（URLは変わらない）。**GitHub上の gas/Code.gs は控えで、貼り付け・デプロイしない限り動作は変わらない**
- シート編集の反映は最大1分（GASキャッシュ）。即時反映はGASエディタで `clearCache` を実行

## 現状と残タスク（2026/10/24 時点）

- [ ] 最新の index.html（特徴の独立・改行対応・バフ区切り線・空行除外）を Push
- [ ] `gas/Code.gs`（大・中・小対応＋空行除外）をGASに貼り付けて新バージョンでデプロイ（旧形式も読めるので、シート移行前でも安全）
- [ ] 任意：シートを大・中・小形式へ移行（D1 文章→説明、B列置換、B列プルダウンを 大,中,小、条件付き書式を `=OR($B2="大",$B2="中")`）
- [ ] 約束シートの重複行（基本ルールの見出しが2つ、同じ小が重複）の整理
- [ ] 任意：大見出しが英字だけのとき Cinzel 書体にする対応（ROYAL CHARTER 用）
- [ ] 任意：ナビ文言を大カードのタイトル（例：#2863のルール）に合わせる
- [ ] 後片付け：ドライブの `zz_test_dv`・`zz_test_cf`・旧シート、`D:\GitHub\WOS-tool\ServerRule` の削除

