import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';

const root = join(process.cwd(), 'catalogo');
const output = join(process.cwd(), 'catalogo.json');
const browserOutput = join(process.cwd(), 'catalogo-data.js');
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);
const categorySettings = JSON.parse(await readFile(join(root, 'categorias.json'), 'utf8'));
const settingsById = new Map(categorySettings.map(category => [category.id, category]));

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
    products.push({
      id: `${category.name}/${folder.name}`,
      category: category.name,
      categoryLabel: settingsById.get(category.name)?.nombre || category.name,
      slug: folder.name,
      name: fields.nombre || basename(folder.name).replaceAll('-', ' '),
      description: fields.descripcion || '',
      daily: Number(fields.precioDiario || 0),
      weekly: Number(fields.precioSemanal || 0),
      activationFee: Number(fields.precioActivacion || 0),
      includes: fields.incluye || '',
      images: images.map(file => relative(process.cwd(), join(productPath, file)).replaceAll('\\', '/'))
    });
  }
}
await writeFile(output, `${JSON.stringify(products, null, 2)}\n`);
await writeFile(browserOutput, `// Archivo generado automáticamente. No editar.\nglobalThis.BAKS_CATALOG = ${JSON.stringify(products)};\n`);
console.log(`Catálogo actualizado: ${products.length} productos.`);
