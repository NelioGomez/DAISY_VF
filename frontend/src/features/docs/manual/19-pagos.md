---
id: pagos
titulo: Pagos y cuentas por cobrar
grupo: Pagos
modulo: pagos
resumen: Qué facturas de crédito tienen saldo, cuáles están vencidas, cómo registrar un abono o el pago completo y cómo consultar el historial de pagos.
---

## Para qué sirve

Cuando se vende **a crédito**, la factura queda con un **saldo por cobrar**. En **Pagos y CxC** :ic-wallet: se controlan esos saldos y se registra cada pago que hace el cliente, sea un abono o el pago completo. CxC quiere decir *cuentas por cobrar*.

Se abre en el menú **Pagos y CxC**. El número rojo indica cuántas facturas tienen saldo. Lo usan el administrador y contabilidad.

![Pagos y cuentas por cobrar.](/manual/pagos.webp)

## El resumen

Las tres tarjetas de arriba muestran:

- **Total por cobrar**: lo que deben los clientes y en cuántas facturas.
- **Facturas vencidas**: cuántas pasaron su fecha de vencimiento y cuánto suman.
- **Pagos registrados**: cuántos pagos se han registrado y su total.

## Cuentas por cobrar

La tabla lista cada factura con saldo: el número, el cliente, el **total**, el **saldo** pendiente, la fecha en que **vence** y el estado (**Pendiente** si no ha pagado nada, **Parcial** si ya abonó). Si una factura está vencida, su fecha se ve en rojo con los días de atraso, por ejemplo *⚠ 12 d*.

Puede buscar por factura, cliente o teléfono, y filtrar por:

- **Vencimiento**: vencidas, con más de 30 días de atraso, o vigentes.
- **Estado**: pendiente o parcial.
- **Fechas de vencimiento**: desde y hasta.

> **Consejo:** Cada mañana, filtre por **Vencidas** para saber a quién llamar. El Dashboard también avisa de las facturas vencidas y de las que vencen hoy o mañana, y muestra la **antigüedad** de lo que se debe.

## Registrar un pago

![Registrar un pago a una factura.](/manual/pagos-registrar.webp)

1. Busque la factura en **Cuentas por cobrar** y haga clic en **Registrar pago**.
2. Revise el cliente, el **total de la factura** y el **saldo actual**.
3. Escriba el **Monto a abonar (C$)**. Puede ser una parte o todo el saldo, pero no más (debajo se indica el máximo).
4. Elija el **Medio de pago**: **Contado** (efectivo) o **Transferencia**.
5. Si es transferencia, escriba la **Referencia de la transferencia** (por ejemplo `TRF-LAFISE-10442`). Es obligatoria.
6. Haga clic en **Registrar abono**.

El sistema muestra el saldo que queda. Si el pago cubre todo, avisa que la factura quedó **pagada por completo**, y la factura desaparece de las cuentas por cobrar y pasa a **Pagada** en [Ventas](?cap=ventas).

También puede llegar a esta pantalla con el botón **Registrar pago** de una factura o del perfil de un cliente.

> **Importante:** Un pago registrado **no se puede borrar ni modificar** desde el sistema. Revise el monto y la referencia antes de confirmar. Si se equivocó, avise al administrador del sistema.

## Historial de pagos

Más abajo está el **Historial de pagos**: cada pago con su fecha, la factura, el cliente, el monto, el medio y la referencia. Puede buscar por factura, cliente, referencia o usuario, y filtrar por **Medio** y fechas.

> **Consejo:** Para cuadrar la caja o el banco de un periodo, filtre el historial por fechas y por medio (**Efectivo** o **Transferencia**) y sume los montos.

## Cómo se calcula el vencimiento

La fecha de vencimiento se fija al vender: es la fecha de la venta más el **plazo de crédito** que se eligió en el [punto de venta](?cap=pos#venta-a-credito) (entre 1 y 365 días). Al pasar esa fecha con saldo, la factura queda **Vencida**.
