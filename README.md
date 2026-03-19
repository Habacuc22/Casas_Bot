# 🏠 CuentasBot

Bot de Telegram para gestionar gastos compartidos entre tres casas familiares.  
Desarrollado en Google Apps Script con Google Sheets como base de datos.

---

## ¿Qué hace este bot?

Diego adelanta el pago de todas las boletas (impuestos y gastos comunes). Las otras casas le transfieren su parte. El bot registra cada gasto, divide el monto entre las casas que corresponde, registra las transferencias recibidas y calcula en tiempo real cuánto le debe cada casa a Diego.

El saldo de Casa 2 (Diego) siempre tiende a cero cuando todo está saldado. Lo que no se salda en el mes se arrastra automáticamente al siguiente con precisión de centavos.

---

## Estructura familiar

| Casa   | Integrantes              | Rol                        |
|--------|--------------------------|----------------------------|
| Casa 1 | Junior y Gaby            | Participan en gastos       |
| Casa 2 | Diego y Nanci            | Opera el bot, adelanta pagos |
| Casa 3 | Abu                      | Participa en gastos        |

---

## Arquitectura

```
Telegram
   ↕
Google Apps Script  ←→  Google Sheets
```

- **Telegram**: interfaz de usuario. Diego escribe comandos y recibe respuestas.
- **Google Apps Script**: motor de toda la lógica. Recibe los mensajes, los procesa y escribe en Sheets.
- **Google Sheets**: base de datos. Almacena gastos, transferencias, saldos e historial.

---

## Estructura de Google Sheets

| Hoja              | Contenido                                                              |
|-------------------|------------------------------------------------------------------------|
| `Configuracion`   | Qué casas participan en cada impuesto fijo. Editable manualmente.     |
| `Gastos`          | Registro de cada gasto: fecha, nombre, monto, tipo, estado, participación por casa. |
| `Transferencias`  | Registro de cada transferencia recibida: fecha, casa, monto.          |
| `SaldosMensuales` | Saldo final de cada casa por mes, con arrastre automático.            |
| `Log`             | Registro de todas las interacciones con el bot.                       |

---

## Tipos de gastos

### Tipo A — Impuestos fijos
Casas participantes predefinidas en la hoja `Configuracion`.

| Impuesto  | Casa 1 | Casa 2 | Casa 3 |
|-----------|--------|--------|--------|
| EPE (luz) | ✅     | ✅     | ✅     |
| Agua      | ✅     | ✅     | ✅     |
| Gas       | ✅     | ✅     | ✅     |
| TGI       | ✅     | ✅     | ✅     |
| API       | ✅     | ✅     | ✅     |
| Internet  | ✅     | ✅     | ❌     |
| Cable     | ❌     | ❌     | ✅     |

### Tipo B — Gastos eventuales
Electricista, materiales, reparaciones, etc.  
Al cargarlos el bot pregunta qué casas participan y el usuario responde con números (`1 3`, `1 2 3`, etc.).

---

## Estados de un gasto

| Estado       | Descripción                                                                 |
|--------------|-----------------------------------------------------------------------------|
| `activo`     | Pertenece al mes actual. Suma al cálculo de saldos.                        |
| `programado` | Pertenece a un mes futuro. Visible en vencimientos pero no afecta el mes actual. |
| `pagado`     | El mes fue cerrado. Solo lectura.                                           |

---

## Flujo de trabajo mensual

1. Llegan las boletas → Diego carga cada impuesto con monto y fecha de vencimiento opcional.
2. El bot genera el resumen → detalle por impuesto y saldo de cada casa.
3. Diego comparte el resumen con Casa 1 y Casa 3.
4. Las casas transfieren (puede ser parcial) → Diego registra cada transferencia.
5. Llegan boletas pendientes (ej: EPE) → Diego las carga, el bot actualiza el resumen.
6. Se registran las transferencias restantes.
7. Fin de mes → el sistema cierra automáticamente. Los saldos se arrastran al mes siguiente.

---

## Comandos

### Cargar impuesto fijo
```
epe 343400
agua 15000 25/3
```
Si la fecha pertenece a un mes futuro, el gasto se marca automáticamente como **programado**.

### Cargar gasto eventual
```
electricista 25000
```
El bot responde preguntando qué casas participan. Se responde con números:
```
1 3
```

### Registrar transferencia
```
pago casa1 30000
pago casa3 15000
```

### Ver resumen del mes actual
```
/resumen
```
Muestra todas las casas: detalle de gastos, participación, transferencias y saldo.

### Ver resumen individual por casa
```
/resumen_casa1
/resumen_casa2
/resumen_casa3
```
Muestra el detalle de cada impuesto con la participación de esa casa, total que le corresponde y saldo actual. Listo para screenshot.

