/**
 * 2863王国 ポータルサイト データ配信API（1シート＝1大カード）
 *
 * シート構成（ページの上から順）
 *   表紙            … ヘッダー / フッター / 申請フォーム
 *   サーバーの特徴   … 友好協定 など（カードを足せば中カードが増える）
 *   サーバーの約束   … 基本ルール / 違反対応 / バフ使用ガイド
 *   イベントガイド   … 最強王国 / 特典 / その他イベント
 *   同盟紹介        … 時間表 / 同盟
 *
 * 全シート共通の列：カード | 行の種類 | タイトル | 文章 | 表示
 *   カード   … ページのどのカードに出すか
 *   行の種類 … 「見出し」＝カードのタイトルと説明文、「中身」＝カードの中の1行
 *   表示     … 「非表示」にすると行を消さずにページから隠せる
 *   並び順   … シート上の行の順番がそのまま表示順
 *
 * シート名を変えても、タブの順番（表紙→特徴→約束→イベント→同盟）がそのままなら修正不要。
 * ※ このファイルの中身を編集する必要はありません。編集はすべてスプレッドシートで行います。
 */

const SHEET_ID = '1vZQuzRFY62wWvovICo33Mj0ARVKG29NxctgujrQngtE';
const CACHE_SECONDS = 60;   // 表示高速化のためのキャッシュ秒数（0で無効）

// シート（キー＝JSONのキー）
//   name  … まずこの名前でシートを探す
//   index … 名前で見つからない時は、左から何番目のタブか（1始まり）で探す
//   → シート名を変えても、タブの順番がそのままならGASの修正は不要
const SHEETS = {
  cover:    { name: '表紙',           index: 1 },
  feature:  { name: 'サーバーの特徴', index: 2 },
  promise:  { name: 'サーバーの約束', index: 3 },
  event:    { name: 'イベントガイド', index: 4 },
  alliance: { name: '同盟紹介',       index: 5 },
};

const BASE_COLS = ['カード', '行の種類', 'タイトル', '文章', '表示'];

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

  values.forEach(row => {
    const card = get(row, 'カード');
    if (!card) return;
    const show = get(row, '表示');
    if (show === '非表示' || show.toUpperCase() === 'FALSE') return;   // 非表示の行は出さない

    const type = get(row, '行の種類') || '中身';
    const title = get(row, 'タイトル');
    const body = get(row, '文章');

    if (card === 'セクション') {
      if (type === '見出し') result.title = title;
      return;
    }

    const c = result.cards[card] || (result.cards[card] = { title: '', desc: '', items: [] });
    if (type === '見出し') {
      c.title = title;
      c.desc = body;
      return;
    }

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

/** シートを名前で探し、無ければタブの順番で探す */
function findSheet_(ss, key) {
  const def = SHEETS[key];
  const byName = ss.getSheetByName(def.name);
  if (byName) return byName;
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
