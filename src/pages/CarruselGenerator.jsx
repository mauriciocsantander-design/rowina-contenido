import { useState, useRef, useCallback, useEffect } from "react";

const TONES = [
  { id: "cercano", name: "Cercano y cálido", desc: "Como hablarle a una amiga" },
  { id: "elegante", name: "Elegante y aspiracional", desc: "Sofisticado, marca premium" },
  { id: "informativo", name: "Informativo y útil", desc: "Datos, tips, beneficios claros" },
  { id: "emotivo", name: "Emotivo y storytelling", desc: "Historia, sentimiento, conexión" },
];

const TONE_MAP = {
  cercano: "cercano, cálido y personal — como si Patricia le hablara a una amiga",
  elegante: "elegante, sofisticado y aspiracional — marca premium",
  informativo: "informativo, claro y útil — datos concretos y beneficios reales",
  emotivo: "emotivo y con storytelling — conecta desde el sentimiento",
};

const LOADING_MSGS = [
  "Creando el gancho inicial...",
  "Armando los slides...",
  "Generando el caption...",
  "Puliendo los hashtags...",
];

// ─── PROCESAMIENTO DE IMAGEN CON CANVAS ───────────────────────────────────
function processImage(file, warmth) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Calcular brillo promedio para normalizar exposición
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
      }
      const avgBrightness = totalBrightness / (data.length / 4);
      const targetBrightness = 128;
      const brightnessFactor = targetBrightness / avgBrightness;

      // warmth: 0 = sin cambio, 1 = máximo cálido
      const warmR = warmth * 25;   // más rojo
      const warmG = warmth * 8;    // un poco más verde
      const warmB = warmth * -20;  // menos azul

      for (let i = 0; i < data.length; i += 4) {
        // Normalizar exposición
        let r = data[i]   * brightnessFactor;
        let g = data[i+1] * brightnessFactor;
        let b = data[i+2] * brightnessFactor;

        // Aplicar tono cálido
        r = r + warmR;
        g = g + warmG;
        b = b + warmB;

        // Leve aumento de contraste
        const contrast = 1.08;
        r = (r - 128) * contrast + 128;
        g = (g - 128) * contrast + 128;
        b = (b - 128) * contrast + 128;

        data[i]   = Math.min(255, Math.max(0, r));
        data[i+1] = Math.min(255, Math.max(0, g));
        data[i+2] = Math.min(255, Math.max(0, b));
      }

      ctx.putImageData(imageData, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        resolve(URL.createObjectURL(blob));
      }, "image/jpeg", 0.92);
    };
    img.src = url;
  });
}

