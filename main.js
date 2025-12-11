import express from 'express'; import multer from 'multer'; import { Command } from 'commander'; import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url'; import swaggerUi from 'swagger-ui-express'; import swaggerJsdoc from 'swagger-jsdoc';

const { host, port, cache } = new Command().requiredOption('-h, --host <host>', 'Хост').requiredOption('-p, --port <port>', 'Порт').requiredOption('-c, --cache <cache>', 'Папка кешу').parse().opts();
const app = express(), db = [], url = `http://${host}:${port}`, dir = path.dirname(fileURLToPath(import.meta.url)), upload = multer({ dest: cache });
const find = req => db.find(i => i.id === req.params.id);
fs.mkdirSync(cache, { recursive: true });

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: { title: 'Inventory API', version: '1.0' },
        servers: [{ url }],
        components: {
            schemas: {
                Item: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, photo: { type: 'string' }, photoUrl: { type: 'string' } } }
            }
        }
    },
    apis: [fileURLToPath(import.meta.url)]
};
app.use(express.json()); app.use(express.urlencoded({ extended: true })); app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerJsdoc(swaggerOptions)));

/** @swagger /{file}: { get: { summary: Get HTML Forms, parameters: [{ name: 'file', in: 'path', required: true, schema: { type: 'string', enum: ['RegisterForm.html', 'SearchForm.html'] } }], responses: { 200: { description: HTML File, content: { 'text/html': {} } } } } } */
app.get(['/RegisterForm.html', '/SearchForm.html'], (req, res) => res.sendFile(path.join(dir, req.path)));

/** @swagger /register: { post: { summary: Add Item, requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { inventory_name: { type: 'string' }, description: { type: 'string' }, photo: { type: 'string', format: 'binary' } }, required: ['inventory_name'] } } } }, responses: { 201: { description: Created }, 400: { description: Bad Request } } } } */
app.post('/register', upload.single('photo'), (req, res) => req.body.inventory_name ? (db.push({ id: `${Date.now()}`, name: req.body.inventory_name, description: req.body.description || '', photo: req.file?.filename }) && res.sendStatus(201)) : res.sendStatus(400));

/** @swagger /inventory: { get: { summary: List Items, responses: { 200: { description: Array of items, content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Item' } } } } } } } } */
app.get('/inventory', (req, res) => res.json(db.map(i => ({ ...i, photoUrl: i.photo ? `${url}/inventory/${i.id}/photo` : null }))));

/** @swagger /inventory/{id}: { 
 *      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
 *      get: { summary: Get Item, responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } }, 404: { description: Not Found } } },
 *      put: { summary: Update Item, requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } } } } }, responses: { 200: { description: Updated }, 404: { description: Not Found } } },
 *      delete: { summary: Delete Item, responses: { 200: { description: Deleted }, 404: { description: Not Found } } } 
 * } */
app.route('/inventory/:id')
    .get((req, res) => { const i = find(req); i ? res.json(i) : res.sendStatus(404); })
    .put((req, res) => { const i = find(req); i ? res.json(Object.assign(i, req.body, { id: i.id })) : res.sendStatus(404); })
    .delete((req, res) => { const x = db.findIndex(i => i.id === req.params.id); x >= 0 ? (db.splice(x, 1) && res.sendStatus(200)) : res.sendStatus(404); });

/** @swagger /inventory/{id}/photo: { 
 *      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
 *      get: { summary: Get Photo, responses: { 200: { description: Image, content: { 'image/jpeg': {} } }, 404: { description: Not Found } } }, 
 *      put: { summary: Upload Photo, requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { photo: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: Uploaded }, 404: { description: Not Found } } } 
 * } */
app.route('/inventory/:id/photo')
    .get((req, res) => find(req)?.photo ? res.type('jpg').sendFile(path.resolve(cache, find(req).photo)) : res.sendStatus(404))
    .put(upload.single('photo'), (req, res) => { const i = find(req); if (i && req.file) i.photo = req.file.filename; res.sendStatus(i ? 200 : 404); });

/** @swagger /search: { post: { summary: Search Item, requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, has_photo: { type: 'string', enum: ['on', 'off'] } }, required: ['id'] } } } }, responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } }, 404: { description: Not Found } } } } */
app.post('/search', (req, res) => {
    const i = db.find(x => x.id === req.body.id);
    i ? res.json({ ...i, description: req.body.has_photo === 'on' ? `${i.description} Photo: ${i.photo ? `${url}/inventory/${i.id}/photo` : 'None'}` : i.description }) : res.sendStatus(404);
});

app.use((req, res) => res.sendStatus(405));
app.listen(port, host, () => console.log(`Сервер запущено: ${url}\nКеш: ${path.resolve(cache)}\nНатисни Ctrl+C для зупинки.`));