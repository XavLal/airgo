# 🚐 AirGoCC - L'App Communautaire des Aires de Camping-Car

AirGoCC est une application mobile développée en React Native / Expo qui permet aux voyageurs en van et camping-car de trouver, partager et valider les meilleures aires de services et de stationnement à travers l'Europe et le monde.

Le projet se distingue par son approche communautaire : les ajouts d'aires par les utilisateurs sont soumis à un système de validation par les pairs pour garantir une base de données fiable et à jour.

## ✨ Fonctionnalités Clés

* **🗺️ Carte Interactive & Géolocalisation :** Affichage fluide des aires autour de l'utilisateur avec regroupement (clustering) des marqueurs.
* **📍 Fiches Détaillées :** Coordonnées, type d'aire (AA, AC, APN...), ville, code postal et description.
* **🤝 Système Participatif :** Ajout de nouvelles aires par la communauté avec un indicateur visuel "En attente de validation".
* **✅ Validation par les Pairs :** Une aire ajoutée est définitivement validée après 3 votes positifs d'autres utilisateurs.
* **📸 Avis & Photos :** Les membres peuvent noter, commenter et ajouter des photos de leurs spots.
* **🔒 Authentification Sécurisée :** Connexion simple et sans mot de passe via un code unique envoyé par email (OTP).
* **🧭 Navigation Intégrée :** Redirection en un clic vers Google Maps, Waze ou Apple Plans.

## 🛠️ Stack Technique

* **Frontend :** React Native avec [Expo](https://expo.dev/) (Expo Router)
* **Langage :** TypeScript (Strict)
* **Backend & Base de Données :** [Supabase](https://supabase.com/)
    * PostgreSQL avec l'extension **PostGIS** pour les requêtes spatiales (calcul de proximité hyper rapide).
    * Supabase Auth (OTP Email) & Supabase Storage (Photos).
* **State Management :** Zustand
* **Performances UI :** `@shopify/flash-list` pour le rendu optimal des longues listes.

## 🚀 Installation & Lancement en local

### Prérequis
* [Node.js](https://nodejs.org/) installé sur votre machine.
* L'application **Expo Go** installée sur votre smartphone (ou un émulateur iOS/Android configuré).
* Un projet Supabase créé.

### Étapes

1. **Cloner le repository :**
   ```bash
   git clone [https://github.com/votre-nom/airgocc.git](https://github.com/votre-nom/airgocc.git)
   cd airgocc
   ```

2. **Installer les dépendances :**
    ```bash
    npm install
    ```

3. **Configurer les variables d'environnement :**
    
    Créez un fichier `.env` à la racine du projet et ajoutez vos clés Supabase :
    ```bash
    EXPO_PUBLIC_SUPABASE_URL=votre_url_supabase
    EXPO_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon_supabase
    ```

4. **Lancer le serveur de développement :**
    ```bash
    npx expo start
    ```
    Scannez le QR code généré avec l'application Expo Go sur votre téléphone pour voir l'application

5. **Configurer la photo Google en cache partagé (Edge Function) :**
   - Ajouter une clé API Google Maps (Places + Street View activés) dans les secrets Supabase :
   ```bash
   supabase secrets set GOOGLE_MAPS_API_KEY=votre_cle_google_maps
   ```
   - Déployer les migrations et la fonction :
   ```bash
   supabase db push
   supabase functions deploy spot-google-media
   ```
   - Principe : au premier affichage d'une fiche aire, l'app appelle la fonction qui tente une photo Google Places, sinon Street View. L'image est stockée dans un bucket public et réutilisée ensuite pour tous les utilisateurs.

## 🗄️ Initialisation de la Base de Données (Script d'import)

La base de données initiale contient plusieurs milliers de points géographiques. Ils sont ingérés via un script Node.js situé dans `/scripts/import-spots.mjs` qui parse un fichier source `ATOTALES_CCI.asc`.

Le fichier d'origine suit ce format : `Longitude,Latitude,"Type Pays Ville CodePostal Aire CCI ID"`

    Exemple : 5.97073,49.63721,"AA LUXEMBOURG HOLZEM Aire CCI 6896"


Créé avec ❤️ pour les nomades et les voyageurs