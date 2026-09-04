/* config-supabase.js — v15.71.1
   ────────────────────────────────────────────────────────────────
   Conexión del portal con la base de resultados de ventas (Supabase).

   ⚠ ACÁ VA SOLO LA CLAVE PÚBLICA (anon). Es pública por diseño: cualquiera
   que abra el portal la ve. La seguridad no la da la clave sino las políticas
   de la base — con el script `Claude_Outputs\Scripts_Auxiliares\supabase\
   001_resultados.sql` el rol anon puede GUARDAR y nada más: no puede leer ni
   borrar. La clave secreta (service_role) va en el `.env`, que está en
   .gitignore y nunca sale de la máquina.

   Cómo completarlo (Nicolás):
     1. Supabase → Project Settings → API.
     2. Copiar `Project URL` en `url` y la clave `anon public` en `anon`.
     3. Guardar este archivo en OneDrive\PEGSA_Portal\js\ — el tick lo copia
        al repo solo.

   Con los dos campos vacíos el portal sigue funcionando igual que antes:
   el Informe PDF baja el JSON al disco (el mecanismo de v15.69 B).
*/
window.PEGSA_SB = {
  url:  "",   // https://xxxxxxxxxxxx.supabase.co
  anon: ""    // eyJhbGciOi...
};