export default function RowinaCarousel() {
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState([]);
  const [rawUrls, setRawUrls] = useState([]);       // fotos originales
  const [processedUrls, setProcessedUrls] = useState([]); // fotos procesadas
  const [warmth, setWarmth] = useState(0.5);
  const [processing, setProcessing] = useState(false);
  const [showComparison, setShowComparison] = useState(null); // índice foto en comparación
  const [selected, setSelected] = useState(new Set());
  const [producto, setProducto] = useState("");
  const [gancho, setGancho] = useState("");
  const [numSlides, setNumSlides] = useState(5);
  const [tone, setTone] = useState("cercano");
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [copyModal, setCopyModal] = useState(null);
  const fileRef = useRef();
  const loadInterval = useRef();

  const handleFiles = useCallback((files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith("image/"));
    setPhotos(prev => [...prev, ...imgs].slice(0, 15));
  }, []);

  // Procesar fotos cuando cambian las fotos o el warmth
  useEffect(() => {
    if (photos.length === 0) { setRawUrls([]); setProcessedUrls([]); return; }
    setProcessing(true);
    const raws = photos.map(f => URL.createObjectURL(f));
    setRawUrls(raws);
    Promise.all(photos.map(f => processImage(f, warmth))).then(urls => {
      setProcessedUrls(urls);
      setProcessing(false);
    });
  }, [photos, warmth]);

  const toggleSelect = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const startLoading = () => {
    setLoadMsg(0);
    let i = 0;
    loadInterval.current = setInterval(() => {
      i = (i + 1) % LOADING_MSGS.length;
      setLoadMsg(i);
    }, 2200);
  };

  const stopLoading = () => clearInterval(loadInterval.current);

  const generate = async () => {
    if (!producto.trim() || !gancho.trim()) {
      setError("Completá el producto y el gancho para continuar.");
      return;
    }
    setError("");
    setStep(3);
    setLoading(true);
    setResult(null);
    startLoading();

    const total = numSlides + 2;
    const prompt = `Sos el asistente de contenidos de ROWINA, una marca argentina de carteras de cuero artesanales. Patri crea contenido para Instagram con fotos que ella misma saca en casa. Estilo cálido, artesanal, auténtico.

Generá contenido para un carrusel de Instagram:

PRODUCTO: ${producto}
GANCHO / TEMÁTICA: ${gancho}
SLIDES: 1 gancho + ${numSlides} de contenido + 1 cierre = ${total} en total
TONO: ${TONE_MAP[tone]}
${extra ? "INFO EXTRA: " + extra : ""}

ESTRUCTURA:
- Slide 1 (gancho): frase corta e impactante, máx 10 palabras, que genere curiosidad inmediata.
- Slides 2 a ${numSlides + 1}: título corto (máx 6 palabras) + texto breve (1-2 oraciones).
- Slide ${total} (cierre): CTA cálido y claro.

Respondé SOLO con JSON válido, sin backticks ni texto extra. Incluí TODOS los ${total} slides en el array:
{"titulo_carrusel":"...","estrategia":"...","slides":[{"numero":1,"tipo":"gancho","titulo":"...","texto":""},{"numero":2,"tipo":"contenido","titulo":"...","texto":"..."},{"numero":${total},"tipo":"cierre","titulo":"...","texto":""}],"caption":"...","hashtags":["rowinabags","carterasdecuero"]}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.find(b => b.type === "text")?.text || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      stopLoading();
      setResult(parsed);
      setLoading(false);
    } catch (err) {
      stopLoading();
      setLoading(false);
      setResult({ error: true });
    }
  };

  const copyText = (text, label) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(label);
        setTimeout(() => setCopied(""), 2500);
      }).catch(() => setCopyModal({ text, label }));
    } else {
      setCopyModal({ text, label });
    }
  };

  const copyAll = () => {
    if (!result) return;
    const tags = (result.hashtags || []).map(h => h.startsWith("#") ? h : "#" + h).join(" ");
    copyText(result.caption + "\n\n" + tags, "todo");
  };

  const restart = () => {
    setStep(1); setPhotos([]); setRawUrls([]); setProcessedUrls([]);
    setSelected(new Set()); setProducto(""); setGancho("");
    setNumSlides(5); setTone("cercano"); setExtra("");
    setResult(null); setError(""); setWarmth(0.5);
  };

  // Fotos en orden: seleccionadas primero, luego el resto — sin repetición
  const selectedList = [...selected];
  const unselectedList = photos.map((_, i) => i).filter(i => !selected.has(i));
  const photoOrder = [...selectedList, ...unselectedList];
  const displayUrls = processedUrls.length === photos.length ? processedUrls : rawUrls;

  // ─── STYLES ───────────────────────────────────────────────────────────────
  const s = {
    wrap: { fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "#f5f0e8", minHeight: "100vh", color: "#1a1510" },
    header: { background: "#1a1510", padding: "18px 28px", display: "flex", alignItems: "center", gap: 12 },
    logo: { fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 300, letterSpacing: 4, color: "#f5f0e8", textTransform: "uppercase" },
    logoAccent: { color: "#b5874a", fontStyle: "italic" },
    logoSub: { fontSize: 10, letterSpacing: 3, color: "#c9b89a", textTransform: "uppercase", marginTop: 2 },
    container: { maxWidth: 780, margin: "0 auto", padding: "32px 20px 80px" },
    steps: { display: "flex", borderBottom: "1px solid #e8dcc8", marginBottom: 36 },
    stepItem: (active, done) => ({
      flex: 1, textAlign: "center", padding: "11px 6px 13px", fontSize: 10,
      letterSpacing: 1.5, textTransform: "uppercase", position: "relative", top: 1,
      color: active ? "#b5874a" : done ? "#8b6f4e" : "#c9b89a",
      borderBottom: `2px solid ${active ? "#b5874a" : done ? "#8b6f4e" : "transparent"}`,
      fontWeight: active ? 500 : 400,
    }),
    h2: { fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 300, color: "#2c2118", marginBottom: 4 },
    sub: { fontSize: 13, color: "#8b6f4e", marginBottom: 28 },
    uploadZone: (drag) => ({
      border: `1.5px dashed ${drag ? "#b5874a" : "#c9b89a"}`,
      borderRadius: 12, background: drag ? "#fdf8f1" : "#f9f5ef",
      padding: "48px 24px", textAlign: "center", cursor: "pointer",
      transition: "all 0.2s", position: "relative",
    }),
    uploadTitle: { fontFamily: "Georgia, serif", fontSize: 18, color: "#2c2118", margin: "12px 0 6px" },
    uploadHint: { fontSize: 12, color: "#8b6f4e" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10, marginTop: 20 },
    thumb: (sel) => ({
      aspectRatio: "1", borderRadius: 8, overflow: "hidden", position: "relative",
      cursor: "pointer", border: `2px solid ${sel ? "#b5874a" : "transparent"}`, transition: "all 0.15s",
    }),
    thumbImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    thumbCheck: { position: "absolute", top: 4, right: 4, background: "#b5874a", color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 },
    thumbEye: { position: "absolute", bottom: 4, right: 4, background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: "50%", width: 20, height: 20, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
    label: { display: "block", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#8b6f4e", marginBottom: 7, fontWeight: 500 },
    input: { width: "100%", padding: "13px 15px", background: "#f9f5ef", border: "1.5px solid #e8dcc8", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1510", outline: "none", boxSizing: "border-box" },
    textarea: { width: "100%", padding: "13px 15px", background: "#f9f5ef", border: "1.5px solid #e8dcc8", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1510", outline: "none", resize: "vertical", minHeight: 80, boxSizing: "border-box" },
    select: { width: "100%", padding: "13px 15px", background: "#f9f5ef", border: "1.5px solid #e8dcc8", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1510", outline: "none", appearance: "none" },
    formRow: { marginBottom: 22 },
    toneGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    toneBtn: (sel) => ({
      padding: 13, border: `1.5px solid ${sel ? "#b5874a" : "#e8dcc8"}`,
      borderRadius: 10, background: sel ? "#fdf8f1" : "#f9f5ef",
      cursor: "pointer", textAlign: "left", transition: "all 0.15s",
    }),
    toneName: { fontSize: 13, fontWeight: 500, color: "#2c2118", marginBottom: 2 },
    toneDesc: { fontSize: 11, color: "#8b6f4e" },
    btnRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32 },
    btnPrimary: { display: "inline-flex", alignItems: "center", gap: 7, padding: "13px 26px", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none", background: "#1a1510", color: "#f5f0e8", transition: "all 0.2s" },
    btnSecondary: { display: "inline-flex", alignItems: "center", gap: 7, padding: "13px 22px", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 400, cursor: "pointer", background: "transparent", color: "#8b6f4e", border: "1.5px solid #e8dcc8" },
    btnSmall: { display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, cursor: "pointer", background: "transparent", color: "#8b6f4e", border: "1.5px solid #e8dcc8" },
    alertBox: { background: "#fdf0e8", border: "1.5px solid #b5874a", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#2c2118", marginBottom: 16 },
    loadBox: { background: "#f9f5ef", border: "1.5px solid #e8dcc8", borderRadius: 12, padding: "52px 32px", textAlign: "center" },
    spinner: { width: 32, height: 32, border: "2px solid #e8dcc8", borderTopColor: "#b5874a", borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 18px" },
    loadTitle: { fontFamily: "Georgia, serif", fontSize: 20, color: "#2c2118", marginBottom: 6 },
    loadSub: { fontSize: 13, color: "#8b6f4e" },
    resultHeader: { background: "#1a1510", borderRadius: 12, padding: "22px 26px", marginBottom: 26, display: "flex", alignItems: "center", justifyContent: "space-between" },
    resultTitle: { fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 300, color: "#f5f0e8" },
    resultSub: { fontSize: 12, color: "#c9b89a", marginTop: 2 },
    slidesWrap: { display: "flex", gap: 12, overflowX: "auto", paddingBottom: 14, marginBottom: 26, scrollSnapType: "x mandatory" },
    slideCard: { minWidth: 200, maxWidth: 200, aspectRatio: "1", borderRadius: 12, overflow: "hidden", position: "relative", flexShrink: 0, background: "#2c2118", scrollSnapAlign: "start" },
    slideImg: { width: "100%", height: "100%", objectFit: "cover", opacity: 0.65, display: "block" },
    slideOverlay: { position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(26,21,16,0.95) 0%, rgba(26,21,16,0.05) 55%)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 14 },
    slideNum: { position: "absolute", top: 10, left: 10, background: "#b5874a", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: "3px 7px", borderRadius: 20 },
    slideLabel: { fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "#b5874a", marginBottom: 3 },
    slideTitle: { fontFamily: "Georgia, serif", fontSize: 13, color: "#f5f0e8", lineHeight: 1.4 },
    slideText: { fontSize: 10, color: "rgba(245,240,232,0.65)", marginTop: 4, lineHeight: 1.4 },
    captionBox: { background: "#f9f5ef", border: "1.5px solid #e8dcc8", borderRadius: 12, padding: "22px", marginBottom: 18 },
    captionLabel: { fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#8b6f4e", marginBottom: 12, fontWeight: 500 },
    captionText: { fontSize: 14, lineHeight: 1.75, color: "#1a1510", whiteSpace: "pre-wrap" },
    tags: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 },
    tag: { background: "#e8dcc8", color: "#8b6f4e", fontSize: 11, padding: "4px 10px", borderRadius: 20, fontWeight: 500 },
    noteBox: { background: "#fdf8f1", borderLeft: "3px solid #b5874a", borderRadius: "0 10px 10px 0", padding: "12px 16px", fontSize: 13, color: "#8b6f4e", lineHeight: 1.6, marginBottom: 20 },
  };

  return (
    <div style={s.wrap}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type=range] { -webkit-appearance: none; width: 100%; height: 4px; background: #e8dcc8; border-radius: 2px; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #b5874a; cursor: pointer; }
      `}</style>

      <div style={s.header}>
        <div>
          <div style={s.logo}>Rowina <span style={s.logoAccent}>Bags</span></div>
          <div style={s.logoSub}>Generador de carrusel</div>
        </div>
      </div>

      <div style={s.container}>
        <div style={s.steps}>
          {["Fotos", "Enfoque", "Carrusel"].map((label, i) => (
            <div key={i} style={s.stepItem(step === i + 1, step > i + 1)}>{i + 1}. {label}</div>
          ))}
        </div>

        {/* ── STEP 1: FOTOS ── */}
        {step === 1 && (
          <div>
            <div style={s.h2}>Subí las fotos</div>
            <div style={s.sub}>Entre 3 y 15 fotos del producto. La IA ajusta la luz y el tono automáticamente.</div>

            <div
              style={s.uploadZone(dragOver)}
              onClick={() => fileRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            >
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
              <div style={{ fontSize: 32 }}>🖼</div>
              <div style={s.uploadTitle}>Tocá para elegir fotos</div>
              <div style={s.uploadHint}>JPG, PNG o HEIC · Hasta 15 fotos</div>
            </div>

            {photos.length > 0 && (
              <>
                {/* CONTROL DE CALIDEZ */}
                <div style={{ marginTop: 24, background: "#f9f5ef", border: "1.5px solid #e8dcc8", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#2c2118" }}>
                      ✨ Ajuste de luz y tono cálido
                    </div>
                    {processing && (
                      <div style={{ fontSize: 11, color: "#b5874a" }}>Procesando...</div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 11, color: "#8b6f4e", whiteSpace: "nowrap" }}>Natural</span>
                    <input
                      type="range" min="0" max="1" step="0.05"
                      value={warmth}
                      onChange={e => setWarmth(parseFloat(e.target.value))}
                    />
                    <span style={{ fontSize: 11, color: "#8b6f4e", whiteSpace: "nowrap" }}>Cálido</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#c9b89a", marginTop: 8 }}>
                    Tocá el 👁 en cada foto para ver el antes/después
                  </div>
                </div>

                {/* GRID DE FOTOS */}
                <div style={s.grid}>
                  {photos.map((f, i) => (
                    <div key={i} style={s.thumb(selected.has(i))} onClick={() => toggleSelect(i)}>
                      <img
                        src={showComparison === i ? rawUrls[i] : (displayUrls[i] || rawUrls[i])}
                        alt=""
                        style={s.thumbImg}
                      />
                      {selected.has(i) && <div style={s.thumbCheck}>✓</div>}
                      <div
                        style={s.thumbEye}
                        onMouseDown={e => { e.stopPropagation(); setShowComparison(i); }}
                        onMouseUp={e => { e.stopPropagation(); setShowComparison(null); }}
                        onTouchStart={e => { e.stopPropagation(); setShowComparison(i); }}
                        onTouchEnd={e => { e.stopPropagation(); setShowComparison(null); }}
                        title="Mantené para ver original"
                      >👁</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "#8b6f4e", marginTop: 10, textAlign: "center" }}>
                  Tocá las fotos para destacarlas · {photos.length} foto{photos.length !== 1 ? "s" : ""}
                  {selected.size > 0 && ` · ${selected.size} destacada${selected.size !== 1 ? "s" : ""}`}
                </div>
              </>
            )}

            {photos.length > 0 && photos.length < 3 && (
              <div style={{ ...s.alertBox, marginTop: 16 }}>Subí al menos 3 fotos para continuar.</div>
            )}
            {photos.length >= 3 && (
              <div style={{ marginTop: 12, fontSize: 12, color: "#8b6f4e", textAlign: "center" }}>
                {photos.length < numSlides + 2
                  ? `⚠️ Para ${numSlides + 2} slides sin repetir fotos, necesitás ${numSlides + 2} fotos. Tenés ${photos.length} — algunas se van a repetir.`
                  : `✓ Tenés fotos suficientes para ${numSlides + 2} slides sin repetir.`}
              </div>
            )}

            {/* MODAL COMPARACIÓN */}
            {showComparison !== null && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#c9b89a", marginBottom: 6 }}>Original</div>
                    <img src={rawUrls[showComparison]} alt="original" style={{ width: 160, height: 160, objectFit: "cover", borderRadius: 8 }} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#b5874a", marginBottom: 6 }}>Ajustada</div>
                    <img src={displayUrls[showComparison]} alt="ajustada" style={{ width: 160, height: 160, objectFit: "cover", borderRadius: 8 }} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#c9b89a" }}>Soltá para cerrar</div>
              </div>
            )}

            <div style={s.btnRow}>
              <span />
              <button style={s.btnPrimary} onClick={() => photos.length >= 3 ? setStep(2) : null}>
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: ENFOQUE ── */}
        {step === 2 && (
          <div>
            <div style={s.h2}>El enfoque del carrusel</div>
            <div style={s.sub}>Contale a la IA de qué va este posteo. Cuanto más específica, mejor el resultado.</div>

            <div style={s.formRow}>
              <label style={s.label}>¿Qué producto vas a mostrar?</label>
              <input style={s.input} value={producto} onChange={e => setProducto(e.target.value)} placeholder="Ej: cartera de cuero marrón nueva colección otoño" />
            </div>

            <div style={s.formRow}>
              <label style={s.label}>El gancho o temática del carrusel</label>
              <textarea style={s.textarea} value={gancho} onChange={e => setGancho(e.target.value)} placeholder={`Ej: "Las 5 razones por las que esta cartera va con todo"`} />
            </div>

            <div style={s.formRow}>
              <label style={s.label}>Cantidad de slides de contenido</label>
              <select style={s.select} value={numSlides} onChange={e => setNumSlides(parseInt(e.target.value))}>
                <option value={3}>3 slides + gancho + cierre = 5 total</option>
                <option value={4}>4 slides + gancho + cierre = 6 total</option>
                <option value={5}>5 slides + gancho + cierre = 7 total</option>
                <option value={6}>6 slides + gancho + cierre = 8 total</option>
              </select>
            </div>

            <div style={s.formRow}>
              <label style={s.label}>Tono del copy</label>
              <div style={s.toneGrid}>
                {TONES.map(t => (
                  <div key={t.id} style={s.toneBtn(tone === t.id)} onClick={() => setTone(t.id)}>
                    <div style={s.toneName}>{t.name}</div>
                    <div style={s.toneDesc}>{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={s.formRow}>
              <label style={s.label}>¿Algo más que quieras incluir? (opcional)</label>
              <input style={s.input} value={extra} onChange={e => setExtra(e.target.value)} placeholder="Ej: precio, colores disponibles, descuento, envíos" />
            </div>

            {error && <div style={s.alertBox}>{error}</div>}

            <div style={s.btnRow}>
              <button style={s.btnSecondary} onClick={() => setStep(1)}>← Volver</button>
              <button style={s.btnPrimary} onClick={generate}>✨ Generar carrusel</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: RESULTADO ── */}
        {step === 3 && (
          <div>
            {loading && (
              <div style={s.loadBox}>
                <div style={s.spinner} />
                <div style={s.loadTitle}>Creando tu carrusel...</div>
                <div style={s.loadSub}>{LOADING_MSGS[loadMsg]}</div>
              </div>
            )}

            {!loading && result && !result.error && (
              <div>
                <div style={s.resultHeader}>
                  <div>
                    <div style={s.resultTitle}>{result.titulo_carrusel || "Carrusel listo"}</div>
                    <div style={s.resultSub}>{result.slides?.length || 0} slides · Revisá y copiá todo</div>
                  </div>
                  <button style={{ ...s.btnSecondary, color: "#f5f0e8", borderColor: "rgba(255,255,255,0.2)", fontSize: 12 }} onClick={restart}>
                    Nuevo carrusel
                  </button>
                </div>

                {result.estrategia && <div style={s.noteBox}>💡 {result.estrategia}</div>}

                <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 300, color: "#2c2118", marginBottom: 14 }}>Slides del carrusel</div>
                <div style={s.slidesWrap}>
                  {(result.slides || []).map((slide, i) => {
                    const pIdx = photoOrder[i < photoOrder.length ? i : photoOrder.length - 1];
                    const url = displayUrls[pIdx] || rawUrls[pIdx];
                    const typeLabel = slide.tipo === "gancho" ? "Gancho" : slide.tipo === "cierre" ? "Cierre" : `Punto ${slide.numero - 1}`;
                    return (
                      <div key={i} style={s.slideCard}>
                        {url && <img src={url} alt="" style={s.slideImg} />}
                        <div style={s.slideOverlay}>
                          <div style={s.slideNum}>{slide.numero}</div>
                          <div style={s.slideLabel}>{typeLabel}</div>
                          <div style={s.slideTitle}>{slide.titulo}</div>
                          {slide.texto && <div style={s.slideText}>{slide.texto}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={s.captionBox}>
                  <div style={s.captionLabel}>Caption para Instagram</div>
                  <div style={s.captionText}>{result.caption}</div>
                  <div style={{ marginTop: 14 }}>
                    <button style={s.btnSmall} onClick={() => copyText(result.caption, "caption")}>
                      {copied === "caption" ? "✓ Copiado" : "📋 Copiar caption"}
                    </button>
                  </div>
                </div>

                <div style={s.captionBox}>
                  <div style={s.captionLabel}>Hashtags</div>
                  <div style={s.tags}>
                    {(result.hashtags || []).map((h, i) => (
                      <span key={i} style={s.tag}>{h.startsWith("#") ? h : "#" + h}</span>
                    ))}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button style={s.btnSmall} onClick={() => copyText((result.hashtags || []).map(h => h.startsWith("#") ? h : "#" + h).join(" "), "tags")}>
                      {copied === "tags" ? "✓ Copiado" : "📋 Copiar hashtags"}
                    </button>
                  </div>
                </div>

                <div style={s.btnRow}>
                  <button style={s.btnSecondary} onClick={restart}>Generar otro</button>
                  <button style={s.btnPrimary} onClick={copyAll}>
                    {copied === "todo" ? "✓ Copiado!" : "📋 Copiar todo para Instagram"}
                  </button>
                </div>
              </div>
            )}

            {!loading && result?.error && (
              <div style={s.loadBox}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
                <div style={s.loadTitle}>Algo salió mal</div>
                <div style={s.loadSub}>Revisá tu conexión y volvé a intentar</div>
                <div style={{ marginTop: 24 }}>
                  <button style={s.btnSecondary} onClick={() => { setStep(2); setResult(null); }}>← Volver</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

        {/* MODAL DE COPIA PARA MÓVIL */}
        {copyModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div style={{ background: "#f5f0e8", borderRadius: "16px 16px 0 0", padding: 24, width: "100%", maxWidth: 600, maxHeight: "80vh", overflow: "auto" }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: "#2c2118", marginBottom: 12 }}>
                Copiá el texto
              </div>
              <div style={{ fontSize: 12, color: "#8b6f4e", marginBottom: 12 }}>
                Mantené apretado el texto de abajo y seleccioná todo para copiar.
              </div>
              <textarea
                readOnly
                value={copyModal.text}
                style={{ width: "100%", minHeight: 140, padding: 12, background: "#fff", border: "1.5px solid #e8dcc8", borderRadius: 8, fontSize: 13, lineHeight: 1.6, color: "#1a1510", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", resize: "none" }}
                onFocus={e => e.target.select()}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button
                  style={{ flex: 1, padding: "12px", background: "#1a1510", color: "#f5f0e8", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                  onClick={() => {
                    navigator.clipboard.writeText(copyModal.text).then(() => {
                      setCopied(copyModal.label);
                      setTimeout(() => setCopied(""), 2500);
                    }).catch(() => {});
                    setCopyModal(null);
                  }}
                >
                  Copiar
                </button>
                <button
                  style={{ padding: "12px 20px", background: "transparent", color: "#8b6f4e", border: "1.5px solid #e8dcc8", borderRadius: 10, fontSize: 13, cursor: "pointer" }}
                  onClick={() => setCopyModal(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
