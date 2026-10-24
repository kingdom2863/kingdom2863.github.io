/**
 * 2863王国 ポータルサイト データ配信API（1シート＝1大カード）
 *
 * シート構成（ページの上から順）
 *   表紙            … ヘッダー / フッター / 申請フォーム
 *   サーバーの特徴   … 友好協定 など（カードを足せば中カードが増える）
 *   サーバーのルール … 基本ルール / 違反対応 / バフ使用ガイド
 *   イベントガイド   … 最強王国 / 特典 / その他イベント
 *   同盟紹介        … 時間表 / 同盟
 *
 * 全シート共通の列：カード | 行の種類 | タイトル | 説明 | 表示
 *   行の種類 … 「大」＝大カードのタイトル
 *              「中」＝中カードのタイトルと説明
 *              「小」＝中カードの中の1項目（タイトルと説明）
 *   カード   … 中の行だけ指定（基本ルール・違反対応など、見た目の種類を決める名前）
 *              小の行は空欄でOK（すぐ上の中カードに入る）
 *              同じカード名の中を2つ書くと、同じ見た目の中カードが2枚並ぶ（JSONのキーは「基本ルール#2」）
 *   表示     … 「非表示」にすると行を消さずにページから隠せる
 *   並び順   … シート上の行の順番がそのまま表示順
 *   ※ 旧形式（行の種類＝見出し／中身、列名＝文章、カード＝セクション）もそのまま読める
 *
 * シート名を変えても、タブの順番（表紙→特徴→ルール→イベント→同盟）がそのままなら修正不要。
 * ※ このファイルの中身を編集する必要はありません。編集はすべてスプレッドシートで行います。
 */

const SHEET_ID = '1vZQuzRFY62wWvovICo33Mj0ARVKG29NxctgujrQngtE';
const CACHE_SECONDS = 60;   // 表示高速化のためのキャッシュ秒数（0で無効）

// シート（キー＝JSONのキー）
//   names … まずこの名前でシートを探す（旧名も両対応）
//   index … 名前で見つからない時は、左から何番目のタブか（1始まり）で探す
//   → シート名を変えても、タブの順番がそのままならGASの修正は不要
const SHEETS = {
  cover:    { names: ['表紙'], index: 1 },
  feature:  { names: ['サーバーの特徴'], index: 2 },
  promise:  { names: ['サーバーのルール', 'サーバーの約束'], index: 3 },
  event:    { names: ['イベントガイド'], index: 4 },
  alliance: { names: ['同盟紹介'], index: 5 },
};

const BASE_COLS = ['カード', '行の種類', 'タイトル', '説明', '文章', '表示'];

// 追加列 → JSONのキー（ここに無い同盟紹介の列はすべて「イベント時間」の列として扱う）
const FIELD_KEYS = { 'URL': 'url', '開始': 'start', '締切': 'deadline', 'グループ': 'group', '盟主': 'leader', '盟主アイコン': 'icon' };

/* =====================================================================
 *  Web API
 * ===================================================================== */
