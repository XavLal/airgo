# 🏕️ Cahier des Charges - Application Aires Camping-Car
## 1. Vision Globale du Projet
Application mobile communautaire répertoriant les aires de camping-car (Europe/Monde). Les utilisateurs peuvent trouver des aires autour d'eux sur une carte, filtrer selon les services, ajouter de nouvelles aires (avec système de validation par la communauté), laisser des avis et des photos.
Stack Technique :

Frontend : React Native avec Expo (TypeScript).

Backend & DB : Supabase (PostgreSQL avec extension PostGIS, Auth, Storage).

Gestion d'état : Zustand (pour les filtres et le cache).

Cartographie : react-native-maps.

## 2. Architecture de la Base de Données (Supabase)
Demande à Cursor de créer les migrations SQL pour ces tables dans Supabase :

Table profiles : Liée à Supabase Auth. Contient l'ID, le pseudo, la date de création, et un compteur de "points de confiance" (gamification).

Table spots (Aires) :
- id (UUID, Clé primaire)
- name (Texte) - Nom de l'aire
- city (Texte) - Ville
- postal_code (Texte) - Code postal
- description (Texte) - Informations spécifiques issues de ton fichier .asc ou ajoutées par les utilisateurs
- location (Point Géographique - PostGIS geography(POINT)) - Stocke la Longitude et Latitude
- type (Enum : AA, AC, APN, etc.)
- is_verified (Booléen, true pour l'import initial, false pour les ajouts utilisateurs)
- validation_count (Entier, défaut 0)
- created_by (UUID de l'utilisateur, ou NULL si import initial)

Table spot_validations : Historique des votes pour valider une aire (ID_spot, ID_user, vote +1/-1).

Table reviews : Avis des utilisateurs (ID_spot, ID_user, note sur 5, commentaire, date).

Table photos : Liens vers les images stockées dans Supabase Storage (ID_spot, ID_user, URL de l'image).

## 3. Plan d'Action Vibe Coding (Étape par Étape pour Cursor)
Règle pour Cursor : N'exécute qu'une seule phase à la fois. Attends ma validation avant de passer à la phase suivante.

### Phase 1 : Initialisation & Parsing des données (Scripts)
Action 1 : Initialiser un projet Expo (TypeScript, navigation avec Expo Router).

Action 2 : Configurer le client Supabase dans le projet React Native.

Action 3 : Ingestion du fichier .asc. Demande à Cursor de créer un script Node.js (exécuté en local) qui lit le fichier ATOTALES_CCI.asc. Le script doit parser chaque ligne (Longitude, Latitude, Description), extraire le Type (APN, AC, ASN...), le Pays, la Ville et le nom, puis insérer ces milliers de points en "bulk" dans la table spots de Supabase avec is_verified = true.

### Phase 2 : Refonte des Icônes & Design System
Action 1 : Fournis tes fichiers .bmp à Claude Sonnet dans Cursor et demande-lui de générer le code SVG (ou d'utiliser une bibliothèque comme lucide-react-native) pour créer un dictionnaire d'icônes modernes pour chaque type d'aire (AA, AC, ACF, ACS, AS, ASN, APN, APCC).

Action 2 : Créer un thème global (Couleurs principales : nature, vert, terre ; typographie lisible).

### Phase 3 : Authentification
Action 1 : Implémenter le flux d'inscription/connexion avec Supabase Auth (Email OTP - envoi de code unique).

Action 2 : Créer l'écran de profil utilisateur permettant de voir son pseudo et ses contributions.

### Phase 4 : Le Cœur de l'App (Carte & Liste)
Action 1 : Intégrer react-native-maps. Demander à l'utilisateur l'autorisation de géolocalisation.

Action 2 : Créer une "Edge Function" ou une requête RPC (Remote Procedure Call) dans Supabase qui utilise PostGIS pour renvoyer uniquement les aires dans un rayon donné (ex: 50km) autour du centre de l'écran de la carte, pour ne pas surcharger le téléphone avec les dizaines de milliers de points de ton fichier .asc.

Action 3 : Implémenter le "Clustering" (regroupement des points quand on dézoome) avec react-native-map-clustering.

Action 4 : Créer la vue "Liste" qui affiche les mêmes points triés par proximité du plus proche au plus éloigné.

### Phase 5 : Fiche Détail & Fonctionnalités d'Aide
Action 1 : Créer l'écran détail d'une aire (Nom, Icône du type, Coordonnées).

Action 2 : Ajouter le bouton "S'y rendre" qui utilise react-native-app-link pour ouvrir Google Maps ou Waze avec les coordonnées GPS.

Action 3 : Afficher les avis et photos associés à cette aire.

### Phase 6 : Côté Participatif & Social (Le nerf de la guerre)
Action 1 : Créer le formulaire "Ajouter une aire" (sélection du type, prise des coordonnées GPS actuelles ou placement sur la carte). Insertion dans Supabase avec is_verified = false.

Action 2 : Sur la carte, afficher les aires is_verified = false avec une icône visuellement différente (ex: en filigrane ou avec un badge ⚠️).

Action 3 : Implémenter le système de vote : sur une aire non vérifiée, un bouton "Je valide l'existence de cette aire". Coder le "Trigger" (déclencheur) SQL dans Supabase : si validation_count atteint 3, is_verified passe à true.

Action 4 : Formulaire pour laisser un avis, une note (1 à 5 étoiles) et uploader une photo (via Supabase Storage).

### Phase 7 : Fonctionnalités Avancées (Post-MVP)
Action 1 : Ajouter un menu de filtres par "Type" d'aires. La requête Supabase doit se mettre à jour dynamiquement.

Action 2 : Mode Hors-ligne : Implémenter AsyncStorage ou WatermelonDB pour mettre en cache les aires du pays ou de la région consultée afin qu'elles apparaissent même sans réseau 4G/5G.