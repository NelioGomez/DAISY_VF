/* Foto del producto en el formulario (mejora n.° 4): subir (botón o arrastrar), cambiar o quitar,
   con vista previa. La foto se reduce en el navegador y se sube al guardar el producto. También
   se puede indicar una imagen del catálogo del equipo (/product-images/…) o una URL http(s). */
import { useEffect, useRef, useState } from 'react';
import { ProductImage } from '../../components/common/ProductImage';
import { useToast } from '../../components/feedback/useToast';
import { ACCEPTED_IMAGES, isUploadedImage, shrinkImage } from '../../utils/images';

const MAX_UPLOAD = 2 * 1024 * 1024;
const TYPES = ACCEPTED_IMAGES.split(',');

export interface PendingPhoto {
  blob: Blob;
  url: string;
}

interface Props {
  /** Ruta o URL guardada en el producto ('' = sin foto). */
  imagen: string;
  onImagen(v: string): void;
  /** Foto nueva elegida y aún no subida. */
  pendiente: PendingPhoto | null;
  onPendiente(p: PendingPhoto | null): void;
  fallback: string;
}

export function ProductPhotoField({ imagen, onImagen, pendiente, onPendiente, fallback }: Props) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verRuta, setVerRuta] = useState(!!imagen && !isUploadedImage(imagen));

  // Libera la vista previa local al cambiarla o al cerrar el formulario.
  useEffect(() => () => {
    if (pendiente) URL.revokeObjectURL(pendiente.url);
  }, [pendiente]);

  const elegir = async (file: File | undefined) => {
    if (!file) return;
    if (!TYPES.includes(file.type)) return toast('Use una foto JPG, PNG o WebP', 'err');
    if (file.size > 20 * 1024 * 1024) return toast('La foto es demasiado grande (máx. 20 MB antes de reducirla)', 'err');
    setBusy(true);
    const blob = await shrinkImage(file);
    setBusy(false);
    if (blob.size > MAX_UPLOAD) return toast('Aun reducida, la foto pasa de 2 MB. Pruebe con otra.', 'err');
    onPendiente({ blob, url: URL.createObjectURL(blob) });
  };

  const quitar = () => {
    if (pendiente) onPendiente(null);
    else onImagen('');
  };

  const preview = pendiente?.url ?? (imagen || null);
  const estado = pendiente ? 'Foto nueva: se sube al guardar' : imagen ? (isUploadedImage(imagen) ? 'Foto subida' : 'Imagen del catálogo o enlace') : 'Sin foto: se muestra el ícono de la categoría';

  return (
    <div
      className={`photo-field ${drag ? 'is-drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void elegir(e.dataTransfer.files[0]);
      }}
    >
      <ProductImage src={preview} size={96} fallback={fallback} alt={preview ? 'Vista previa de la foto del producto' : ''} />
      <div className="photo-actions">
        <b>Foto del producto</b>
        <span className="photo-hint" aria-live="polite">
          {busy ? 'Preparando la foto…' : estado}
        </span>
        <div className="row">
          <button type="button" className="b b-out b-sm" onClick={() => input.current?.click()} disabled={busy}>
            📷 {preview ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {preview && (
            <button type="button" className="b b-out b-sm" onClick={quitar} disabled={busy}>
              Quitar foto
            </button>
          )}
          <button type="button" className="link-btn" onClick={() => setVerRuta((v) => !v)} aria-expanded={verRuta}>
            {verRuta ? 'Ocultar enlace' : 'Usar imagen del catálogo o enlace'}
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_IMAGES}
          hidden
          aria-label="Elegir foto del producto"
          onChange={(e) => {
            void elegir(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {verRuta && (
          <input
            value={isUploadedImage(imagen) ? '' : imagen}
            placeholder="/product-images/catalogo/image2.png o https://…"
            aria-label="Ruta o enlace de la imagen"
            onChange={(e) => {
              onPendiente(null);
              onImagen(e.target.value);
            }}
          />
        )}
        <span className="photo-hint">JPG, PNG o WebP. Se reduce a 1200 px antes de subirla; también puede arrastrarla aquí.</span>
      </div>
    </div>
  );
}
