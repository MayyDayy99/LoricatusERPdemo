'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

/**
 * Dependency-mentes vizuális emoji-választó. Curated lista — a leggyakrabban
 * használt munkához/üzlethez kapcsolódó emojikkal, kategóriákba szedve, magyar
 * kulcsszavas kereséssel. A task-type admin (és bárhol máshol) használhatja egy
 * popover-ben a nyers szöveg-input helyett.
 */

interface EmojiEntry {
  e: string;
  kw: string; // szóközzel elválasztott magyar kulcsszavak a kereséshez
}

const CATEGORIES: Array<{ id: string; label: string; emojis: EmojiEntry[] }> = [
  {
    id: 'work',
    label: 'Munka / üzlet',
    emojis: [
      { e: '🧾', kw: 'számla nyugta' }, { e: '💰', kw: 'pénz zsák' },
      { e: '💲', kw: 'pénz dollár' }, { e: '💵', kw: 'pénz bankjegy' },
      { e: '💳', kw: 'kártya fizetés' }, { e: '📄', kw: 'dokumentum lap papír' },
      { e: '📃', kw: 'dokumentum görbülő' }, { e: '📋', kw: 'vágólap lista' },
      { e: '📑', kw: 'könyvjelző dokumentum' }, { e: '✅', kw: 'pipa kész' },
      { e: '☑️', kw: 'pipa négyzet' }, { e: '📐', kw: 'vonalzó mérés' },
      { e: '📏', kw: 'vonalzó hossz' }, { e: '🔧', kw: 'csavarkulcs szerszám' },
      { e: '🔨', kw: 'kalapács szerszám' }, { e: '⚙️', kw: 'fogaskerék gépidő beállítás' },
      { e: '🛠️', kw: 'szerszám javítás' }, { e: '📊', kw: 'diagram statisztika' },
      { e: '📈', kw: 'növekedés grafikon' }, { e: '📉', kw: 'csökkenés grafikon' },
      { e: '🗂️', kw: 'mappa irattartó' }, { e: '📁', kw: 'mappa' },
      { e: '📂', kw: 'nyitott mappa' }, { e: '🗄️', kw: 'iratszekrény' },
      { e: '✏️', kw: 'ceruza szerkesztés' }, { e: '🖊️', kw: 'toll' },
      { e: '🖋️', kw: 'töltőtoll aláírás' }, { e: '📝', kw: 'jegyzet írás' },
      { e: '💼', kw: 'aktatáska munka' }, { e: '🏢', kw: 'iroda épület' },
      { e: '🏦', kw: 'bank' }, { e: '📅', kw: 'naptár' },
      { e: '📆', kw: 'naptár dátum' }, { e: '⏰', kw: 'óra ébresztő határidő' },
      { e: '⏳', kw: 'homokóra idő' }, { e: '📞', kw: 'telefon hívás' },
      { e: '📧', kw: 'email levél' }, { e: '🔑', kw: 'kulcs' },
      { e: '🔒', kw: 'lakat zárt' }, { e: '🤝', kw: 'kézfogás megállapodás' },
    ],
  },
  {
    id: 'field',
    label: 'Drón / terep',
    emojis: [
      { e: '🚁', kw: 'helikopter drón' }, { e: '🛸', kw: 'ufo drón' },
      { e: '📡', kw: 'antenna jel' }, { e: '🛰️', kw: 'műhold' },
      { e: '📸', kw: 'fényképező kamera' }, { e: '📷', kw: 'fényképező' },
      { e: '🎥', kw: 'videó kamera' }, { e: '🗺️', kw: 'térkép' },
      { e: '🧭', kw: 'iránytű navigáció' }, { e: '📍', kw: 'helyjelölő pin' },
      { e: '🌳', kw: 'fa zöld' }, { e: '🌲', kw: 'fenyő erdő' },
      { e: '🌿', kw: 'növény zöld' }, { e: '🏞️', kw: 'táj természet' },
      { e: '🏗️', kw: 'építkezés daru' }, { e: '🚧', kw: 'útlezárás építés' },
      { e: '🏘️', kw: 'házak telep' }, { e: '🏠', kw: 'ház' },
      { e: '⛏️', kw: 'csákány bányászat' }, { e: '🪨', kw: 'kő szikla' },
      { e: '🌐', kw: 'földgömb hálózat' }, { e: '☀️', kw: 'nap időjárás' },
      { e: '🌧️', kw: 'eső időjárás' }, { e: '❄️', kw: 'hó tél' },
      { e: '🚜', kw: 'traktor mezőgazdaság' }, { e: '🪵', kw: 'fatörzs fa' },
    ],
  },
  {
    id: 'signs',
    label: 'Jelek / státusz',
    emojis: [
      { e: '⭐', kw: 'csillag kedvenc' }, { e: '🌟', kw: 'ragyogó csillag' },
      { e: '🔥', kw: 'tűz fontos' }, { e: '⚡', kw: 'villám gyors' },
      { e: '🎯', kw: 'célpont' }, { e: '📌', kw: 'rajzszög tűzés' },
      { e: '🏁', kw: 'célzászló befejezés' }, { e: '🚩', kw: 'zászló jelölés' },
      { e: '❗', kw: 'felkiáltójel fontos' }, { e: '❓', kw: 'kérdőjel' },
      { e: '⚠️', kw: 'figyelmeztetés veszély' }, { e: '🔴', kw: 'piros kör' },
      { e: '🟠', kw: 'narancs kör' }, { e: '🟡', kw: 'sárga kör' },
      { e: '🟢', kw: 'zöld kör' }, { e: '🔵', kw: 'kék kör' },
      { e: '🟣', kw: 'lila kör' }, { e: '⚫', kw: 'fekete kör' },
      { e: '🔼', kw: 'fel nyíl' }, { e: '🔽', kw: 'le nyíl' },
      { e: '➡️', kw: 'jobb nyíl' }, { e: '🔄', kw: 'körforgás ismétlés' },
      { e: '🔔', kw: 'csengő értesítés' }, { e: '💡', kw: 'ötlet villanykörte' },
      { e: '🆕', kw: 'új' }, { e: '🆗', kw: 'ok rendben' },
      { e: '🔝', kw: 'top kiemelt' }, { e: '✨', kw: 'csillám új' },
    ],
  },
  {
    id: 'misc',
    label: 'Általános',
    emojis: [
      { e: '👍', kw: 'hüvelyk fel jó' }, { e: '👌', kw: 'ok rendben' },
      { e: '👏', kw: 'taps' }, { e: '✋', kw: 'kéz állj' },
      { e: '🙌', kw: 'kezek ünneplés' }, { e: '💪', kw: 'izom erő' },
      { e: '😀', kw: 'mosoly arc' }, { e: '😎', kw: 'menő napszemüveg' },
      { e: '🤔', kw: 'gondolkodás' }, { e: '🎉', kw: 'konfetti ünnep' },
      { e: '🚀', kw: 'rakéta indulás' }, { e: '🏆', kw: 'kupa győzelem' },
      { e: '🥇', kw: 'arany érem első' }, { e: '🎁', kw: 'ajándék' },
      { e: '📦', kw: 'doboz csomag' }, { e: '🔍', kw: 'nagyító keresés' },
      { e: '🧩', kw: 'puzzle kirakó' }, { e: '🛒', kw: 'bevásárlókocsi' },
      { e: '🍀', kw: 'lóhere szerencse' }, { e: '☕', kw: 'kávé szünet' },
      { e: '🎨', kw: 'paletta grafika' }, { e: '🖥️', kw: 'számítógép monitor' },
      { e: '💻', kw: 'laptop' }, { e: '📱', kw: 'mobiltelefon' },
      { e: '🔋', kw: 'akkumulátor' }, { e: '🌍', kw: 'föld bolygó' },
    ],
  },
];

