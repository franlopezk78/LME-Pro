import React, { useState, useEffect, useRef } from 'react';
import { 
  Share2, RefreshCw, ShoppingBasket, Edit3, ShoppingCart, 
  Plus, Mic, Trash2, CheckCircle, ChevronDown, 
  Settings, Brain, Save, Loader2, 
  Star, Minus, PlusCircle, GripVertical, Camera, FolderOpen, Download
} from 'lucide-react';
import type { ShoppingItem } from './types';
import { CATALOG_DATA } from './constants';

// Drag & Drop
import type { DragEndEvent } from '@dnd-kit/core';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableItem = ({ item, toggleItem, deleteItem, updateQuantity, toggleFavorite, activeTheme, mode }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto' };

  return (
    <div ref={setNodeRef} style={style} className={`group flex flex-col gap-3 p-5 rounded-[2.5rem] glass-panel transition-all duration-300 ${isDragging ? 'shadow-2xl opacity-80 ring-2 ring-violet-500 scale-105' : ''} ${item.checked ? 'opacity-40 scale-[0.98]' : 'hover:shadow-lg'}`}>
      <div className="flex items-center gap-4">
        <div onClick={() => toggleItem(item.id)} className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 cursor-pointer shrink-0 ${item.checked ? 'bg-slate-400 border-slate-400' : 'border-slate-300 dark:border-slate-600'}`}>
          {item.checked && <CheckCircle size={24} className="text-white" strokeWidth={3} />}
        </div>
        <div className="flex-1 min-w-0" onClick={() => toggleItem(item.id)}>
          <div className="flex flex-col">
            <p className={`text-lg font-bold transition-all duration-300 leading-tight ${item.checked ? 'line-through text-slate-500 opacity-50' : 'text-slate-800 dark:text-white'}`}>
              {item.text}
            </p>
            {item.price && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{item.price.toFixed(2)}€</span>
                {item.priceTrend === 'up' && <span className="text-[10px] font-black text-red-500 flex items-center animate-pulse">▲</span>}
                {item.priceTrend === 'down' && <span className="text-[10px] font-black text-green-500 flex items-center animate-pulse">▼</span>}
              </div>
            )}
          </div>
        </div>
        {mode === 'edit' && (
          <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl p-1 shrink-0">
            <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-colors"><Minus size={16} strokeWidth={3} /></button>
            <span className="text-base font-black w-6 text-center">{item.quantity}</span>
            <button onClick={() => updateQuantity(item.id, 1)} className={`p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-colors ${activeTheme.text}`}><PlusCircle size={16} strokeWidth={3} /></button>
          </div>
        )}
      </div>
      {mode === 'edit' && (
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-3">
            <button {...attributes} {...listeners} className="text-slate-300 dark:text-slate-600"><GripVertical size={18} /></button>
            <span className="text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800" style={{ color: item.catColor }}>{item.catName}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => toggleFavorite(item.id)} className={`p-2 rounded-xl transition-colors ${item.isFavorite ? 'bg-amber-400/10 text-amber-500' : 'text-slate-300 dark:text-slate-600'}`}><Star size={20} className={item.isFavorite ? 'fill-amber-500' : ''} /></button>
            <button onClick={() => deleteItem(item.id)} className="p-2 rounded-xl text-slate-300 dark:text-slate-600 hover:bg-red-500/10 hover:text-red-500 transition-colors"><Trash2 size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const APP_VERSION = "8.1 - Shop Mode Final";
  
  const [items, setItems] = useState<ShoppingItem[]>(() => JSON.parse(localStorage.getItem('lme_items_pro') || '[]'));
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('lme_gemini_key') || '');
  const [themeColor, setThemeColor] = useState<string>(localStorage.getItem('lme_theme_color') || 'violet');
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<'edit' | 'shop'>('edit');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [priceHistory, setPriceHistory] = useState<Record<string, number>>(() => JSON.parse(localStorage.getItem('lme_price_history') || '{}'));
  const [isDark, setIsDark] = useState(() => localStorage.getItem('lme_dark_mode') === 'true');
  const [savedLists, setSavedLists] = useState<any[]>(() => JSON.parse(localStorage.getItem('lme_saved_lists') || '[]'));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => { localStorage.setItem('lme_items_pro', JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem('lme_gemini_key', apiKey.trim()); }, [apiKey]);
  useEffect(() => { localStorage.setItem('lme_theme_color', themeColor); }, [themeColor]);
  useEffect(() => { localStorage.setItem('lme_price_history', JSON.stringify(priceHistory)); }, [priceHistory]);
  useEffect(() => { localStorage.setItem('lme_saved_lists', JSON.stringify(savedLists)); }, [savedLists]);
  
  useEffect(() => {
    localStorage.setItem('lme_dark_mode', isDark.toString());
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0B0F19';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#F8FAFC';
    }
  }, [isDark]);

  const themes: Record<string, any> = {
    violet: { from: 'from-violet-500', to: 'to-fuchsia-500', shadow: 'shadow-violet-500/30', text: 'text-violet-500', bg: 'bg-violet-500' },
    blue: { from: 'from-blue-500', to: 'to-cyan-500', shadow: 'shadow-blue-500/30', text: 'text-blue-500', bg: 'bg-blue-500' },
    emerald: { from: 'from-emerald-500', to: 'to-teal-500', shadow: 'shadow-emerald-500/30', text: 'text-emerald-500', bg: 'bg-emerald-500' },
    rose: { from: 'from-rose-500', to: 'to-pink-500', shadow: 'shadow-rose-500/30', text: 'text-rose-500', bg: 'bg-rose-500' },
    amber: { from: 'from-amber-500', to: 'to-orange-500', shadow: 'shadow-amber-500/30', text: 'text-amber-500', bg: 'bg-amber-500' },
  };
  const activeTheme = themes[themeColor] || themes.violet;

  const playBeep = (type: 'start' | 'stop') => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(type === 'start' ? 440 : 880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(type === 'start' ? 880 : 440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;
    const recognition = new SpeechRec();
    recognition.lang = 'es-ES';
    recognition.onstart = () => { setIsListening(true); setTranscript(''); playBeep('start'); };
    recognition.onresult = (e: any) => setTranscript(e.results[0][0].transcript);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    if (!isListening && transcript.trim()) {
      playBeep('stop');
      processVoiceSmart(transcript);
    }
  }, [isListening, transcript]);

  const toggleListening = () => {
    if (isListening) recognitionRef.current?.stop();
    else { setTranscript(''); try { recognitionRef.current?.start(); } catch (e) { recognitionRef.current?.stop(); } }
  };

  const addItem = (text: string, category?: string, price?: number) => {
    if (!text.trim()) return;
    const cleanText = text.trim().charAt(0).toUpperCase() + text.trim().slice(1).toLowerCase();
    
    let finalCat = "⚪ Varios";
    let finalColor = "#94a3b8";

    const catToSearch = (category || "").trim().toLowerCase();
    const found = CATALOG_DATA.find(c => 
      (catToSearch !== "" && c.c.toLowerCase() === catToSearch) || 
      c.items.some(i => i.n.toLowerCase() === cleanText.toLowerCase())
    );

    if (found) {
      finalCat = found.c;
      finalColor = found.col;
    }

    let trend: 'up' | 'down' | 'equal' | undefined;
    if (price && priceHistory[cleanText]) {
      if (price > priceHistory[cleanText]) trend = 'up';
      else if (price < priceHistory[cleanText]) trend = 'down';
      else trend = 'equal';
    }

    if (price) {
      setPriceHistory(prev => ({ ...prev, [cleanText]: price }));
    }

    setItems(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      text: cleanText,
      checked: false,
      catName: finalCat,
      catColor: finalColor,
      quantity: 1,
      isFavorite: false,
      price: price,
      priceTrend: trend
    }, ...prev]);
  };

  const processVoiceSmart = async (t: string) => {
    if (!apiKey) {
      t.split(/ y |,|\./i).forEach(p => addItem(p));
      return;
    }
    setIsProcessing(true);
    try {
      const prompt = `Clasifica productos en JSON: {"items": [{"name": "producto", "category": "Categoría"}]}. 
      CATEGORÍAS OBLIGATORIAS: Verduras, Frutas, Carne, Pescado, Lácteos, Charcutería, Despensa, Pan, Limpieza, Mascotas, Varios. 
      La LEJÍA siempre es Limpieza. El POLLO es Carne.
      Texto: "${t}"`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey.trim()}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } })
      });
      const data = await response.json();
      let res = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
      const result = JSON.parse(res);
      result.items.forEach((i: any) => addItem(i.name, i.category, i.price));
    } catch (e) { t.split(/ y |,|\./i).forEach(p => addItem(p)); }
    setIsProcessing(false); setTranscript('');
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !apiKey) return;
    setIsProcessing(true);
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const prompt = `Analiza este ticket de compra. Extrae los productos, sus nombres limpios, su categoría y SU PRECIO UNITARIO. Devuelve SOLO JSON: {"items": [{"name": "producto", "category": "Categoría", "price": 0.0}]}`;
          
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey.trim()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: file.type, data: base64 } }
                ]
              }],
              generationConfig: { response_mime_type: "application/json" }
            })
          });

          const data = await response.json();
          let res = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
          const result = JSON.parse(res);
          result.items.forEach((i: any) => addItem(i.name, i.category, i.price));
        } catch (err) {
          setError("Error analizando el ticket");
          setTimeout(() => setError(null), 3000);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Error al leer el ticket");
      setIsProcessing(false);
      setTimeout(() => setError(null), 3000);
    }
  };

  const shareWhatsApp = () => {
    const f = items.filter(i => !i.checked);
    if (f.length === 0) return;
    const t = "🛒 *EviShop*\n\n" + f.map(i => `• ${i.quantity > 1 ? `[${i.quantity}] ` : ''}${i.text}`).join('\n');
    window.open("whatsapp://send?text=" + encodeURIComponent(t), '_blank');
  };

  const saveCurrentList = () => {
    if (items.length === 0) return;
    const name = prompt("Nombre de la lista (ej: Compra Mensual):");
    if (!name) return;
    const newList = { id: Date.now(), name, items: [...items] };
    setSavedLists(prev => [newList, ...prev]);
    setError("¡Lista guardada!");
    setTimeout(() => setError(null), 2000);
  };

  const loadList = (listItems: ShoppingItem[]) => {
    if (confirm("¿Cargar esta lista? Se borrará la actual.")) {
      setItems(listItems);
      setIsCatalogOpen(false);
      setShowSettings(false);
      setMode('edit');
    }
  };

  const deleteSavedList = (id: number) => {
    if (confirm("¿Borrar esta lista guardada?")) {
      setSavedLists(prev => prev.filter(l => l.id !== id));
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return 0;
  });

  return (
    <div className={`min-h-screen max-w-lg mx-auto relative flex flex-col font-sans transition-colors duration-500 ${isDark ? 'bg-[#0B0F19]' : 'bg-slate-50'}`}>
      <header className="p-6 glass-header sticky top-0 z-40 transition-all duration-300">
        <div className="flex items-center justify-between gap-4">
          {mode === 'edit' && (
            <button onClick={() => document.getElementById('ticket-input')?.click()} className={`p-2.5 rounded-2xl bg-white dark:bg-slate-800 shadow-lg ${activeTheme.text} active:scale-90 transition-transform`}>
              <Camera size={22} strokeWidth={2.5} />
              <input id="ticket-input" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptUpload} />
            </button>
          )}
          
          <button 
            onClick={() => { setShowSettings(false); setIsCatalogOpen(false); setMode('edit'); }}
            className={`text-center flex-1 active:scale-95 transition-transform ${mode === 'shop' ? 'ml-0' : ''}`}
          >
            <h1 className="text-2xl font-extrabold tracking-tight dark:text-white">Evi<span className={`text-transparent bg-clip-text bg-gradient-to-r ${activeTheme.from} ${activeTheme.to}`}>Shop</span></h1>
          </button>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowSettings(!showSettings)} className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 text-slate-500 shadow-lg"><Settings size={20} /></button>
            <button onClick={() => setMode(mode === 'edit' ? 'shop' : 'edit')} className={`p-2.5 rounded-2xl shadow-lg transition-all ${mode === 'shop' ? `bg-gradient-to-br ${activeTheme.from} ${activeTheme.to} text-white` : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
              {mode === 'edit' ? <ShoppingCart size={20} /> : <Edit3 size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main className={`flex-1 p-6 overflow-y-auto ${mode === 'edit' ? 'pb-48' : 'pb-10'}`}>
        {items.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 opacity-30 gap-4"><ShoppingBasket size={80} /><p className="text-xl font-bold">Cesta vacía</p></div> : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e: DragEndEvent) => { 
            const { active, over } = e;
            if (over && active.id !== over.id) { 
              const o = items.findIndex(i => i.id === active.id); 
              const n = items.findIndex(i => i.id === over.id); 
              setItems(arrayMove(items, o, n)); 
            } 
          }}>
            <div className="space-y-3">
              <SortableContext items={sortedItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {sortedItems.map(item => (
                  <SortableItem key={item.id} item={item} toggleItem={(id: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i))} deleteItem={(id: string) => setItems(prev => prev.filter(i => i.id !== id))} updateQuantity={(id: string, d: number) => setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, (i.quantity || 1) + d) } : i))} toggleFavorite={(id: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, isFavorite: !i.isFavorite } : i))} activeTheme={activeTheme} mode={mode} />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        )}
      </main>

      {isListening && (
        <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-8 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-[3rem] p-8 w-full max-w-xs text-center flex flex-col items-center gap-6 shadow-2xl">
            <div className="bg-red-500 p-8 rounded-full animate-pulse"><Mic size={48} className="text-white" /></div>
            <p className="text-lg font-bold text-slate-500 italic">"{transcript || 'Dime...'}"</p>
            <button onClick={toggleListening} className="w-full py-4 bg-red-500 text-white rounded-3xl font-black">PARAR</button>
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <nav className="fixed bottom-0 inset-x-0 p-6 flex flex-col items-center gap-6 pointer-events-none z-40">
          <div className="w-full max-w-sm flex gap-3 pointer-events-auto">
            <button onClick={() => setIsCatalogOpen(!isCatalogOpen)} className={`p-4 rounded-3xl glass-panel shadow-2xl transition-all ${isCatalogOpen ? activeTheme.bg + ' text-white border-0' : 'text-slate-500'}`}><ShoppingCart size={24} /></button>
            <div className="flex-1 flex glass-panel rounded-3xl overflow-hidden shadow-2xl pl-2">
              <input type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (addItem(manualInput), setManualInput(''))} placeholder="¿Qué compras?" className="flex-1 px-4 bg-transparent outline-none font-bold dark:text-white" />
              <button onClick={() => { addItem(manualInput); setManualInput(''); }} className={`p-4 bg-slate-100 dark:bg-slate-800 ${activeTheme.text}`}><Plus size={24} /></button>
            </div>
          </div>
          <div className="flex gap-4 pointer-events-auto">
            <button onClick={() => { if(confirm("¿Vaciar?")) setItems([]); }} className="p-4 rounded-3xl glass-panel text-slate-500 shadow-xl"><RefreshCw size={24} /></button>
            <button onClick={toggleListening} className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center shadow-2xl transition-all ${isListening ? 'bg-red-500' : `bg-gradient-to-br ${activeTheme.from} ${activeTheme.to} ${activeTheme.shadow}`}`}><Mic size={36} className="text-white" /></button>
            <button onClick={shareWhatsApp} className="p-4 rounded-3xl bg-green-500 text-white shadow-xl"><Share2 size={24} /></button>
          </div>
        </nav>
      )}

      {showSettings && (
        <section className="absolute inset-0 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-2xl z-[80] p-8 flex flex-col gap-6 animate-slide-up overflow-y-auto">
          <div className="flex items-center gap-4 mt-4">
            <div className={`p-4 rounded-3xl bg-gradient-to-br ${activeTheme.from} ${activeTheme.to} shadow-lg ${activeTheme.shadow} text-white`}><Brain size={32} /></div>
            <div><h2 className="text-3xl font-bold dark:text-white">EviShop Pro</h2><p className="text-slate-500 font-medium">v{APP_VERSION}</p></div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border dark:border-slate-700 flex flex-col gap-4 shadow-sm">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><FolderOpen size={14} /> Gestión de Listas</h3>
            <button onClick={saveCurrentList} className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-white shadow-lg bg-gradient-to-r ${activeTheme.from} ${activeTheme.to}`}><Save size={20} /> GUARDAR LISTA ACTUAL</button>
            
            <div className="space-y-3 mt-2">
              {savedLists.map(list => (
                <div key={list.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-800">
                  <div className="flex-1 cursor-pointer" onClick={() => loadList(list.items)}>
                    <p className="font-bold text-sm dark:text-white">{list.name}</p>
                    <p className="text-[10px] text-slate-500">{list.items.length} productos</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => loadList(list.items)} className={`p-2 rounded-xl bg-white dark:bg-slate-800 ${activeTheme.text} shadow-sm border dark:border-slate-700`}><Download size={18} /></button>
                    <button onClick={() => deleteSavedList(list.id)} className="p-2 rounded-xl bg-white dark:bg-slate-800 text-red-500 shadow-sm border dark:border-slate-700"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2"><label className="text-xs font-black uppercase text-slate-400">Gemini API Key</label><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza..." className="w-full p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 dark:text-white outline-none" /></div>
          <div className="space-y-2"><label className="text-xs font-black uppercase text-slate-400">Color App</label><div className="flex justify-between gap-2 p-4 bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700">{['violet', 'blue', 'emerald', 'rose', 'amber'].map(t => <button key={t} onClick={() => setThemeColor(t)} className={`w-10 h-10 rounded-full bg-gradient-to-br ${themes[t].from} ${themes[t].to} ${themeColor === t ? 'ring-4 ring-slate-200 dark:ring-slate-600' : ''}`} />)}</div></div>
          
          <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700">
            <span className="text-sm font-bold dark:text-white">Modo Oscuro</span>
            <button onClick={() => setIsDark(!isDark)} className={`w-14 h-8 rounded-full transition-all relative ${isDark ? 'bg-violet-500' : 'bg-slate-200'}`}>
              <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${isDark ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <button onClick={() => { if(confirm("¿Seguro? Se borrará TODO.")) { localStorage.clear(); window.location.reload(); } }} className="mt-4 p-5 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-3xl font-bold text-xs">RESTAURAR APLICACIÓN</button>
          <button onClick={() => setShowSettings(false)} className={`mt-auto w-full py-5 bg-gradient-to-r ${activeTheme.from} ${activeTheme.to} text-white rounded-3xl font-bold flex items-center justify-center gap-3 shadow-xl`}><Save size={24} /> VOLVER A LA COMPRA</button>
        </section>
      )}

      {isCatalogOpen && (
        <section className="absolute inset-x-0 top-20 bottom-0 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-2xl z-30 p-4 overflow-y-auto animate-slide-up pb-48 text-center">
          <button onClick={() => setIsCatalogOpen(false)} className="w-full py-3 bg-slate-800 text-white rounded-2xl font-bold mb-4 flex items-center justify-center gap-2">CERRAR <ChevronDown /></button>
          {CATALOG_DATA.map(cat => (
            <div key={cat.c} className="mb-6"><h3 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">{cat.c}</h3><div className="grid grid-cols-3 gap-2">{cat.items.map(i => <button key={i.n} onClick={() => addItem(i.n)} className="flex flex-col items-center p-3 glass-panel rounded-3xl active:scale-95 transition-transform"><span className="text-2xl">{i.e}</span><span className="text-[10px] font-bold mt-1 dark:text-white">{i.n}</span></button>)}</div></div>
          ))}
        </section>
      )}

      {isProcessing && <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center"><div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-2xl flex flex-col items-center gap-4"><Loader2 className="w-10 h-10 text-violet-500 animate-spin" /><p className="font-black text-[10px] text-violet-500 uppercase tracking-widest text-center">Evi leyendo ticket...</p></div></div>}
      {error && <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl z-[110] text-sm">{error}</div>}
    </div>
  );
};

export default App;
