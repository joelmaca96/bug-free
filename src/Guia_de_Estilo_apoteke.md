
# 💊 Guía de Estilo — apoteke

> _“Automatiza el cuidado. Organiza con precisión.”_

---

## 🪶 Identidad Visual

### 💠 Concepto

**apoteke** combina dos mundos:  
- **Salud y bienestar** (farmacias, atención, cuidado)  
- **Tecnología inteligente** (automatización, IA, eficiencia)

Su identidad debe transmitir:
- **Confianza** (azules calmados)
- **Frescura y claridad** (espacios limpios, tipografía moderna)
- **Inteligencia práctica** (elementos geométricos simples, gradientes suaves)

---

## 🧠 Logotipo

**Diseño conceptual:**

- **Símbolo:** una **cruz farmacéutica simplificada**, formada por cuatro cuadrados redondeados, con un sutil “A” negativa en el centro (de *apoteke*).  
- **Tipografía:** Sans-serif geométrica y limpia (p. ej., *Manrope*, *Inter* o *Space Grotesk*).  
- **Estilo:** Minimalista, sin outline, con color plano o gradiente.

**Composición:**

```
[ + ]   apoteke
```

- El símbolo (la cruz o “+”) puede usar un **gradiente moderno** (turquesa → azul), mientras el texto queda en gris oscuro (#2E2E3A) o blanco según el modo.
- En modo oscuro, el símbolo invierte a un gradiente **azul → lima menta**, evocando luz sobre fondo profundo.

---

## 🎨 Paleta de Colores

### Modo Claro
```css
--primary-100: #E6F7F8;
--primary-300: #9FE3E8;
--primary-500: #00B8C7;
--primary-700: #007D85;
--primary-900: #004C4F;

--accent-green: #B8F5CB;
--accent-blue: #66A6FF;
--accent-rose: #FF6BA6;

--surface: #FFFFFF;
--surface-alt: #F8FAFB;

--text-main: #1A1D23;
--text-muted: #5E6472;
--text-inverse: #FFFFFF;
```

### Modo Oscuro
```css
--primary-100-dark: #1A2A33;
--primary-500-dark: #008E9B;
--primary-700-dark: #005E66;

--surface-dark: #11161C;
--surface-alt-dark: #1C232C;

--text-main-dark: #E9EEF1;
--text-muted-dark: #9CA8B3;

--accent-blue-dark: #66D9FF;
--accent-green-dark: #74F1C1;
```

### Gradiente Principal
```css
--gradient-brand: linear-gradient(135deg, #00B8C7 0%, #66A6FF 100%);
--gradient-dark: linear-gradient(135deg, #005E66 0%, #003344 100%);
```

> 💡 _Los tonos ahora giran más hacia el “azul clínico” y el “verde salud” en lugar de los violetas tecnológicos. Transmiten limpieza, fiabilidad y bienestar._

---

## 🔤 Tipografía

### Familias sugeridas
```css
--font-primary: 'Inter', 'Manrope', 'Space Grotesk', sans-serif;
```

### Jerarquía
- **Títulos (700–800):** fuertes, amplios, sin serifas.  
- **Subtítulos (600):** espaciado amplio y aireado.  
- **Texto base (400):** color gris medio, interlineado generoso.  
- **UI elements (500):** mayúsculas suaves, espaciado +2%.

### Tamaños revisados
```css
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.25rem;
--text-xl: 1.5rem;
--text-2xl: 2rem;
--text-3xl: 3rem;
```

---

## 🧱 Componentes clave

### Botón primario
```css
background: var(--gradient-brand);
color: #fff;
border: none;
border-radius: 0.75rem;
font-weight: 600;
padding: 0.75rem 1.25rem;
transition: all 200ms ease;
```

**Hover:**
```css
filter: brightness(1.1);
transform: translateY(-1px);
```

### Card
```css
background: var(--surface);
border-radius: 1rem;
box-shadow: 0 2px 16px rgba(0, 0, 0, 0.05);
padding: 1.5rem;
transition: box-shadow 0.3s ease;
```

**Hover:**
```css
box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
```

### Input
```css
border: 1px solid #E0E3E8;
border-radius: 0.5rem;
padding: 0.75rem 1rem;
font-size: 1rem;
transition: border-color 0.3s ease;
```

**Focus:**
```css
border-color: #00B8C7;
box-shadow: 0 0 0 3px rgba(0, 184, 199, 0.2);
```

---

## 🧭 Principios de diseño

1. **Minimalismo funcional:**  
   Todo elemento tiene propósito; nada decora por decorar.

2. **Equilibrio calmado:**  
   Espacios amplios, tipografía clara, sombras suaves.

3. **Color con intención:**  
   Azul y turquesa como sinónimos de precisión, confianza y salud.

4. **Animaciones imperceptibles pero vivas:**  
   Microinteracciones al hacer hover, slide o fade con `ease-in-out` y duraciones ≤ 250 ms.

5. **Modo oscuro profesional:**  
   No es “inversión de color”, sino reinterpretación cromática sobria y cálida.

---

## ⚙️ Estilo general

- Bordes **menos redondeados (0.75rem)** → look más profesional.  
- Iconografía **lineal y delgada**, sin relleno.  
- Gradientes **solo en CTAs o headers**.  
- Ilustraciones **isométricas o outline**, nunca fotorrealistas.  
- Paleta general: fondo claro con acentos controlados, y modo oscuro profundo, sin gris medio.

---

## ✨ Ejemplo visual

**Logo horizontal:**
```
[⊕] apoteke
```
> Donde “⊕” es una cruz geométrica suave en gradiente turquesa-azul.  
> En versión reducida (favicon o app icon), solo la cruz o la “A” con corte negativo.

---

*Versión: 2025.11 — Guía oficial de estilo de apoteke*
