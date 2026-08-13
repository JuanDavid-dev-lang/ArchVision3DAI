# Facturacion

Fase 7. Suscripciones de pago con Wompi, en pesos colombianos.

## Lo primero: que no se guarda

Ningun dato de tarjeta entra aqui, ni siquiera cifrado. El cobro ocurre en el
checkout alojado de la pasarela. De un medio de pago se conservan la marca y
los cuatro ultimos digitos, que es lo que el usuario necesita para reconocerlo,
y un identificador opaco de la pasarela para poder renovar.

## Planes

| Plan | Mensual | Anual | Para quien |
| --- | --- | --- | --- |
| Free | $0 | — | Probar la herramienta con un proyecto real |
| Pro | $79.000 | $790.000 | Quien entrega proyectos a clientes |
| Studio | $249.000 | $2.490.000 | Oficinas con varios proyectos a la vez |
| Enterprise | a convenir | a convenir | Volumen alto y acuerdos a medida |

El plan anual equivale a diez mensualidades: dos meses gratis. Se explica en
una frase, a diferencia de un porcentaje que obliga a hacer cuentas.

Los precios viven en `packages/config/src/pricing.ts` y son la unica fuente:
la landing, la pantalla de facturacion y el importe que se envia a la pasarela
salen del mismo sitio, y no pueden discrepar. **El importe nunca viaja desde el
navegador**: si viniera del cliente, cualquiera contrataria Studio por mil
pesos editando la peticion.

## Wompi no gestiona suscripciones

Es la diferencia mas importante con otras pasarelas y condiciona el diseño.
Wompi cobra transacciones sueltas; no tiene ciclos, ni reintentos, ni estado de
suscripcion. Todo eso lo lleva la aplicacion:

```
packages/billing/          Puro y probado: decide
  periods.ts               Cuando vence un periodo
  entitlements.ts          Que plan da derecho a que
  state.ts                 Que significa un cobro aprobado, rechazado o una baja
  reference.ts             La referencia que une nuestro cobro con el suyo

apps/web/lib/billing/
  providers/wompi.ts       Firma, cobra y traduce eventos
  providers/manual.ts      Pasarela simulada para desarrollo
  service.ts               Une las tres partes con la base de datos
```

## Estados

```
incomplete ──pago aprobado──▶ active ──cobro fallido──▶ past_due
                                │                          │
                          baja pedida                 gracia agotada
                                ▼                          ▼
                            canceled ◀───────────────── canceled
```

| Estado | Que significa para el usuario |
| --- | --- |
| `incomplete` | Alta iniciada, sin pagar. **No da derecho a nada** |
| `trialing` | Prueba en curso |
| `active` | Al dia |
| `past_due` | Un cobro fallo; conserva el servicio 7 dias |
| `canceled` | Terminada, pero conserva lo pagado hasta el fin del periodo |

Dos decisiones que merecen explicacion:

**La gracia de 7 dias.** Cortar el acceso el mismo dia castiga al cliente por
una tarjeta vencida o un banco caido, que es la causa mas frecuente de un cobro
fallido. Una semana da tiempo a reaccionar sin regalar un mes. Reintentar el
cobro no reinicia el plazo, o el impago no venceria nunca.

**La baja no corta el servicio.** Se conserva hasta el final de lo pagado.
Cobrar un mes y quitarlo el mismo dia es lo que convierte una baja en una
reclamacion.

## El derecho manda sobre la copia

`user.plan` es una copia denormalizada para no consultar la suscripcion en cada
peticion. La verdad es `entitlementOf(suscripcion, ahora)`, y se recalcula:

- al abrir la pantalla de facturacion o de configuracion;
- **al crear un proyecto, subir un archivo o guardar una version**, que es
  donde el limite tiene consecuencias.

Asi, una suscripcion que caduca deja de dar acceso aunque ningun proceso
programado se haya ejecutado.

## Periodos

Un mes no son 30 dias. Quien contrata el 31 de enero renueva el 28 de febrero
y vuelve al 31 en marzo: recortar sin recordar el dia original haria que la
fecha de cobro se desplazara sola mes a mes.

Un cobro que se procesa con dos dias de retraso no le quita esos dos dias al
cliente: el periodo nuevo arranca donde terminaba el anterior. Solo cuando el
retraso supera un periodo entero se reancla en la fecha del cobro, para no
arrastrar tiempo que nadie va a pagar.

Todo se calcula en UTC. Mezclar husos horarios en fechas de cobro produce
errores de un dia que solo aparecen para parte de los clientes.

## Renovaciones

Como Wompi no tiene ciclos, alguien tiene que decidir cuando toca cobrar:

```
POST /api/billing/renewals
Authorization: Bearer $BILLING_CRON_SECRET
```

Se llama una vez al dia desde el programador del servidor. Cobra solo despues
de que el periodo venza —adelantarlo seria cobrar un servicio no prestado— y
solo si hay medio de pago guardado. Cuando no lo hay, la pantalla de
facturacion lo dice para que el usuario renueve a mano.

## Webhook

`POST /api/billing/webhook/:provider` es el unico punto donde alguien sin
sesion puede cambiar un plan. Por eso:

1. La firma se verifica sobre el cuerpo **crudo**, antes de interpretarlo:
   parsear el JSON antes cambiaria los bytes sobre los que se calculo.
2. Un evento sin firma valida no se guarda ni se procesa.
3. Los repetidos se descartan por clave unica `(provider, externalId)`. Las
   pasarelas reintentan, y sin ese control un mismo pago ampliaria el periodo
   dos veces.
4. Se responde 200 tambien al descartar un repetido: un error haria que la
   pasarela siguiera reintentando algo ya resuelto.

## Probar sin credenciales

Con `BILLING_PROVIDER=manual` (el valor por defecto) el checkout lleva a una
pantalla propia con dos botones: aprobar y rechazar. El evento simulado entra
por el mismo webhook, firmado con `AUTH_SECRET`, y pasa la misma verificacion
que uno real. Sin eso, la prueba no estaria probando el codigo que corre en
produccion.

La pasarela simulada **se apaga sola en produccion**: alli, un plan de pago
concedido sin cobro seria un fallo de facturacion, no una comodidad.

## Puesta en marcha con Wompi

1. Crear la cuenta de comercio y obtener las cuatro claves del panel: publica,
   privada, de integridad y de eventos.
2. Ponerlas en el entorno y cambiar `BILLING_PROVIDER=wompi`.
3. Registrar la URL del webhook en el panel de Wompi:
   `https://tu-dominio/api/billing/webhook/wompi`.
4. Programar la llamada diaria a `/api/billing/renewals`.
5. Probar en `sandbox` antes de pasar a `production`.

## Lo que falta

- **Facturacion electronica DIAN.** La aplicacion registra cobros, no emite
  facturas validas ante la DIAN. Para vender a empresas en Colombia hace falta
  un proveedor tecnologico de facturacion electronica.
- **Retenciones e IVA.** Los precios se muestran con IVA incluido; el
  tratamiento contable queda fuera.
- **Prorrateo al cambiar de plan.** Hoy el cambio se cobra completo y el
  periodo en curso se respeta; no se descuenta la parte no consumida.
- **Cobro de renovacion sin medio de pago guardado.** El checkout alojado no
  siempre devuelve una fuente de pago reutilizable; en ese caso la renovacion
  es manual.
- **Avisos por correo** de cobro fallido y fin de periodo: el sistema de correo
  llega con la fase de colaboracion.