function doGet(e) {
  try {
    const noCache = e && e.parameter && e.parameter.nocache;
    const cache = CacheService.getScriptCache();
    if (CACHE_SECONDS > 0 && !noCache) {
      const hit = cache.get('portal_v3');
      if (hit) return output_(hit);
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const data = { updated: lastUpdated_() };
    Object.keys(SHEETS).forEach(key => { data[key] = readSection_(ss, key); });

    const body = JSON.stringify(data);
    if (CACHE_SECONDS > 0 && body.length < 90000) cache.put('portal_v3', body, CACHE_SECONDS);
    return output_(body);
  } catch (err) {
    return output_(JSON.stringify({ error: String(err) }));
  }
}

/** 1シートを { title, cards: { カード名: { title, desc, items: [...] } } } に変換 */
function readSection_(ss, key) {
  const result = { title: '', cards: {} };
  const sh = findSheet_(ss, key);
  if (!sh) return result;

  const values = sh.getDataRange().getDisplayValues();
  if (values.length < 2) return result;

  const headers = values.shift().map(h => String(h).trim());
  const col = name => headers.indexOf(name);
  const get = (row, name) => (col(name) >= 0 ? String(row[col(name)]).trim() : '');

  // 同盟紹介：既知の列以外は「イベント時間」の列（列を足せば表にも列が増える）
  const known = BASE_COLS.concat(Object.keys(FIELD_KEYS));
  const timeCols = key === 'alliance' ? headers.filter(h => h && known.indexOf(h) < 0) : [];
  if (key === 'alliance') result.timeColumns = timeCols;

  let lastCard = '';                 // 直前の中カードのキー（小の行はここに入る）
  const hiddenCards = {};            // 非表示にした中カード（その小の行も出さない）
  const headed = {};                 // 中の行が出たカード名 → 回数（同じ名前の2つ目以降は「名前#2」の別カードにする）

  // カード名 → 小の行を入れる先のキー（直前の中カードが同じ種類ならそこ、無ければ最後の同じ種類）
  const keyFor = name => {
    if (lastCard && typeOf_(lastCard) === name) return lastCard;
    const n = headed[name] || 1;
    return n > 1 ? name + '#' + n : name;
  };
  const newCard = (key) => ({ type: typeOf_(key), title: '', desc: '', items: [] });

  values.forEach(row => {
    const rawType = get(row, '行の種類');
    let card = get(row, 'カード');
    const title = get(row, 'タイトル');
    const body = get(row, '説明') || get(row, '文章');
    const show = get(row, '表示');
    const hidden = (show === '非表示' || show.toUpperCase() === 'FALSE');

    // 行の種類を 大 / 中 / 小 にそろえる（旧形式の 見出し・中身 にも対応）
    let level = '';
    if (rawType === '大' || (rawType === '見出し' && card === 'セクション')) level = '大';
    else if (rawType === '中' || rawType === '見出し') level = '中';
    else if (rawType === '小' || rawType === '中身') level = '小';
    else if (card === 'セクション') level = '大';
    else if (card || title || body) level = '小';
    if (!level) return;

    if (level === '大') {
      if (!hidden) result.title = title;
      return;
    }

    if (level === '中') {
      card = card || title;          // カード名が空ならタイトルを名前にする
      if (!card) return;
      headed[card] = (headed[card] || 0) + 1;
      const key = headed[card] > 1 ? card + '#' + headed[card] : card;
      lastCard = key;
      if (hidden) { hiddenCards[key] = true; return; }
      const c = result.cards[key] || (result.cards[key] = newCard(key));
      c.title = title;
      c.desc = body;
      return;
    }

    // 小
    const key = card ? keyFor(card) : lastCard;
    if (!key || hidden || hiddenCards[key]) return;
    if (!title && !body) return;     // タイトルも説明も空の行（入力途中）は出さない
    const c = result.cards[key] || (result.cards[key] = newCard(key));
    const item = { title: title, body: body };
    Object.keys(FIELD_KEYS).forEach(h => { if (col(h) >= 0) item[FIELD_KEYS[h]] = get(row, h); });
    if (timeCols.length) {
      item.times = {};
      timeCols.forEach(h => { item.times[h] = splitList_(get(row, h)); });
    }
    c.items.push(item);
  });

  return result;
}

/** カードのキー → 種類（"基本ルール#2" → "基本ルール"） */
function typeOf_(key) {
  return String(key).replace(/#\d+$/, '');
}

/** シートを名前で探し、無ければタブの順番で探す */
function findSheet_(ss, key) {
  const def = SHEETS[key];
  const names = Array.isArray(def && def.names) ? def.names : [def && def.name].filter(Boolean);
  for (const name of names) {
    const byName = ss.getSheetByName(name);
    if (byName) return byName;
  }
  const sheets = ss.getSheets();
  return sheets[def.index - 1] || null;
}

/** "19:00, 21:00 (フリー)" → ["19:00", "21:00 (フリー)"] */
function splitList_(val) {
  return String(val || '').split(/[,、，\n]/).map(s => s.trim()).filter(Boolean);
}

/** スプレッドシートの最終更新日（フッターに自動表示） */
function lastUpdated_() {
  try {
    const d = DriveApp.getFileById(SHEET_ID).getLastUpdated();
    return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy.MM.dd');
  } catch (e) {
    return '';
  }
}

function output_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

/** シート編集後すぐにページへ反映したいときに実行 */
function clearCache() {
  CacheService.getScriptCache().remove('portal_v3');
  Logger.log('キャッシュを削除しました');
}

/** 出力内容の確認用 */
function testOutput() {
  clearCache();
  Logger.log(doGet().getContent());
}
