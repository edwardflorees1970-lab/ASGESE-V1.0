# Cloudflare Turnstile en AGEBRE

El login integra Cloudflare Turnstile mediante la validación nativa de Supabase Auth.

## Producción

1. Cree un widget **Managed** en Cloudflare Turnstile.
2. Autorice únicamente los dominios de producción y vista previa que correspondan.
3. Configure en Vercel `VITE_TURNSTILE_ENABLED=true` y `VITE_TURNSTILE_SITE_KEY` con la site key pública.
4. En Supabase abra **Authentication > Bot and Abuse Protection**, habilite CAPTCHA, seleccione **Turnstile** y registre el secret del widget.
5. Despliegue y compruebe un acceso válido, uno rechazado y la expiración del desafío.

El secret no debe copiarse a `.env`, Vercel, React ni GitHub. Supabase lo almacena y realiza la validación del lado servidor.

## Desarrollo

En desarrollo se utiliza automáticamente la site key oficial de prueba de Cloudflare, salvo que se configure `VITE_TURNSTILE_ENABLED=false`.

Si se ejecuta Supabase local con CAPTCHA habilitado, use exclusivamente como secret de desarrollo la clave oficial de prueba:

```text
1x0000000000000000000000000000000AA
```

Nunca utilice credenciales de prueba en producción.
