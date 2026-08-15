# Initialisation de prisma
npx prisma init

# Pour la premiere migration
npx prisma migrate dev --name init

# Validation du schéma
npx prisma validate --schema prisma/schema.prisma

# Migration
npx prisma migrate dev --name add_others_models --schema prisma/schema.prisma

# Génération du client (avec retry après erreur de permission)
./node_modules/.bin/prisma generate 
# ou 
npx prisma generate --schema prisma/schema.prisma

# Test du serveur
node app.js

### Pour creer une table dans SQLite, lancer la commande suivante:
node ./node_modules/prisma/build/index.js db push
# ou
npx prisma db push

## Pour ouvrir prisma studio
.\node_modules\.bin\prisma.cmd studio

## Pour demarrer le serveur, faire:
node app.js