### Ver historial de meses anteriores
```
/historial_noviembre
/historial_marzo
```
El bot infiere el año automáticamente. Ejemplo: consultar `/historial_noviembre` en marzo 2026 devuelve noviembre 2025.

### Ver próximos vencimientos
```
/vencimientos
```
Lista todos los gastos activos y programados con fecha de vencimiento, ordenados por fecha.

### Corregir un gasto del mes actual
```
/corregir
```
Muestra los gastos con botones inline. Al elegir uno, el bot pide el nuevo monto (y opcionalmente nueva fecha). Recalcula automáticamente la participación por casa.

### Eliminar un gasto del mes actual
```
/eliminar
```
Muestra los gastos con botones inline. Pide confirmación antes de eliminar.

### Ayuda
```
/ayuda
```
Lista completa de comandos con descripción breve.

> **Nota:** Solo se pueden corregir o eliminar gastos del mes actual. Los meses cerrados son de solo lectura.

---

## División de montos

El bot divide los montos con precisión de centavos. Si el resultado no es exactamente divisible, los centavos sobrantes se distribuyen entre las primeras casas para que la suma siempre sea exactamente igual al total.

Ejemplo: $100 entre 3 casas → $33,34 + $33,33 + $33,33

---

## Cierre de mes

El último día de cada mes el bot:
1. Calcula el saldo final de cada casa.
2. Guarda ese saldo en la hoja `SaldosMensuales`.
3. Marca todos los gastos activos del mes como `pagado`.
4. Activa los gastos programados del mes siguiente.
5. El saldo pendiente se arrastra automáticamente al mes siguiente.

El cierre se ejecuta mediante un trigger semanal de Google Apps Script configurado para correr todos los lunes. El código verifica internamente si el mes ya fue cerrado para no ejecutarse dos veces.

---

## Seguridad

- El bot es estrictamente privado. Solo responde al chat ID autorizado.
- El token de Telegram y el ID del Sheet se guardan en `PropertiesService` de Apps Script, no en el código.
- Cualquier mensaje de un chat no autorizado es rechazado y registrado en el log.

---

## Instalación

### Requisitos
- Cuenta de Google
- Bot de Telegram creado con [@BotFather](https://t.me/BotFather)
- Tu chat ID de Telegram (obtenerlo con [@userinfobot](https://t.me/userinfobot))

### Pasos

**1. Crear el Google Sheet**

Crear un Google Sheet vacío y copiar el ID de la URL:
```
https://docs.google.com/spreadsheets/d/[ESTE_ES_EL_ID]/edit
```

**2. Configurar Apps Script**

Dentro del Sheet: `Extensiones → Apps Script`

Pegar todo el contenido de `Code.gs` en el editor.

**3. Completar los datos en `setup()`**

```javascript
props.setProperty('TELEGRAM_TOKEN', 'TU_TOKEN_AQUI');
props.setProperty('SHEET_ID',       'TU_SHEET_ID_AQUI');
props.setProperty('WEBHOOK_URL',    'URL_DE_TU_WEB_APP_AQUI');
props.setProperty('ADMIN_IDS', JSON.stringify([TU_CHAT_ID_AQUI]));
```

**4. Ejecutar `setup()`**

Desde el editor de Apps Script, seleccionar la función `setup` y ejecutarla una sola vez.  
Esto crea todas las hojas y carga la configuración inicial de impuestos.

**5. Publicar como Web App**

```
Implementar → Nueva implementación → Web App
Ejecutar como: Yo
Acceso: Cualquier persona
```

Copiar la URL que genera.

**6. Completar `WEBHOOK_URL` y ejecutar `setWebhook()`**

Pegar la URL del paso anterior en `setup()` donde dice `WEBHOOK_URL`, volver a ejecutar `setup()`, y luego ejecutar `setWebhook()`.

**7. Configurar el trigger de cierre de mes**

```
Apps Script → Triggers (ícono de reloj) → + Agregar trigger

Función:        cerrarMes
Fuente:         Tiempo
Tipo:           Temporizador semanal
Día:            Lunes
Hora:           11 PM a 12 AM
```

**8. Probar**

Abrir el bot en Telegram y escribir `/ayuda`.

> **Importante:** cada vez que se modifique el código hay que publicar una nueva versión en `Implementar → Administrar implementaciones` para que los cambios sean efectivos en Telegram.

---

## Modificar la configuración de impuestos

Para cambiar qué casas participan en cada impuesto, editar directamente la hoja `Configuracion` en el Sheet. Cambiar `TRUE` por `FALSE` o viceversa en la columna correspondiente. El cambio se aplica a los próximos gastos que se carguen.

---

## Tecnologías

- [Google Apps Script](https://developers.google.com/apps-script)
- [Google Sheets](https://www.google.com/sheets/about/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
