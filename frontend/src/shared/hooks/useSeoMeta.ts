import { useEffect } from 'react';
import { seoPublicApi } from '../api/seo-public.api.ts';

interface SeoMetaOptions {
  // Se usan si Configuración → SEO todavía no tiene nada cargado — así la
  // página nunca queda sin <title>/<meta description> mientras el admin no
  // completó el formulario.
  fallbackTitle: string;
  fallbackDescription: string;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

// Sin SSR, esto solo ayuda al <title> del tab y a un crawler que ejecute JS
// — un scraper de preview (Slack/WhatsApp) que lee el HTML crudo se queda
// con los valores por defecto de index.html, no con esto. og:url/canonical
// usan la URL real de la visita (window.location), nunca un dominio
// inventado. Pensado para las páginas públicas (home, /soporte, /reportar);
// las páginas autenticadas no lo necesitan.
export function useSeoMeta({ fallbackTitle, fallbackDescription }: SeoMetaOptions): void {
  useEffect(() => {
    let cancelled = false;

    seoPublicApi
      .get()
      .then((seo) => {
        if (cancelled) return;
        const title = seo.seoMetaTitle || fallbackTitle;
        const description = seo.seoMetaDescription || fallbackDescription;

        document.title = title;
        upsertMeta('name', 'description', description);
        if (seo.seoMetaKeywords) upsertMeta('name', 'keywords', seo.seoMetaKeywords);
        upsertMeta('property', 'og:title', title);
        upsertMeta('property', 'og:description', description);
        upsertMeta('property', 'og:url', window.location.href);
        upsertCanonical(window.location.href);
      })
      .catch(() => {
        document.title = fallbackTitle;
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackTitle, fallbackDescription]);
}
