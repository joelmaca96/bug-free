# Guía de Estilo - AgapitoDiSousa

> Inspirada en [Minimus Weather App](https://github.com/hamedbaatour/Minimus)

## 🎨 Paleta de Colores

### Modo Claro (Light Mode)

#### Colores Principales
```css
--primary-gradient: linear-gradient(to top, #5ee7df 0%, #66a6ff 100%);
--primary-blue: #495cfc;
--primary-turquoise: #5ee7df;
--primary-sky: #66a6ff;
```

#### Colores de Superficie
```css
--surface-primary: #ffffff;
--surface-secondary: rgba(255, 255, 255, 0.95);
--surface-elevated: #ffffff;
```

#### Colores de Texto
```css
--text-primary: #2b244d;
--text-secondary: rgba(43, 36, 77, 0.7);
--text-disabled: rgba(43, 36, 77, 0.4);
--text-on-primary: #ffffff;
```

#### Colores de Acento
```css
--accent-blue: #495cfc;
--accent-turquoise: #5ee7df;
--accent-pink: #ff0070;
```

### Modo Oscuro (Dark Mode)

#### Colores Principales
```css
--primary-gradient-dark: linear-gradient(to bottom, #372865, #000000);
--primary-purple: #372865;
--primary-black: #000000;
```

#### Colores de Superficie
```css
--surface-primary-dark: #2b244d;
--surface-secondary-dark: rgba(43, 36, 77, 0.8);
--surface-elevated-dark: #372865;
```

#### Colores de Texto
```css
--text-primary-dark: #ffffff;
--text-secondary-dark: rgba(255, 255, 255, 0.7);
--text-disabled-dark: rgba(255, 255, 255, 0.4);
```

#### Colores de Acento
```css
--accent-pink: #ff0070;
--accent-purple: #495cfc;
```

---

## 📐 Espaciado y Dimensiones

### Sistema de Espaciado
Basado en múltiplos de 8px (0.5rem)

```css
--spacing-xs: 0.5rem;   /* 8px */
--spacing-sm: 1rem;     /* 16px */
--spacing-md: 1.5rem;   /* 24px */
--spacing-lg: 2rem;     /* 32px */
--spacing-xl: 3rem;     /* 48px */
--spacing-xxl: 4rem;    /* 64px */
```

### Border Radius
```css
--radius-sm: 0.5rem;    /* 8px - Elementos pequeños */
--radius-md: 1rem;      /* 16px - Cards, inputs, buttons */
--radius-lg: 1.5rem;    /* 24px - Modales, contenedores grandes */
--radius-full: 50%;     /* Círculos perfectos */
```

### Sombras (Shadows)

#### Modo Claro
```css
--shadow-sm: 0 0 1rem rgba(0, 0, 255, 0.1);
--shadow-md: 0 0 2rem rgba(0, 0, 255, 0.15);
--shadow-lg: 0 0 3rem rgba(0, 0, 255, 0.3);
--shadow-header: 0 0 2rem rgba(0, 0, 255, 0.1);
```

#### Modo Oscuro
```css
--shadow-sm-dark: 0 0 1rem rgba(0, 0, 0, 0.3);
--shadow-md-dark: 0 0 2rem rgba(0, 0, 0, 0.5);
--shadow-lg-dark: 0 0 3rem rgba(0, 0, 0, 0.7);
```

---

## 🔤 Tipografía

### Familia de Fuentes
```css
--font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
               'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
               'Helvetica Neue', sans-serif;
```

### Tamaños de Fuente
```css
--text-xs: 0.75rem;     /* 12px */
--text-sm: 0.875rem;    /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg: 1.125rem;    /* 18px */
--text-xl: 1.25rem;     /* 20px */
--text-2xl: 1.5rem;     /* 24px */
--text-3xl: 1.875rem;   /* 30px */
--text-4xl: 2.25rem;    /* 36px */
```

### Pesos de Fuente
```css
--font-light: 300;
--font-regular: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

---

## 🎭 Animaciones y Transiciones

### Duraciones
```css
--transition-fast: 150ms;
--transition-base: 300ms;
--transition-slow: 500ms;
```

### Easings
```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out: cubic-bezier(0.0, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
```

### Animaciones Predefinidas

#### Fade In
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

#### Slide Down
```css
@keyframes slideDown {
  from { transform: translateY(-25%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

#### Slide Up
```css
@keyframes slideUp {
  from { transform: translateY(50%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

#### Slide Right
```css
@keyframes slideRight {
  from { transform: translateX(-50%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

#### Scale Up
```css
@keyframes scaleUp {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
```

---

## 🧩 Componentes

### Botones

#### Botón Primario
```css
background: linear-gradient(135deg, #5ee7df 0%, #66a6ff 100%);
color: #ffffff;
border-radius: 1rem;
padding: 0.75rem 1.5rem;
box-shadow: 0 0 1rem rgba(0, 0, 255, 0.2);
transition: all 300ms ease;
font-weight: 500;
```

**Hover:**
```css
box-shadow: 0 0 2rem rgba(0, 0, 255, 0.3);
transform: translateY(-2px);
```

#### Botón Secundario
```css
background: transparent;
color: #495cfc;
border: 2px solid #495cfc;
border-radius: 1rem;
padding: 0.75rem 1.5rem;
transition: all 300ms ease;
```

**Hover:**
```css
background: rgba(73, 92, 252, 0.1);
```

### Cards

```css
background: #ffffff;
border-radius: 1rem;
padding: 1.5rem;
box-shadow: 0 0 2rem rgba(0, 0, 255, 0.1);
transition: all 300ms ease;
```

**Hover:**
```css
box-shadow: 0 0 3rem rgba(0, 0, 255, 0.2);
transform: translateY(-4px);
```

### Inputs

```css
background: rgba(255, 255, 255, 0.9);
border: 2px solid transparent;
border-radius: 1rem;
padding: 0.75rem 1rem;
font-size: 1rem;
transition: all 300ms ease;
```

**Focus:**
```css
border-color: #495cfc;
background: #ffffff;
box-shadow: 0 0 1rem rgba(73, 92, 252, 0.2);
outline: none;
```

### Header/AppBar

```css
background: #ffffff;
box-shadow: 0 0 2rem rgba(0, 0, 255, 0.1);
min-height: 4rem;
animation: slideDown 300ms ease, fadeIn 300ms ease;
```

### Autocomplete/Dropdown

```css
background: #ffffff;
border: none;
border-radius: 1rem;
box-shadow: 0 0 2rem rgba(0, 0, 255, 0.3);
overflow: hidden;
```

**Items:**
```css
padding: 1rem;
cursor: pointer;
transition: background 150ms ease;
```

**Items Hover:**
```css
background: rgba(0, 0, 255, 0.1);
```

---

## 📱 Responsive Design

### Breakpoints
```css
--breakpoint-xs: 0px;       /* Mobile pequeño */
--breakpoint-sm: 600px;     /* Mobile grande */
--breakpoint-md: 900px;     /* Tablet */
--breakpoint-lg: 1200px;    /* Desktop */
--breakpoint-xl: 1536px;    /* Desktop grande */
```

### Mobile First
- Diseñar primero para móvil
- Usar Grid/Flexbox para layouts responsivos
- Ocultar elementos no esenciales en mobile
- Menú hamburguesa en pantallas pequeñas

---

## 🎯 Principios de Diseño

### 1. Gradientes Vibrantes
- Usar gradientes suaves de turquesa a azul como fondo principal
- Aplicar gradientes en botones y elementos destacados
- Cambiar a gradientes oscuros (púrpura a negro) en modo oscuro

### 2. Sombras con Color
- Las sombras tienen un tinte azul sutil en modo claro
- Esto crea cohesión visual con la paleta de colores
- En modo oscuro, usar sombras más intensas y oscuras

### 3. Animaciones Sutiles
- Todas las interacciones tienen transiciones suaves (300ms)
- Los elementos se animan al aparecer (fadeIn, slideDown, etc.)
- Hover states con elevación (translateY) para feedback

### 4. Bordes Redondeados
- Usar 1rem como border-radius estándar
- Crea una apariencia moderna y amigable
- Consistencia en todos los componentes

### 5. Espaciado Generoso
- Dar aire a los elementos (padding de 1-1.5rem)
- Separación clara entre secciones
- Evitar la sobrecarga visual

### 6. Tipografía Clara
- Sans-serif para máxima legibilidad
- Jerarquía clara con tamaños y pesos
- Suficiente contraste en todos los modos

---

## 🌓 Implementación de Tema Oscuro

### Toggle de Tema
El usuario puede alternar entre modo claro y oscuro mediante un switch con:
- Indicador circular animado
- Color rosa (#ff0070) cuando está activo
- Transición suave de 300ms
- Persistencia en localStorage

### Cambios Globales
Al cambiar de tema:
1. Background cambia de gradiente turquesa-azul a púrpura-negro
2. Superficies cambian de blanco a tonos oscuros (#2b244d)
3. Texto invierte de oscuro a claro
4. Sombras se vuelven más intensas
5. Acentos cambian de azul a rosa

---

## 📋 Checklist de Implementación

- [ ] Configurar paleta de colores en theme.ts
- [ ] Implementar sistema de tema claro/oscuro
- [ ] Crear componentes de botones con nuevos estilos
- [ ] Aplicar sombras con tinte azul
- [ ] Añadir animaciones a componentes principales
- [ ] Actualizar inputs y forms con nuevo diseño
- [ ] Rediseñar cards con gradientes y sombras
- [ ] Implementar header con animación slideDown
- [ ] Añadir transiciones hover a elementos interactivos
- [ ] Responsive design en todos los componentes
- [ ] Agregar toggle de tema en Layout
- [ ] Persistir preferencia de tema en localStorage

---

## 🔗 Referencias

- **Diseño Original**: [Minimus Weather App](https://minimus-weather.firebaseapp.com)
- **Repositorio**: [hamedbaatour/Minimus](https://github.com/hamedbaatour/Minimus)
- **Tutorial**: [Medium - Build a Beautiful Web App with Angular](https://hamedbaatour.medium.com/build-a-real-world-beautiful-web-app-with-angular-6-a-to-z-ultimate-guide-2018-part-i-e121dd1d55e)

---

*Última actualización: 2025-11-05*
