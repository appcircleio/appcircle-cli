FROM europe-west1-docker.pkg.dev/appcircle/docker-registry/nodedhi:26-alpine3.23-dev AS BUILDER
WORKDIR /app
COPY yarn.lock .
COPY package.json .
# Node 26 images ship without yarn and corepack; --force overwrites a bundled yarn if the base has one.
RUN npm install -g --force yarn@1.22.22
RUN yarn install
COPY . .
RUN yarn run check:package
RUN yarn run build
RUN echo '//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}' >> ~/.npmrc