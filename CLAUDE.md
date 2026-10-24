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

シート（ページの上から順）：表紙 / サーバーの特徴 / サーバーの約束 / イベントガイド / 同盟紹介

全シート共通の列：`カード | 行の種類 | タイトル | 文章 | 表示`

- カード：中カードの名前（`セクション` は大カードの見出し）
- 行の種類：`見出し`＝中カードのタイトルと説明文、`中身`＝中カードの中の1項目
- 表示：`非表示` の行はGASが除外する
- 行の順番がそのまま表示順
- 表紙シートの追加列：URL・開始・締切・グループ（申請フォーム。`表示`＝受付中）
- 同盟紹介シートの追加列：盟主・盟主アイコン、それより右の列はすべてイベント時間表の列（列名＝表の見出し）

## GASのJSON（index.html の adaptData() が描画用の形に変換している）

```
{ updated, cover: {title, cards}, feature: {...}, promise: {...}, event: {...},
  alliance: {title, cards, timeColumns} }
cards = { カード名: { title, desc, items: [{ title, body, ...追加列 }] } }
```

- 「サーバーの特徴」シートが無い間は、約束シートの「友好協定」を特徴の大カードに表示する（移行用の互換処理）
- 前回取得したデータを localStorage（`kingdom2863_data_v2`）に保存し、次回は即表示→裏で最新に差し替え。JSONの形を変えたらキー名のバージョンを上げる

## 公開手順

index.html を kingdom2863/kingdom2863.github.io の main ブランチ・ルートに置けば、数分で GitHub Pages に反映される。
