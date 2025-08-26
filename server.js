// server.js

// 1. Importation des modules nécessaires
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const path = require('path'); // Ajoutez cette ligne pour le module 'path'

// 2. Initialisation de l'application Express
const app = express();
const port = process.env.PORT || 3000;

// 3. Middlewares pour gérer les requêtes et les ressources statiques
app.use(express.json());
app.use(cors());

// Configurez Express pour servir tous les fichiers statiques depuis le répertoire racine
// (celui où se trouve server.js et index.html)
app.use(express.static(__dirname));

// 4. Configuration de la connexion à la base de données
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function connectToDb() {
  try {
    await client.connect();
    console.log("Connecté à la base de données MongoDB !");
  } catch (error) {
    console.error("Erreur de connexion à MongoDB :", error);
  }
}

connectToDb();

// 5. Définition des routes de l'API (vos anciennes fonctions)

// Route pour soumettre un avis
app.post('/submit-avis', async (req, res) => {
  try {
    const { nom, avis, note } = req.body;
    
    if (!nom || !avis || !note) {
      return res.status(400).json({ message: "Les champs 'nom', 'avis' et 'note' sont requis." });
    }

    const database = client.db("phi-agencies");
    const collection = database.collection("avis");

    const newAvis = {
      nom,
      avis,
      note,
      date: new Date()
    };

    await collection.insertOne(newAvis);
    res.status(200).json({ message: "Avis enregistré avec succès !" });

  } catch (error) {
    console.error("Erreur lors de l'enregistrement de l'avis :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
});

// Route pour récupérer les avis
app.get('/get-avis', async (req, res) => {
  try {
    const database = client.db("phi-agencies");
    const collection = database.collection("avis");
    const avis = await collection.find({}).sort({ date: -1 }).toArray();
    res.status(200).json(avis);
  } catch (error) {
    console.error("Erreur lors de la récupération des avis :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
});

// 6. Démarrage du serveur et écoute des requêtes
app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});