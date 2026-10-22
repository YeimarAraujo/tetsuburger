# Ficha de Google para TETSUBURGER (negocio de área de servicio)

> Acción manual del dueño. No requiere cambios de código.
> Al terminar, copia la URL de la ficha en `site.social.googleBusiness`
> (`src/config/site.ts`) para que aparezca en el footer y en el JSON-LD.

## 1. Crear la ficha

1. Entra a <https://business.google.com> con la cuenta de Google del negocio.
2. **Agregar negocio** → nombre exacto: `TETSUBURGER`.
3. Categoría principal: **Restaurante de hamburguesas**.
   Categoría secundaria: **Servicio de comida a domicilio**.
4. Cuando pregunte por la dirección, elige **“Entrego bienes y servicios a los
   clientes en su ubicación”** (negocio de área de servicio).
5. Área de servicio: **Valledupar, Cesar**. Puedes añadir barrios o un radio.
   No agregues direcciones fuera de tu cobertura real.
6. **Oculta la dirección**: no debe mostrarse ninguna dirección pública porque
   la cocina no atiende al público.

## 2. Datos que deben coincidir con la web

| Campo | Valor |
|---|---|
| Nombre | TETSUBURGER |
| Teléfono | +57 304 424 3650 |
| Sitio web | tu dominio de producción (el mismo de `NEXT_PUBLIC_SITE_URL`) |
| Horario | el mismo de `business_hours` en el panel |
| Área de servicio | Valledupar, Cesar, Colombia |

El nombre, teléfono y ciudad deben ser **idénticos** en la ficha, el footer y
el JSON-LD (`Restaurant`). Si cambias uno, cambia los tres.

## 3. Verificación

1. Google pedirá verificar la propiedad (video, teléfono o correo).
2. Para video: graba la cocina, insumos, empaques y el proceso de un pedido.
   Muestra que operas desde Valledupar.
3. La verificación puede tardar varios días. No cambies el nombre ni la
   categoría durante el proceso.

## 4. Después de verificar

1. Sube fotos reales: portada, productos, equipo y empaque (mínimo 10).
2. Publica 3–4 fotos por semana y usa **Publicaciones** para promociones.
3. Completa la descripción (600–750 caracteres) con la propuesta de valor y la
   zona de cobertura.
4. Activa **Mensajes** solo si vas a responder por ese canal; si no, usa el
   botón de WhatsApp de la web.
5. Pide reseñas a clientes satisfechos con el enlace directo de la ficha.
6. Responde todas las reseñas, positivas y negativas, en menos de 48 horas.

## 5. Search Console

1. Añade el dominio en <https://search.google.com/search-console>.
2. Verifica con el registro DNS (recomendado) o con la etiqueta HTML.
3. Envía `https://TU_DOMINIO/sitemap.xml`.
4. Revisa **Páginas** e **Indexación** una vez por semana durante el primer mes.

## 6. Mantener la coherencia (NAP)

NAP = Name, Address, Phone. En una cocina oculta la dirección se omite, pero el
nombre, el teléfono y la ciudad deben ser iguales en:

- ficha de Google,
- footer del sitio,
- JSON-LD `Restaurant` del home,
- Instagram y Facebook.

Si en el futuro abres un local, actualiza `site.publicAddress` y la ficha; el
JSON-LD y el footer se actualizan solos.
