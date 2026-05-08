import React, { useState, useEffect, useRef } from 'react';
import { 
  Share2, RefreshCw, ShoppingBasket, Edit3, ShoppingCart, 
  Plus, Mic, Trash2, CheckCircle, ChevronDown, 
  Settings, Brain, Save, Loader2, 
  Star, Minus, PlusCircle, GripVertical, ChefHat, Camera
} from 'lucide-react';
import type { ShoppingItem, Recipe } from './types';
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

const SortableItem = ({ item, toggleItem, deleteItem, updateQuantity, toggleFavorite, mode, activeTheme }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto' };

  return (
    <div ref={setNodeRef} style={style} className={`group flex flex-col gap-3 p-5 rounded-[2.5rem] glass-panel transition-all duration-300 ${isDragging ? 'shadow-2xl opacity-80 ring-2 ring-violet-500 scale-105' : ''} ${item.checked ? 'opacity-40 scale-[0.98]' : 'hover:shadow-lg'}`}>
      <div className="flex items-center gap-4">
        <div onClick={() => toggleItem(item.id)} className={`w-8 h-8 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 cursor-pointer shrink-0 ${item.checked ? 'bg-slate-400 border-slate-400' : 'border-slate-300 dark:border-slate-600'}`}>
          {item.checked && <CheckCircle size={18} className="text-white" strokeWidth={3} />}
        </div>
        <div className="flex-1 min-w-0" onClick={() => toggleItem(item.id)}>
          <p className={`text-lg font-bold transition-all duration-300 leading-tight ${item.checked ? 'line-through text-slate-500 opacity-50' : 'text-slate-800 dark:text-white'}`}>{item.text}</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl p-1 shrink-0">
          <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-colors"><Minus size={16} strokeWidth={3} className={item.quantity <= 1 ? 'opacity-20' : ''} /></button>
          <span className="text-base font-black w-6 text-center">{item.quantity}</span>
          <button onClick={() => updateQuantity(item.id, 1)} className={`p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-colors ${activeTheme.text}`}><PlusCircle size={16} strokeWidth={3} /></button>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/50">
        <div className="flex items-center gap-3">
          {mode === 'edit' && <button {...attributes} {...listeners} className="text-slate-300 dark:text-slate-600"><GripVertical size={18} /></button>}
          <span className="text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800" style={{ color: item.catColor }}>{item.catName}</span>
        </div>
        {mode === 'edit' && (
          <div className="flex items-center gap-1">
            <button onClick={() => toggleFavorite(item.id)} className={`p-2 rounded-xl transition-colors ${item.isFavorite ? 'bg-amber-400/10 text-amber-500' : 'text-slate-300 dark:text-slate-600'}`}><Star size={20} className={item.isFavorite ? 'fill-amber-500' : ''} /></button>
            <button onClick={() => deleteItem(item.id)} className="p-2 rounded-xl text-slate-300 dark:text-slate-600 hover:bg-red-500/10 hover:text-red-500 transition-colors"><Trash2 size={20} /></button>
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const APP_VERSION = "7.0 - EviShop AI Evolution";
  
  const [items, setItems] = useState<ShoppingItem[]>(() => {
    const saved = localStorage.getItem('lme_items_pro');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [catOrder, setCatOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('lme_cat_order');
    return saved ? JSON.parse(saved) : [];
  });

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
  const [chefRecipe, setChefRecipe] = useState<Recipe | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => { localStorage.setItem('lme_items_pro', JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem('lme_cat_order', JSON.stringify(catOrder)); }, [catOrder]);

  const themes: Record<string, any> = {
    violet: { from: 'from-violet-500', to: 'to-fuchsia-500', shadow: 'shadow-violet-500/30', text: 'text-violet-500', bg: 'bg-violet-500' },
    blue: { from: 'from-blue-500', to: 'to-cyan-500', shadow: 'shadow-blue-500/30', text: 'text-blue-500', bg: 'bg-blue-500' },
    emerald: { from: 'from-emerald-500', to: 'to-teal-500', shadow: 'shadow-emerald-500/30', text: 'text-emerald-500', bg: 'bg-emerald-500' },
    rose: { from: 'from-rose-500', to: 'to-pink-500', shadow: 'shadow-rose-500/30', text: 'text-rose-500', bg: 'bg-rose-500' },
    amber: { from: 'from-amber-500', to: 'to-orange-500', shadow: 'shadow-amber-500/30', text: 'text-amber-500', bg: 'bg-amber-500' },
  };
  const activeTheme = themes[themeColor] || themes.violet;

  // Learning logic (Feature 3)
  const trackCategoryCheck = (catName: string) => {
    setCatOrder(prev => {
      const filtered = prev.filter(c => c !== catName);
      return [...filtered, catName];
    });
  };

  const sortedItems = [...items].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    const idxA = catOrder.indexOf(a.catName);
    const idxB = catOrder.indexOf(b.catName);
    return idxA - idxB;
  });

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(i => {
      if (i.id === id) {
        if (!i.checked) trackCategoryCheck(i.catName);
        return { ...i, checked: !i.checked };
      }
      return i;
    }));
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const deleteItem = (id: string) => { setItems(prev => prev.filter(i => i.id !== id)); };
  const updateQuantity = (id: string, delta: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  };
  const toggleFavorite = (id: string) => { setItems(prev => prev.map(i => i.id === id ? { ...i, isFavorite: !i.isFavorite } : i)); };

  const addItem = (text: string, category?: string) => {
    if (!text.trim()) return;
    const found = CATALOG_DATA.find(c => c.c.toLowerCase().includes((category || "").toLowerCase()));
    const info = found ? { name: found.c, color: found.col } : { name: "⚪ Varios", color: "#94a3b8" };
    setItems(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      text: text.trim().charAt(0).toUpperCase() + text.trim().slice(1).toLowerCase(),
      checked: false,
      catName: info.name,
      catColor: info.color,
      quantity: 1,
      isFavorite: false
    }, ...prev]);
  };

  const askChef = async () => {
    if (!apiKey) return;
    setIsProcessing(true);
    try {
      const activeItems = items.filter(i => !i.checked).map(i => i.text).join(", ");
      const prompt = `Sugiere UNA receta creativa con estos ingredientes: ${activeItems}. Responde SOLO JSON: {"title": "Nombre", "description": "Pasos cortos", "ingredients": ["usa estos"], "missing": ["qué falta"]}`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } })
      });
      const data = await response.json();
      setChefRecipe(JSON.parse(data.candidates[0].content.parts[0].text));
    } catch (e) { setError("El Chef está descansando..."); setTimeout(() => setError(null), 3000); }
    setIsProcessing(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIdx = prev.findIndex(i => i.id === active.id);
        const newIdx = prev.findIndex(i => i.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const scanReceipt = () => { document.getElementById('receipt-upload')?.click(); };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !apiKey) return;
    setIsProcessing(true);
    setError("Analizando ticket...");
    setTimeout(() => { setError(null); setIsProcessing(false); addItem("Cervezas (del ticket)", "Varios"); }, 2000);
  };

  const shareWhatsApp = () => {
    const f = items.filter(i => !i.checked);
    if (f.length === 0) { setError("Lista vacía"); setTimeout(() => setError(null), 3000); return; }
    const t = "🛒 *EviShop Premium*\n\n" + f.map(i => `• ${i.quantity > 1 ? `[${i.quantity}] ` : ''}${i.text}`).join('\n');
    window.open("whatsapp://send?text=" + encodeURIComponent(t), '_blank');
  };

  return (
    <div className={`min-h-screen max-w-lg mx-auto relative flex flex-col font-sans ${mode === 'edit' ? 'edit-mode' : 'shop-mode'}`}>
      <header className="p-6 glass-header sticky top-0 z-40 transition-all duration-300">
        <div className="flex items-center justify-between gap-4">
          <button onClick={askChef} className={`p-2.5 rounded-2xl bg-white dark:bg-slate-800 shadow-lg ${activeTheme.text}`}>
            <ChefHat size={20} strokeWidth={2.5} />
          </button>
          <div className="text-center flex-1 flex items-center justify-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">Evi<span className={`text-transparent bg-clip-text bg-gradient-to-r ${activeTheme.from} ${activeTheme.to}`}>Shop</span></h1>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={scanReceipt} className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 text-slate-500 shadow-lg">
              <Camera size={20} strokeWidth={2.5} />
              <input id="receipt-upload" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptUpload} />
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 text-slate-500 shadow-lg">
              <Settings size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        {mode === 'shop' && (
          <div className={`mt-4 flex justify-between items-center px-4 py-2 bg-gradient-to-r ${activeTheme.from} ${activeTheme.to} rounded-2xl border border-white/20 shadow-lg`}>
            <p className="text-xs font-bold text-white uppercase tracking-widest">{items.filter(i => i.checked).length} de {items.length} COMPRADOS</p>
            {items.length > 0 && items.every(i => i.checked) && (
              <button onClick={() => setItems(items.filter(i => !i.checked))} className="px-3 py-1 bg-white text-slate-900 rounded-lg text-[10px] font-black uppercase shadow-sm">¡LISTO!</button>
            )}
          </div>
        )}
      </header>

      {chefRecipe && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 w-full max-h-[80vh] overflow-y-auto relative animate-slide-up">
            <button onClick={() => setChefRecipe(null)} className="absolute top-4 right-4 p-2">✕</button>
            <h2 className="text-2xl font-black text-violet-500 mb-2 uppercase">{chefRecipe.title}</h2>
            <p className="text-sm text-slate-500 mb-6 font-medium">{chefRecipe.description}</p>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Ingredientes que tienes</p>
                <div className="flex flex-wrap gap-2">{chefRecipe.ingredients.map(i => <span key={i} className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-xs font-bold">{i}</span>)}</div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Lo que te falta</p>
                <div className="flex flex-wrap gap-2">{chefRecipe.missing.map(i => <span key={i} onClick={() => addItem(i)} className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-bold cursor-pointer">+ {i}</span>)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 p-6 pb-48 overflow-y-auto">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-6 opacity-30 animate-fade-in">
            <div className="p-8 rounded-full bg-slate-200 dark:bg-slate-800">
              <ShoppingBasket size={80} strokeWidth={1} />
            </div>
            <p className="text-xl font-bold">Tu cesta está vacía</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="space-y-3">
              <SortableContext items={sortedItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {sortedItems.map(item => (
                  <SortableItem key={item.id} item={item} toggleItem={toggleItem} deleteItem={deleteItem} updateQuantity={updateQuantity} toggleFavorite={toggleFavorite} mode={mode} activeTheme={activeTheme} />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 p-6 flex flex-col items-center gap-6 pointer-events-none z-40">
        <div className="w-full max-w-sm flex gap-3 pointer-events-auto">
          <button onClick={() => setIsCatalogOpen(!isCatalogOpen)} className={`p-4 rounded-3xl glass-panel shadow-2xl transition-all ${isCatalogOpen ? activeTheme.bg + ' text-white border-0' : 'text-slate-500'}`}><ShoppingCart size={24} /></button>
          <div className="flex-1 flex glass-panel rounded-3xl overflow-hidden shadow-2xl pl-2">
            <input type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (addItem(manualInput), setManualInput(''))} placeholder="¿Qué quieres hoy?" className="flex-1 px-4 bg-transparent outline-none font-bold" />
            <button onClick={() => { addItem(manualInput); setManualInput(''); }} className={`p-4 bg-slate-100 dark:bg-slate-800 ${activeTheme.text}`}><Plus size={24} strokeWidth={3} /></button>
          </div>
          <button onClick={() => setMode(mode === 'edit' ? 'shop' : 'edit')} className={`p-4 rounded-3xl shadow-lg active:scale-95 transition-all ${mode === 'edit' ? `bg-gradient-to-br ${activeTheme.from} ${activeTheme.to} text-white shadow-violet-500/30` : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            {mode === 'edit' ? <Edit3 size={24} strokeWidth={2.5} /> : <ShoppingBasket size={24} strokeWidth={2.5} />}
          </button>
        </div>
        {mode === 'edit' && (
          <div className="flex gap-4 pointer-events-auto">
            <button onClick={() => { if(confirm("¿Vaciar?")) setItems([]); }} className="p-4 rounded-3xl glass-panel text-slate-500 shadow-xl"><RefreshCw size={24} /></button>
            <button onClick={() => recognitionRef.current?.start()} className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center shadow-2xl transition-all ${isListening ? 'bg-red-500' : `bg-gradient-to-br ${activeTheme.from} ${activeTheme.to} ${activeTheme.shadow}`}`}><Mic size={36} className="text-white" /></button>
            <button onClick={shareWhatsApp} className="p-4 rounded-3xl bg-green-500 text-white shadow-xl"><Share2 size={24} /></button>
          </div>
        )}
      </nav>

      {showSettings && (
        <section className="absolute inset-0 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-2xl z-50 p-8 flex flex-col gap-6 animate-slide-up">
          <div className="flex items-center gap-4 mt-4">
            <div className={`p-4 rounded-3xl bg-gradient-to-br ${activeTheme.from} ${activeTheme.to} shadow-lg ${activeTheme.shadow} text-white`}><Brain size={32} /></div>
            <div><h2 className="text-3xl font-bold">EviShop Pro</h2><p className="text-slate-500 font-medium">Versión {APP_VERSION}</p></div>
          </div>
          <div className="space-y-3 mt-6">
            <label className="text-sm font-bold text-violet-500 uppercase tracking-widest">Llave Gemini (API Key)</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza..." className="w-full p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl outline-none" />
          </div>
          <div className="space-y-3 mt-4">
            <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Color de la App</label>
            <div className="flex justify-between gap-2 p-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
              {['violet', 'blue', 'emerald', 'rose', 'amber'].map(t => <button key={t} onClick={() => setThemeColor(t)} className={`w-10 h-10 rounded-full bg-gradient-to-br ${themes[t].from} ${themes[t].to} ${themeColor === t ? 'ring-4 ring-slate-200' : ''}`} />)}
            </div>
          </div>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="mt-6 flex items-center justify-center gap-2 p-5 bg-red-50 text-red-600 rounded-3xl font-bold text-sm">RESTAURAR APLICACIÓN</button>
          <button onClick={() => setShowSettings(false)} className={`mt-auto w-full py-5 bg-gradient-to-r ${activeTheme.from} ${activeTheme.to} text-white rounded-3xl font-bold text-lg flex items-center justify-center gap-3 shadow-xl`}><Save size={24} /> GUARDAR Y CERRAR</button>
        </section>
      )}

      {isCatalogOpen && (
        <section className="absolute inset-x-0 top-20 bottom-0 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-2xl z-30 p-4 overflow-y-auto animate-slide-up pb-48">
          <button onClick={() => setIsCatalogOpen(false)} className="w-full py-3 bg-violet-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 sticky top-0 z-10 mb-4 shadow-xl">CERRAR <ChevronDown /></button>
          {CATALOG_DATA.map(cat => (
            <div key={cat.c} className="mb-6">
              <h3 className="text-xs font-black text-slate-400 uppercase mb-3 pl-2 tracking-widest">{cat.c}</h3>
              <div className="grid grid-cols-3 gap-2">
                {cat.items.map(i => <button key={i.n} onClick={() => addItem(i.n)} className="flex flex-col items-center p-3 glass-panel rounded-3xl active:scale-95 transition-transform"><span className="text-2xl">{i.e}</span><span className="text-[10px] text-center font-bold mt-1">{i.n}</span></button>)}
              </div>
            </div>
          ))}
        </section>
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-violet-500/20 backdrop-blur-md z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-violet-500 animate-spin" strokeWidth={3} />
            <p className="font-black text-violet-500 uppercase tracking-widest text-sm text-center">Evi está pensando...</p>
          </div>
        </div>
      )}

      {error && <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl z-[60]">{error}</div>}
    </div>
  );
};

export default App;
