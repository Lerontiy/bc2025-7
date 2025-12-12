import 'dotenv/config'; 
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { Command } from 'commander';
import sequelize from './src/entity/db.config.js'; 
import { Item } from './src/entity/Item.model.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { host, port, cache } = new Command()
    .requiredOption('-h, --host <host>', 'Хост')
    .requiredOption('-p, --port <port>', 'Порт')
    .requiredOption('-c, --cache <cache>', 'Папка кешу').parse().opts();

const dir = path.dirname(fileURLToPath(import.meta.url)), url = `http://${host}:${port}`, upload = multer({ dest: cache });

fs.mkdirSync(cache, { recursive: true });

const find = (req) => Item.findByPk(req.params.id);

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
const app = express();
app.use(express.json()); app.use(express.urlencoded({ extended: true })); app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerJsdoc(swaggerOptions)));

/** @swagger /{file}: { get: { summary: Get HTML Forms, parameters: [{ name: 'file', in: 'path', required: true, schema: { type: 'string', enum: ['RegisterForm.html', 'SearchForm.html'] } }], responses: { 200: { description: HTML File, content: { 'text/html': {} } } } } } */
app.get(['/RegisterForm.html', '/SearchForm.html'], (req, res) => res.sendFile(path.join(dir, req.path)));

/** @swagger /register: { post: { summary: Add Item, requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { inventory_name: { type: 'string' }, description: { type: 'string' }, photo: { type: 'string', format: 'binary' } }, required: ['inventory_name'] } } } }, responses: { 201: { description: Created }, 400: { description: Bad Request } } } } */
app.post('/register', upload.single('photo'), async (req, res) => {
    if (!req.body.inventory_name) {
        return res.sendStatus(400);
    }
    
    try {
        await Item.create({
            name: req.body.inventory_name,
            description: req.body.description || '',
            photo: req.file?.filename || null 
        });
        res.sendStatus(201);
    } catch (error) {
        console.error('Помилка збереження елемента:', error);
        res.sendStatus(500);
    }
});

/** @swagger /inventory: { get: { summary: List Items, responses: { 200: { description: Array of items, content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Item' } } } } } } } } */
app.get('/inventory', async (req, res) => {
    try {
        const items = await Item.findAll();
        res.json(items.map(i => ({ 
            ...i.toJSON(), 
            photoUrl: i.photo ? `${url}/inventory/${i.id}/photo` : null 
        })));
    } catch (error) {
        console.error('Помилка отримання списку:', error);
        res.sendStatus(500);
    }
});

/** @swagger /inventory/{id}: { 
 *      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
 *      get: { summary: Get Item, responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } }, 404: { description: Not Found } } },
 *      put: { summary: Update Item, requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } } } } }, responses: { 200: { description: Updated }, 404: { description: Not Found } } },
 *      delete: { summary: Delete Item, responses: { 200: { description: Deleted }, 404: { description: Not Found } } } 
 * } */
app.route('/inventory/:id')
    .get(async (req, res) => { 
        const i = await find(req); 
        i ? res.json(i) : res.sendStatus(404); 
    })
    .put(async (req, res) => { 
        const i = await find(req);
        if (i) {
            await i.update(req.body);
            return res.json(i);
        }
        res.sendStatus(404);
    })
    .delete(async (req, res) => { 
        const affectedRows = await Item.destroy({ where: { id: req.params.id } });
        affectedRows > 0 ? res.sendStatus(200) : res.sendStatus(404);
    });

/** @swagger /inventory/{id}/photo: { 
 *      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
 *      get: { summary: Get Photo, responses: { 200: { description: Image, content: { 'image/jpeg': {} } }, 404: { description: Not Found } } }, 
 *      put: { summary: Upload Photo, requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { photo: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: Uploaded }, 404: { description: Not Found } } } 
 * } */
app.route('/inventory/:id/photo')
    .get(async (req, res) => { 
        const item = await find(req);
        const photoFilename = item?.photo;

        if (photoFilename) {
            const filePath = path.resolve(cache, photoFilename);
            if (fs.existsSync(filePath)) {
                 return res.type('jpg').sendFile(filePath);
            }
        }
        res.sendStatus(404);
    })
    .put(upload.single('photo'), async (req, res) => { 
        const i = await find(req);
        if (i && req.file) {
            i.photo = req.file.filename;
            await i.save(); 
            return res.sendStatus(200);
        }
        res.sendStatus(i ? 400 : 404);
    });

/** @swagger /search: { post: { summary: Search Item, requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, has_photo: { type: 'string', enum: ['on', 'off'] } }, required: ['id'] } } } }, responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } }, 404: { description: Not Found } } } } */
app.post('/search', async (req, res) => {
    const searchId = req.body.id; 
    if (!searchId) {
        return res.sendStatus(400); 
    }

    try {
        const item = await Item.findByPk(searchId); 
        if (!item) {
            return res.sendStatus(404); 
        }

        const itemJson = item.toJSON();
        const descriptionWithPhoto = req.body.has_photo === 'on' 
            ? `${itemJson.description} Photo: ${itemJson.photo ? `${url}/inventory/${itemJson.id}/photo` : 'None'}` 
            : itemJson.description;
        res.json({
            ...itemJson,
            description: descriptionWithPhoto
        });
    } catch (error) {
        console.error('Помилка пошуку елемента:', error);
        res.sendStatus(500);
    }
});

app.use((req, res) => res.sendStatus(405));

sequelize.authenticate()
    .then(async () => {
        console.log("З'єднання з БД встановлено.");
        app.listen(port, host, () => console.log(`Сервер запущено: ${url}\nКеш: ${path.resolve(cache)}\nНатисни Ctrl+C для зупинки.`));
    })
    .catch(error => console.log("Помилка з'єднання з БД:", error));