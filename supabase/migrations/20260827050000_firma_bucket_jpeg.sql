-- El bucket monitoreo-firmas solo aceptaba PNG (la firma). Se agrega JPEG
-- para la foto de verificacion anti-fraude y se sube el limite de tamano.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg'],
    file_size_limit = 6291456
where id = 'monitoreo-firmas';
