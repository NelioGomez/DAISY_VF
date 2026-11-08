---
id: acceso
titulo: Entrar y salir del sistema
grupo: Primeros pasos
modulo:
resumen: Cómo iniciar sesión, qué pasa si se equivoca de contraseña, cómo recuperarla si la olvidó y cuándo se cierra la sesión.
---

## Iniciar sesión

Cada persona tiene su propio usuario, que le entrega el administrador del sistema. **No comparta su usuario ni su contraseña**: todo lo que se haga con él queda registrado a su nombre.

![Pantalla de inicio de sesión del sistema interno.](/manual/acceso-login.webp)

1. **Usuario o correo**: escriba su nombre de usuario (por ejemplo, `jflores`) o su correo.
2. **Contraseña**: escriba su contraseña. El botón del ojo, a la derecha, la muestra u oculta por si quiere revisar lo que escribió. Si tiene activado Bloq Mayús, el sistema se lo avisa debajo del campo.
3. **Recordar mi usuario**: guarda solamente su usuario en ese navegador, para no escribirlo la próxima vez. La contraseña **nunca** se guarda.
4. **¿Olvidó su contraseña?**: abre la recuperación de contraseña (vea más abajo).
5. **Iniciar sesión**: entra al sistema.
6. **Tema**: cambia los colores de la pantalla entre claro, oscuro o como el sistema de su computadora.

### Pasos

1. Abra el navegador (Chrome, Edge o Firefox) y entre a la dirección del sistema que le dio el administrador.
2. Escriba su usuario o correo y su contraseña.
3. Haga clic en **Iniciar sesión** o presione [[Enter]].
4. Aparece el aviso *Sesión iniciada como…* con su nombre y se abre el **Dashboard**.

> **Nota:** El cuadro **Cuentas de prueba** que se ve en la imagen solo aparece en la versión de prueba del sistema, para hacer demostraciones. En el sistema real no existe.

> **Consejo:** No use **Recordar mi usuario** en una computadora compartida o pública.

## Si se equivoca de contraseña

- El sistema muestra **Usuario o contraseña incorrectos.** No dice cuál de los dos está mal; así nadie puede averiguar qué usuarios existen.
- Cuando le quedan pocos intentos, el aviso lo indica: *Le quedan 2 intentos antes del bloqueo temporal.*
- Si sigue fallando, el acceso se **bloquea durante un minuto**. El botón muestra la cuenta regresiva (**Bloqueado 0:59**). Espere a que termine y vuelva a intentarlo; no hace falta llamar a nadie.

## Recuperar la contraseña

Si olvidó su contraseña, puede crear una nueva usted mismo. Solo necesita tener acceso al correo registrado en su usuario. El proceso tiene tres pasos: **Correo**, **Código** y **Nueva contraseña**.

![Paso 1: escriba el correo de su cuenta.](/manual/acceso-recuperar-1.webp)

1. En la pantalla de inicio de sesión, haga clic en **¿Olvidó su contraseña?**
2. Escriba el **Correo electrónico** de su cuenta y haga clic en **Enviar código**.
3. Revise su correo (también la carpeta de correo no deseado). Le llega un **código de 6 dígitos**.

![Paso 2: escriba el código de 6 dígitos que le llegó al correo.](/manual/acceso-recuperar-2.webp)

4. Escriba el código en las seis casillas (también puede pegarlo completo) y haga clic en **Verificar código**.
5. Escriba su **Nueva contraseña**, repítala en **Confirmar contraseña** y haga clic en **Guardar contraseña**.
6. El sistema lo regresa al inicio de sesión con el aviso de que la contraseña se actualizó y con su usuario ya escrito. Entre con la contraseña nueva.

Tenga en cuenta:

- El código **vence en 10 minutos**; la pantalla muestra cuánto tiempo le queda. Si venció, pida uno nuevo.
- Si el código no llega, después de un minuto se activa **Reenviar código**. También puede volver atrás y escribir otro correo.
- Si escribe mal el código varias veces, debe pedir uno nuevo.
- Por seguridad, el sistema responde lo mismo aunque el correo no pertenezca a ninguna cuenta. Si no le llega nada, pida al administrador que revise el correo registrado en su usuario.

> **Importante:** Al cambiar la contraseña se cierran las sesiones que tenía abiertas en otras computadoras o celulares.

## Cómo crear una contraseña segura

Mientras escribe la contraseña nueva, el sistema marca con un visto cada requisito que ya cumple. La contraseña debe tener:

- al menos **10 caracteres**;
- **mayúsculas y minúsculas**;
- al menos **un número**;
- al menos **un símbolo**, por ejemplo `#`, `$`, `!` o `?`;
- y **no debe contener su nombre de usuario**.

> **Consejo:** Una frase corta es fácil de recordar y difícil de adivinar, por ejemplo `Bomba#Diesel2026`. No use la misma contraseña de su correo o de sus redes sociales.

## Cerrar sesión

- Para salir, haga clic en **Cerrar sesión** :ic-log-out:, el último botón de la barra superior. Hágalo siempre que deje la computadora, sobre todo si otras personas la usan.
- Si no usa el sistema durante **15 minutos**, la sesión se cierra sola para proteger la información. Al volver a entrar, el sistema lo regresa a la misma pantalla donde estaba.

## Si necesita un usuario o cambiar de rol

Los usuarios los crea el **administrador del sistema**. Pídale a él que:

- cree un usuario para una persona nueva;
- cambie el rol de alguien (por ejemplo, de vendedor a gerencia);
- desactive el usuario de una persona que ya no trabaja en la empresa;
- corrija el correo registrado, si no le llegan los códigos de recuperación.

Lo que cada rol puede ver y hacer se explica en [Roles y permisos](?cap=roles).
