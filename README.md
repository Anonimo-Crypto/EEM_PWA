# Earnings and Expenses Monitor (EEM)

PWA para registrar ingresos diarios, distribuirlos automáticamente en categorías de gasto según porcentajes definidos, consultar historial, ver gráficos y exportar/importar datos en CSV.

## Características

- **Registro diario de ingresos**: introduce lo que ganaste hoy.
- **Categorías personalizables**: crea campos (Personal, Familia, Moto, etc.) y asigna un porcentaje a cada uno. La suma debe ser 100 %.
- **Distribución automática**: al guardar, el ingreso del día se reparte según los porcentajes configurados.
- **Historial persistente**: todos los registros se guardan localmente.
- **Promedios y estimaciones**: promedio diario, semanal y mensual + proyección semanal/mensual cuando hay datos suficientes.
- **Gráficos**:
  - Distribución actual (pastel)
  - Evolución de cada categoría en el tiempo (barras / líneas)
- **Exportación CSV** bien organizada.
- **Importación CSV** con dos modos:
  1. **Respaldo**: restaura todo el historial, categorías y gráficos.
  2. **Revisión**: abre una ventana nueva con los datos del período seleccionado.
- **Filtros de importación**:
  - Todos los datos
  - Solo este día
  - Esta semana
  - Este mes
  - Rango personalizado (calendario)
- **Borrar todos los datos** (con confirmación).
- Diseño limpio con pestañas, tema claro/oscuro y completamente responsive.
- Instalable como PWA (manifest + iconos).

## Estructura de archivos

```
./index.html
./main.js
./style.css
./manifest.json
./192.png
./512.png
./README.md
./MIT License
./Versions.txt
```

## Cómo usar

1. Abre `index.html` en un navegador moderno (Chrome, Edge, Firefox, Safari).
2. (Opcional) Instala la PWA desde el menú del navegador.
3. Ve a la pestaña **Categorías** y define tus campos + porcentajes (deben sumar 100 %).
4. En **Hoy** introduce el ingreso del día y pulsa **Guardar gastos**.
5. Consulta **Historial** y **Gráficos**.
6. Usa **Datos** para exportar o importar CSV.

## Datos

Todo se almacena en `localStorage` del navegador. No se envía nada a ningún servidor.

## Licencia

MIT License (ver archivo `MIT License`).

## Versión

Consulta `Versions.txt`.
