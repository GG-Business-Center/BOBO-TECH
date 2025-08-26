// server.js

// 1. Importation des modules nécessaires
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { MongoClient } = require('mongodb');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 2. Initialisation de l'application Express
const app = express();
const port = process.env.PORT || 3000;

// 3. Middlewares
app.use(compression()); // compresse automatiquement les fichiers
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
    console.log("Connecté à la base de données MongoDB !");
    db = client.db('Business'); // Nom de la base
    avisCollection = db.collection('avis'); // Nom de la collection
  } catch (error) {
    console.error("Erreur de connexion à MongoDB :", error);
  }
}

connectToDb();

// 5. Route principale
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// 6. Compression et adaptation automatique des images
app.get('/images/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join(__dirname, 'public/images', filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).send("Image non trouvée");
    }

    // Largeur max pour adaptation mobile
    const width = req.query.width ? parseInt(req.query.width) : 800;

    const ext = path.extname(filename).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return res.sendFile(filepath); // fichier non image
    }

    const buffer = await sharp(filepath)
      .resize({ width })
      .webp({ quality: 80 })
      .toBuffer();

    res.set('Content-Type', 'image/webp');
    res.send(buffer);

  } catch (error) {
    console.error("Erreur image :", error);
    res.status(500).send("Erreur serveur");
  }
});

// 7. Routes API pour les avis
app.post('/submit-avis', async (req, res) => {
  try {
    const { nom, avis, note } = req.body;
    if (!nom || !avis || !note) {
      return res.status(400).json({ message: "Les champs 'nom', 'avis' et 'note' sont requis." });
    }

    const newAvis = { nom, avis, note, date: new Date() };
    await avisCollection.insertOne(newAvis);

    res.status(200).json({ message: "Avis enregistré avec succès !" });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de l'avis :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
});

app.get('/get-avis', async (req, res) => {
  try {
    const avis = await avisCollection.find({}).sort({ date: -1 }).toArray();
    res.status(200).json(avis);
  } catch (error) {
    console.error("Erreur lors de la récupération des avis :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
});

// 8. Démarrage du serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});