export function EmojiPicker({
  value,
  onSelect,
  onClose,
}: {
  value?: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState(CATEGORIES[0].id);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [onClose]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      // Keresés minden kategórián át
      return CATEGORIES.flatMap(c => c.emojis).filter(
        em => em.kw.includes(q) || em.e === q,
      );
    }
    return CATEGORIES.find(c => c.id === cat)?.emojis ?? [];
  }, [cat, query]);

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
      style={{ left: 0, top: '100%' }}
    >
      {/* Kereső */}
      <div className="p-2 border-b border-gray-100">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Keresés… (pl. számla, drón, pipa)"
          autoFocus
          className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {/* Kategória-fülek (csak ha nincs keresés) */}
      {!query.trim() && (
        <div className="flex border-b border-gray-100 bg-gray-50">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={
                'flex-1 text-[10px] py-1.5 transition ' +
                (cat === c.id
                  ? 'bg-white text-brand-700 font-semibold border-b-2 border-brand-600'
                  : 'text-gray-500 hover:text-gray-700')
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Emoji-grid */}
      <div className="p-2 grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
        {visible.map(em => (
          <button
            key={em.e}
            type="button"
            onClick={() => { onSelect(em.e); onClose(); }}
            title={em.kw}
            className={
              'aspect-square flex items-center justify-center text-lg rounded hover:bg-brand-50 transition ' +
              (value === em.e ? 'bg-brand-100 ring-1 ring-brand-400' : '')
            }
          >
            {em.e}
          </button>
        ))}
        {visible.length === 0 && (
          <div className="col-span-8 text-center text-xs text-gray-400 py-4">
            Nincs találat
          </div>
        )}
      </div>

      {/* Lábléc — törlés-opció */}
      <div className="px-2 py-1.5 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
        <span className="text-[10px] text-gray-400">Kattints egy emojira</span>
        <button
          type="button"
          onClick={() => { onSelect(''); onClose(); }}
          className="text-[10px] text-gray-500 hover:text-red-600"
        >
          Törlés
        </button>
      </div>
    </div>
  );
}
