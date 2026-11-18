import { useContext } from 'react';
import { CustomerContext, QuoteListContext, type CustomerValue, type QuoteListValue } from './customerContext';

/** Sesión del portal de clientes (separada de la del personal). */
export function useCustomer(): CustomerValue {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomer debe usarse dentro de <CustomerProvider>');
  return ctx;
}

/** Lista de solicitud de cotización del catálogo (se conserva en el navegador). */
export function useQuoteList(): QuoteListValue {
  const ctx = useContext(QuoteListContext);
  if (!ctx) throw new Error('useQuoteList debe usarse dentro de <CustomerProvider>');
  return ctx;
}
