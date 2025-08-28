// server.js

// 1. Importation des modules nécessaires
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { MongoClient } = require('mongodb');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const LRU = require('lru-cache');

// 2. Initialisation de l'application Express
const app = express();
const port = process.env.PORT || 3000;

// 3. Middlewares
app.use(compression());
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// 4. Connexion à MongoDB
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

let db, avisCollection;

async function connectToDb() {
    try {
        await client.connect();
        console.log("Connecté à MongoDB !");
        db = client.db('Business');
        avisCollection = db.collection('avis');
    } catch (error) {
        console.error("Erreur de connexion à MongoDB :", error);
        throw error;
    }
}

// 5. Route principale
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

// 6. Cache LRU pour images (500 max)
const imageCache = new LRU({
    max: 500,
    ttl: 1000 * 60 * 10, // 10 minutes
    fetchMethod: async (key) => {
        const [filename, widthStr] = key.split('_');
        const width = parseInt(widthStr);

        const filepath = path.join(__dirname, 'public/images', filename);
        if (!fs.existsSync(filepath)) throw new Error("Image non trouvée");

        const ext = path.extname(filename).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            return fs.promises.readFile(filepath);
        }

        const buffer = await sharp(filepath)
            .resize({ width })
            .webp({ quality: 80 })
            .toBuffer();

        return buffer;
    }
});

// 7. Route pour les images avec cache
app.get('/images/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const width = req.query.width ? parseInt(req.query.width) : 800;
        const cacheKey = `${filename}_${width}`;

        const buffer = await imageCache.fetch(cacheKey);
        res.set('Content-Type', 'image/webp');
        res.set('Cache-Control', 'public, max-age=600'); // cache navigateur 10 min
        res.send(buffer);
    } catch (error) {
        console.error("Erreur image :", error);
        res.status(404).send(error.message);
    }
});

// 8. Routes API pour les avis
app.post('/submit-avis', async (req, res) => {
    try {
        if (!avisCollection) return res.status(500).json({ message: "DB non prête." });

        const { nom, avis, note } = req.body;
        if (!nom || !avis || !note) {
            return res.status(400).json({ message: "Les champs 'nom', 'avis' et 'note' sont requis." });
        }

        const newAvis = { nom, avis, note, date: new Date() };
        await avisCollection.insertOne(newAvis);

        res.status(200).json({ message: "Avis enregistré avec succès !" });
    } catch (error) {
        console.error("Erreur lors de l'enregistrement de l'avis :", error);
        res.status(500).json({ message: "Erreur serveur." });
    }
});

app.get('/get-avis', async (req, res) => {
    try {
        if (!avisCollection) return res.status(500).json({ message: "DB non prête." });

        const avis = await avisCollection.find({}).sort({ date: -1 }).toArray();
        res.status(200).json(avis);
    } catch (error) {
        console.error("Erreur récupération avis :", error);
        res.status(500).json({ message: "Erreur serveur." });
    }
});

// 9. Démarrage du serveur après connexion DB
async function startServer() {
    try {
        await connectToDb();
        app.listen(port, () => {
            console.log(`Serveur démarré sur le port ${port}`);
        });
    } catch (error) {
        console.error("Impossible de démarrer le serveur :", error);
        process.exit(1);
    }
}

startServer();
