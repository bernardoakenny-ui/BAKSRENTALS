import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';

const root = join(process.cwd(), 'catalogo');
const output = join(process.cwd(), 'catalogo.json');
const browserOutput = join(process.cwd(), 'catalogo-data.js');
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);
const categorySettings = JSON.parse(await readFile(join(root, 'categorias.json'), 'utf8'));
const settingsById = new Map(categorySettings.map(category => [category.id, category]));
const genderMap = { hombre: 'ropa-hombre', mujer: 'ropa-mujer', nino: 'ropa-nino', nina: 'ropa-nina' };
const apparelTokens = ['camisa', 'pantalon', 'pantalón', 'falda', 'vestido', 'blusa', 'chaqueta', 'abrigo', 'saco', 'polera', 'short', 'jean', 'jogger', 'overol', 'jumper'];
const sizeTokens = ['xs', 's', 'm', 'l', 'xl', 'xxl', '6', '8', '10', '12', '14', '16', '18'];
const colorTokens = ['blanco', 'negro', 'azul', 'rojo', 'rosa', 'verde', 'gris', 'beige', 'marron', 'cafe', 'plateado', 'dorado', 'amarillo', 'turquesa', 'celeste', 'morado', 'violeta'];
const parseFileMetadata = fileName => {
  const cleanName = fileName.replace(/\.[^.]+$/, '').toLowerCase();
  const tokens = cleanName.replace(/[_]+/g, ' ').split(/[^a-z0-9]+/).filter(Boolean);
  const genderToken = tokens.find(token => Object.hasOwn(genderMap, token));
  const gender = genderToken ? genderMap[genderToken] : null;
  const size = tokens.find(token => sizeTokens.includes(token)) || null;
  const color = tokens.find(token => colorTokens.includes(token)) || null;
  const type = tokens.find(token => apparelTokens.includes(token)) || null;
  return { gender, size, color, type };
};
const categories = (await readdir(root, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .sort((a, b) => (settingsById.get(a.name)?.orden ?? 999) - (settingsById.get(b.name)?.orden ?? 999));
const products = [];
for (const category of categories) {
  const categoryPath = join(root, category.name);
  const folders = await readdir(categoryPath, { withFileTypes: true });
  for (const folder of folders.filter(entry => entry.isDirectory())) {
    const productPath = join(categoryPath, folder.name);
    const files = await readdir(productPath);
    if (!files.includes('producto.json')) continue;
    const fields = JSON.parse(await readFile(join(productPath, 'producto.json'), 'utf8'));
    const images = files.filter(file => imageExtensions.has(file.slice(file.lastIndexOf('.')).toLowerCase()));
    const firstImage = images[0] || '';
    const fileMetadata = parseFileMetadata(firstImage);
    const derivedCategory = category.name === 'vestuario' && fileMetadata.gender ? fileMetadata.gender : category.name;
    const derivedCategoryLabel = settingsById.get(derivedCategory)?.nombre || settingsById.get(category.name)?.nombre || category.name;
    products.push({
      id: `${derivedCategory}/${folder.name}`,
      category: derivedCategory,
      categoryLabel: derivedCategoryLabel,
      slug: folder.name,
      name: fields.nombre || basename(folder.name).replaceAll('-', ' '),
      description: fields.descripcion || '',
      daily: Number(fields.precioDiario || 0),
      weekly: Number(fields.precioSemanal || 0),
      activationFee: Number(fields.precioActivacion || 0),
      includes: fields.incluye || '',
      gender: fileMetadata.gender ? fileMetadata.gender.replace('ropa-', '') : null,
      type: fileMetadata.type || null,
      size: fileMetadata.size || null,
      color: fileMetadata.color || null,
      images: images.map(file => relative(process.cwd(), join(productPath, file)).replaceAll('\\', '/'))
    });
  }
}
await writeFile(output, `${JSON.stringify(products, null, 2)}\n`);
await writeFile(browserOutput, `// Archivo generado automáticamente. No editar.\nglobalThis.BAKS_CATALOG = ${JSON.stringify(products)};\n`);
console.log(`Catálogo actualizado: ${products.length} productos.`);
