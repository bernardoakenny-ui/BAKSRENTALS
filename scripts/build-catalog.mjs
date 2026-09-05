import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';
import { createHash } from 'node:crypto';

const root = join(process.cwd(), 'catalogo');
const output = join(process.cwd(), 'catalogo.json');
const browserOutput = join(process.cwd(), 'catalogo-data.js');
const indexFile = join(process.cwd(), 'index.html');
const versionedAssets = [
  ['styles.css', join(process.cwd(), 'styles.css')],
  ['desktop-catalog.css', join(process.cwd(), 'desktop-catalog.css')],
  ['brand-assets.css', join(process.cwd(), 'brand-assets.css')],
  ['app.js', join(process.cwd(), 'app.js')]
];
const excludedProducts = new Set(['articulos-de-oficina/escanner-portatil', 'articulos-de-oficina/impresora-portatil']);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg', '.avif']);
const categorySettings = JSON.parse(await readFile(join(root, 'categorias.json'), 'utf8'));
const settingsById = new Map(categorySettings.map(category => [category.id, category]));
const genderMap = { hombre: 'ropa-hombre', mujer: 'ropa-mujer', nino: 'ropa-nino', nina: 'ropa-nina' };
const apparelTokens = ['camisa', 'pantalon', 'pantalón', 'falda', 'vestido', 'blusa', 'chaqueta', 'abrigo', 'saco', 'polera', 'short', 'jean', 'jogger', 'overol', 'jumper'];
const sizeTokens = ['xs', 's', 'm', 'l', 'xl', 'xxl', '6', '8', '10', '12', '14', '16', '18'];
const colorTokens = ['blanco', 'negro', 'azul', 'rojo', 'rosa', 'verde', 'gris', 'beige', 'marron', 'cafe', 'plateado', 'dorado', 'amarillo', 'turquesa', 'celeste', 'morado', 'violeta'];
const parseMetadataFromText = value => {
  const cleanName = String(value || '').toLowerCase().replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');
  const tokens = cleanName.split(/[^a-z0-9]+/).filter(Boolean);
  const genderToken = tokens.find(token => Object.hasOwn(genderMap, token));
  const gender = genderToken ? genderMap[genderToken] : null;
  const size = tokens.find(token => sizeTokens.includes(token)) || null;
  const color = tokens.find(token => colorTokens.includes(token)) || null;
  const type = tokens.find(token => apparelTokens.includes(token)) || null;
  return { gender, size, color, type };
};
const parseFileMetadata = fileName => {
  if (!fileName) return { gender: null, size: null, color: null, type: null };
  return parseMetadataFromText(fileName);
};
const buildProductEntry = ({ categoryName, folderName, productName, description, daily, weekly, activationFee, images, directImageName = false }) => {
  const sourceName = directImageName ? directImageName : `${folderName} ${productName || ''}`;
  const metadata = parseFileMetadata(sourceName);
  const derivedCategory = categoryName === 'vestuario' && metadata.gender ? metadata.gender : categoryName;
  const derivedCategoryLabel = settingsById.get(derivedCategory)?.nombre || settingsById.get(categoryName)?.nombre || categoryName;
  const baseTitle = productName || folderName || directImageName || 'Producto';
  const normalizedName = baseTitle.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    id: `${derivedCategory}/${folderName}`,
    category: derivedCategory,
    categoryLabel: derivedCategoryLabel,
    slug: folderName,
    name: normalizedName,
    description: description || 'Prenda disponible para alquiler y producción.',
    daily: Number(daily || 0),
    weekly: Number(weekly || 0),
    activationFee: Number(activationFee || 0),
    includes: '',
    gender: metadata.gender ? metadata.gender.replace('ropa-', '') : null,
    type: metadata.type || null,
    size: metadata.size || null,
    color: metadata.color || null,
    images: images.map(file => relative(process.cwd(), file).replaceAll('\\', '/'))
  };
};
const categories = (await readdir(root, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .sort((a, b) => (settingsById.get(a.name)?.orden ?? 999) - (settingsById.get(b.name)?.orden ?? 999));
const products = [];
for (const category of categories) {
  const categoryPath = join(root, category.name);
  const files = await readdir(categoryPath);
  const directImages = files.filter(file => imageExtensions.has(file.slice(file.lastIndexOf('.')).toLowerCase()));
  const folders = (await readdir(categoryPath, { withFileTypes: true })).filter(entry => entry.isDirectory());

  for (const imageFile of directImages) {
    const imagePath = join(categoryPath, imageFile);
    const directSlug = imageFile.replace(/\.[^.]+$/, '').replaceAll(' ', '-');
    const autoProduct = buildProductEntry({
      categoryName: category.name,
      folderName: directSlug,
      productName: imageFile.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      description: 'Producto agregado automáticamente desde la carpeta de categoría.',
      daily: 0,
      weekly: 0,
      activationFee: 0,
      images: [imagePath],
      directImageName: imageFile
    });
    products.push(autoProduct);
  }

  for (const folder of folders) {
    if (excludedProducts.has(`${category.name}/${folder.name}`)) continue;
    const productPath = join(categoryPath, folder.name);
    const productFiles = await readdir(productPath);
    if (!productFiles.includes('producto.json')) continue;
    const fields = JSON.parse(await readFile(join(productPath, 'producto.json'), 'utf8'));
    const images = productFiles.filter(file => imageExtensions.has(file.slice(file.lastIndexOf('.')).toLowerCase()));
    const firstImage = images[0] || '';
    const metadataSource = firstImage || `${folder.name} ${fields.nombre || ''}`;
    const fileMetadata = parseFileMetadata(metadataSource);
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
const browserContents = `// Archivo generado automáticamente. No editar.\nglobalThis.BAKS_CATALOG = ${JSON.stringify(products)};\n`;
await writeFile(browserOutput, browserContents);
const version = contents => createHash('sha256').update(contents).digest('hex').slice(0, 12);
const catalogVersion = version(browserContents);
const indexContents = await readFile(indexFile, 'utf8');
let versionedIndex = indexContents.replace(/catalogo-data\.js\?v=[^\"]+/, `catalogo-data.js?v=${catalogVersion}`);
for (const [assetName, assetPath] of versionedAssets) {
  versionedIndex = versionedIndex.replace(new RegExp(`${assetName.replace('.', '\\.?')}\\?v=[^\"]+`), `${assetName}?v=${version(await readFile(assetPath))}`);
}
await writeFile(indexFile, versionedIndex);
console.log(`Catálogo actualizado: ${products.length} productos.`);
