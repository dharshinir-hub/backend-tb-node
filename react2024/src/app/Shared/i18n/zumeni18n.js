// zumeni18n.js
// Lightweight JP + EN i18n for the ZUMEN / Paperless Factory pages.
// No external dependency: a dictionary + a localStorage-backed `useT()` hook that
// re-renders subscribers when the language changes. Extend DICT as needed.

import React, { useState, useEffect, useCallback } from 'react';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';

export const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日本語' },
];

const STORAGE_KEY = 'zumen_lang';
const EVT = 'zumen-lang-change';

export const getLang = () => {
  try { return localStorage.getItem(STORAGE_KEY) || 'en'; } catch (e) { return 'en'; }
};
export const setLang = (lang) => {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
};

// Translation dictionary. Keys are dotted; English is the fallback.
const DICT = {
  en: {
    'ppw.title': 'Paperless Factory',
    'ppw.subtitle': 'Drawing & document management',
    'drawings': 'Drawings',
    'drawings.add': '+ Add new drawings',
    'bulk.ops': 'Bulk Operations',
    'bulk.done': 'Done',
    'search.free': 'Free word search',
    'search.title': 'Search',
    'search.clearAll': 'Clear all',
    'orders.title': 'Projects / Orders',
    'orders.subtitle': 'Order-to-delivery lifecycle',
    'orders.new': 'New project',
    'orders.reportList': 'Report list',
    'orders.all': 'All',
    'col.status': 'Status',
    'col.client': 'Client name',
    'col.drawingNo': 'Drawing number',
    'col.product': 'Product',
    'col.delivery': 'Delivery date',
    'col.quotationNo': 'Quotation No.',
    'col.volume': 'Volume',
    'col.unit': 'Unit',
    'col.unitPrice': 'Unit price',
    'action.detail': 'Detail',
    'assembly.title': 'Assembly hierarchy',
    'assembly.edit': 'Edit hierarchy',
    'assembly.addPart': 'Add part',
    'doc.revisions': 'Revisions',
  },
  ja: {
    'ppw.title': 'ペーパーレス工場',
    'ppw.subtitle': '図面・ドキュメント管理',
    'drawings': '図面',
    'drawings.add': '＋ 図面を追加',
    'bulk.ops': '一括操作',
    'bulk.done': '完了',
    'search.free': 'フリーワード検索',
    'search.title': '検索',
    'search.clearAll': 'すべてクリア',
    'orders.title': 'プロジェクト / 受注',
    'orders.subtitle': '受注から納品までの工程',
    'orders.new': '新規プロジェクト',
    'orders.reportList': 'レポート一覧',
    'orders.all': 'すべて',
    'col.status': 'ステータス',
    'col.client': '顧客名',
    'col.drawingNo': '図番',
    'col.product': '製品',
    'col.delivery': '納期',
    'col.quotationNo': '見積番号',
    'col.volume': '数量',
    'col.unit': '単位',
    'col.unitPrice': '単価',
    'action.detail': '詳細',
    'assembly.title': '組立階層',
    'assembly.edit': '階層を編集',
    'assembly.addPart': '部品を追加',
    'doc.revisions': '版数',
  },
};

// Hook: returns { t, lang, setLang }. Re-renders when the language changes.
export const useT = () => {
  const [lang, setL] = useState(getLang());
  useEffect(() => {
    const h = () => setL(getLang());
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  const t = useCallback(
    (key) => (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key,
    [lang]
  );
  return { t, lang, setLang };
};

// Small EN / 日本語 toggle for page toolbars.
export const LangToggle = (props) => {
  const { lang, setLang: set } = useT();
  return (
    <ToggleButtonGroup size="small" exclusive value={lang}
      onChange={(e, v) => v && set(v)} {...props}>
      {LANGS.map((l) => (
        <ToggleButton key={l.code} value={l.code} sx={{ textTransform: 'none', px: 1, py: 0.25 }}>
          {l.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
};
