import React, { useState, useEffect, useRef } from 'react';
import { 
  Share2, RefreshCw, ShoppingBasket, Edit3, ShoppingCart, 
  Plus, Mic, Trash2, CheckCircle, ChevronDown, 
  Settings, Brain, Save, Loader2, Trash, 
  Star, Minus, PlusCircle, GripVertical
} from 'lucide-react';
import type { ShoppingItem } from './types';
import { CATALOG_DATA } from './constants';

// Drag & Drop
import type {
  DragEndEvent
} from '@dnd-kit/core';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableItem = ({ item, toggleItem, deleteItem, updateQuantity, toggleFavorite, mode }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`group flex flex-col gap-3 p-5 rounded-[2.5rem] glass-panel transition-all duration-300 ${isDragging ? 'shadow-2xl opacity-80 ring-2 ring-violet-500 scale-105' : ''} ${item.checked ? 'opacity-40 scale-[0.98]' : 'hover:shadow-lg'}`}
    >
      <div className="flex items-center gap-4">
        <div 
          onClick={() => toggleItem(item.id)}
          className={`w-8 h-8 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 cursor-pointer shrink-0 ${item.checked ? 'bg-slate-400 border-slate-400' : 'border-slate-300 dark:border-slate-600'}`}
        >
          {item.checked && <CheckCircle size={18} className="text-white" strokeWidth={3} />}
        </div>

        <div className="flex-1 min-w-0" onClick={() => toggleItem(item.id)}>
          <p className={`text-lg font-bold transition-all duration-300 leading-tight ${item.checked ? 'line-through text-slate-500 opacity-50' : 'text-slate-800 dark:text-white'}`}>
            {item.text}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl p-1 shrink-0">
          <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-colors">
            <Minus size={16} strokeWidth={3} className={item.quantity <= 1 ? 'opacity-20' : ''} />
          </button>
          <span className="text-base font-black w-6 text-center">{item.quantity}</span>
          <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-colors text-violet-500">
            <PlusCircle size={16} strokeWidth={3} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/50">
        <div className="flex items-center gap-3">
          {mode === 'edit' && (
            <button {...attributes} {...listeners} className="text-slate-300 dark:text-slate-600">
              <GripVertical size={18} />
            </button>
          )}
          <span className="text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800" style={{ color: item.catColor }}>
            {item.catName}
          </span>
        </div>

        {mode === 'edit' && (
          <div className="flex items-center gap-1">
            <button 
              onClick={() => toggleFavorite(item.id)}
              className={`p-2 rounded-xl transition-colors ${item.isFavorite ? 'bg-amber-400/10 text-amber-500' : 'text-slate-300 dark:text-slate-600'}`}
            >
              <Star size={20} className={item.isFavorite ? 'fill-amber-500' : ''} />
            </button>
            <button onClick={() => deleteItem(item.id)} className="p-2 rounded-xl text-slate-300 dark:text-slate-600 hover:bg-red-500/10 hover:text-red-500 transition-colors">
              <Trash2 size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const APP_VERSION = "6.0 - EviShop Pro Max";
  
  const [items, setItems] = useState<ShoppingItem[]>(() => {
    const saved = localStorage.getItem('lme_items_pro');
    return saved ? JSON.parse(saved) : [];
  });
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('lme_gemini_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<'edit' | 'shop'>('edit');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('lme_items_pro', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('lme_gemini_key', apiKey.trim());
  }, [apiKey]);

  // Audio Feedback
  const playBeep = (type: 'start' | 'stop') => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const now = ctx.currentTime;
      if (type === 'start') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(440, now); osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      } else {
        osc.type = 'sine'; osc.frequency.setValueAtTime(880, now); osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);
      }
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
    } catch (e) {}
  };

  // Voice Logic
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    const recognition = new SpeechRec();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => { setIsListening(true); setTranscript(''); playBeep('start'); };
    recognition.onresult = (e: any) => { setTranscript(e.results[0][0].transcript); };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (isListening) recognitionRef.current?.stop();
    else {
      setTranscript('');
      try { recognitionRef.current?.start(); } catch (e) {
        recognitionRef.current?.stop();
        setTimeout(() => recognitionRef.current?.start(), 100);
      }
    }
  };

  useEffect(() => {
    if (!isListening && transcript.trim()) {
      playBeep('stop');
      processVoiceSmart(transcript);
    }
  }, [isListening]);

  const getCategoryInfo = (catName: string) => {
    const cleanCat = catName.toLowerCase();
    const found = CATALOG_DATA.find(c => c.c.toLowerCase().includes(cleanCat));
    if (found) return { name: found.c, color: found.col };
    return { name: "⚪ Varios", color: "#94a3b8" };
  };

  const addItem = (text: string, category?: string) => {
    if (!text.trim()) return;
    const clean = text.trim().charAt(0).toUpperCase() + text.trim().slice(1).toLowerCase();
    const info = category ? getCategoryInfo(category) : { name: "⚪ Varios", color: "#94a3b8" };

    setItems(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      text: clean,
      checked: false,
      catName: info.name,
      catColor: info.color,
      quantity: 1,
      isFavorite: false
    }, ...prev]);
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const processVoiceSmart = async (t: string) => {
    if (!apiKey || apiKey.length < 10) {
      processVoiceBasic(t);
      return;
    }
    setIsProcessing(true);
    try {
      const prompt = `Eres un asistente de lista de la compra. Tu trabajo es extraer TODOS los productos individuales del texto.
      Devuelve SOLO un JSON válido con este formato: {"items": [{"name": "producto", "category": "Categoría"}]}
      Categorías permitidas: Verduras, Frutas, Carne, Pescado, Lácteos, Charcutería, Despensa, Pan, Limpieza, Mascotas, Varios.
      Texto a analizar: "${t}"`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || "API Error");

      let textResponse = data.candidates[0].content.parts[0].text;
      const result = JSON.parse(textResponse.trim());
      
      if (result.items && Array.isArray(result.items)) {
        result.items.forEach((i: any) => addItem(i.name, i.category));
      } else {
        processVoiceBasic(t);
      }
    } catch (err: any) {
      processVoiceBasic(t);
    } finally {
      setIsProcessing(false);
      setTranscript('');
    }
  };

  const processVoiceBasic = (t: string) => {
    const rawParts = t.split(/ y |,|\.|\n/i);
    rawParts.forEach(part => {
      const words = part.trim().split(/\s+/);
      if (words.length === 0) return;
      let currentB: string[] = [];
      const conn = ['de', 'con', 'sin', 'para', 'la', 'el', 'en', 'un', 'una', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'del', 'al', 'los', 'las', 'kilo', 'gramos', 'litros', 'paquete', 'bolsa'];
      words.forEach((word, index) => {
        const w = word.toLowerCase();
        if (index === 0) currentB.push(word);
        else {
          if (conn.includes(w) || conn.includes(words[index - 1].toLowerCase()) || w.length <= 2) currentB.push(word);
          else { addItem(currentB.join(" ")); currentB = [word]; }
        }
      });
      if (currentB.length > 0) addItem(currentB.join(" "));
    });
  };

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(1, (i.quantity || 1) + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const toggleFavorite = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, isFavorite: !i.isFavorite } : i));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((currentItems) => {
        const oldIndex = currentItems.findIndex((i) => i.id === active.id);
        const newIndex = currentItems.findIndex((i) => i.id === over.id);
        return arrayMove(currentItems, oldIndex, newIndex);
      });
    }
  };

  const shareWhatsApp = () => {
    const f = items.filter(i => !i.checked);
    if (f.length === 0) {
      setError("No hay nada que compartir");
      setTimeout(() => setError(null), 3000);
      return;
    }
    const t = "🛒 *EviShop Premium*\n\n" + f.map(i => `• ${i.quantity > 1 ? `[${i.quantity}] ` : ''}${i.text}`).join('\n');
    window.open("whatsapp://send?text=" + encodeURIComponent(t), '_blank');
  };

  const nukeCache = () => {
    if (confirm("¿Limpiar todo?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className={`min-h-screen max-w-lg mx-auto relative flex flex-col font-sans ${mode === 'edit' ? 'edit-mode' : 'shop-mode'}`}>
      <header className="p-6 glass-header sticky top-0 z-40 transition-all duration-300">
        <div className="flex items-center justify-between gap-4">
          <button onClick={() => { if(confirm("¿Vaciar lista?")) setItems([]); }} className="p-2.5 rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 text-slate-500">
            <RefreshCw size={20} strokeWidth={2.5} />
          </button>
          <div className="text-center flex-1 flex items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <ShoppingBasket size={18} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Evi<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-fuchsia-500">Shop</span></h1>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowSettings(!showSettings)} className={`p-2.5 rounded-2xl transition-all ${apiKey ? 'text-green-500 bg-green-500/10' : 'text-slate-400 bg-slate-100/50 dark:bg-slate-800/50'}`}>
              <Settings size={20} strokeWidth={2.5} />
            </button>
            <button onClick={() => setMode(mode === 'edit' ? 'shop' : 'edit')} className={`p-2.5 rounded-2xl transition-all shadow-lg active:scale-95 ${mode === 'edit' ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-violet-500/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
              {mode === 'edit' ? <ShoppingCart size={20} strokeWidth={2.5} /> : <Edit3 size={20} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
        {mode === 'shop' && (
          <div className="mt-4 flex justify-between items-center px-4 py-2 bg-violet-500/10 rounded-2xl border border-violet-500/20">
            <p className="text-xs font-bold text-violet-500 uppercase tracking-widest">{items.filter(i => i.checked).length} de {items.length} COMPRADOS</p>
            {items.length > 0 && items.every(i => i.checked) && (
              <button onClick={() => setItems(items.filter(i => !i.checked))} className="px-3 py-1 bg-violet-500 text-white rounded-lg text-[10px] font-black uppercase">¡LISTO!</button>
            )}
          </div>
        )}
      </header>

      {showSettings && (
        <section className="absolute inset-0 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-2xl z-50 p-8 flex flex-col gap-6 animate-slide-up">
          <div className="flex items-center gap-4 mt-4">
            <div className="p-4 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30 text-white">
              <Brain size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-bold">EviShop Pro</h2>
              <p className="text-slate-500 font-medium">Configuración de IA</p>
            </div>
          </div>
          <div className="space-y-3 mt-6">
            <label className="text-sm font-bold text-violet-500 uppercase tracking-widest">Llave Gemini (API Key)</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza..." className="w-full p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl outline-none" />
          </div>
          <button onClick={nukeCache} className="mt-6 flex items-center justify-center gap-2 p-5 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-3xl font-bold text-sm border border-red-100">
            <Trash size={20} /> RESTAURAR APLICACIÓN
          </button>
          <div className="mt-auto text-center space-y-6 pb-6">
            <p className="text-[10px] text-slate-400 font-mono opacity-50">Core: {APP_VERSION}</p>
            <button onClick={() => setShowSettings(false)} className="w-full py-5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-3xl font-bold text-lg flex items-center justify-center gap-3 shadow-xl">
              CERRAR AJUSTES <Save size={24} />
            </button>
          </div>
        </section>
      )}

      {isCatalogOpen && (
        <section className="absolute inset-x-0 top-20 bottom-0 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-2xl z-30 p-4 overflow-y-auto animate-slide-up pb-48">
          <button onClick={() => setIsCatalogOpen(false)} className="w-full py-3 bg-violet-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 sticky top-0 z-10 mb-4 shadow-xl">
            CERRAR CATÁLOGO <ChevronDown />
          </button>
          {CATALOG_DATA.map(cat => (
            <div key={cat.c} className="mb-6">
              <h3 className="text-xs font-black text-slate-400 uppercase mb-3 pl-2 tracking-widest">{cat.c}</h3>
              <div className="grid grid-cols-3 gap-2">
                {cat.items.map(i => (
                  <button key={i.n} onClick={() => addItem(i.n)} className="flex flex-col items-center p-3 glass-panel rounded-3xl active:scale-95 transition-transform">
                    <span className="text-2xl">{i.e}</span>
                    <span className="text-[10px] text-center font-bold mt-1">{i.n}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
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
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-3">
              <SortableContext 
                items={items.map(i => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {items.map(item => (
                  <SortableItem 
                    key={item.id} 
                    item={item} 
                    toggleItem={toggleItem} 
                    deleteItem={deleteItem}
                    updateQuantity={updateQuantity}
                    toggleFavorite={toggleFavorite}
                    mode={mode}
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        )}
      </main>

      {isListening && (
        <div className="fixed inset-0 bg-slate-900/95 z-50 flex items-center justify-center p-8 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-[3rem] p-8 w-full max-w-xs text-center flex flex-col items-center gap-6 shadow-2xl">
            <div className="bg-red-500 p-8 rounded-full animate-pulse shadow-2xl shadow-red-500/50">
              <Mic size={48} className="text-white" />
            </div>
            <p className="text-xl font-bold text-slate-400 italic">"{transcript || 'Dime qué comprar...'}"</p>
            <button onClick={toggleListening} className="w-full py-4 bg-red-500 text-white rounded-3xl font-black text-lg">PARAR</button>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-violet-500/20 backdrop-blur-md z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-violet-500 animate-spin" strokeWidth={3} />
            <p className="font-black text-violet-500 uppercase tracking-widest text-sm">Procesando...</p>
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <nav className="fixed bottom-0 inset-x-0 p-6 flex flex-col items-center gap-6 pointer-events-none z-40">
          <div className="w-full max-w-sm flex gap-3 pointer-events-auto">
            <button onClick={() => setIsCatalogOpen(!isCatalogOpen)} className={`p-4 rounded-3xl glass-panel shadow-2xl transition-all ${isCatalogOpen ? 'bg-violet-500 text-white' : 'text-slate-500'}`}>
              <ShoppingCart size={24} />
            </button>
            <div className="flex-1 flex glass-panel rounded-3xl overflow-hidden shadow-2xl pl-2">
              <input type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (addItem(manualInput), setManualInput(''))} placeholder="¿Qué quieres hoy?" className="flex-1 px-4 bg-transparent outline-none font-bold" />
              <button onClick={() => { addItem(manualInput); setManualInput(''); }} className="p-4 bg-slate-100 dark:bg-slate-800 text-violet-500"><Plus size={24} strokeWidth={3} /></button>
            </div>
            <button onClick={shareWhatsApp} className="p-4 rounded-3xl bg-green-500 text-white shadow-2xl">
              <Share2 size={24} strokeWidth={2.5} />
            </button>
          </div>
          <button onClick={toggleListening} className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center shadow-2xl pointer-events-auto transition-all duration-300 active:scale-90 ${isListening ? 'bg-red-500' : 'bg-gradient-to-br from-violet-500 to-fuchsia-500'}`}>
            <Mic size={36} className="text-white" />
          </button>
        </nav>
      )}

      {error && <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl z-[60] animate-bounce">{error}</div>}
    </div>
  );
};

export default App;
