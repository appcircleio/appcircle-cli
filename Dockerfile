FROM node:26.13.0-alpine3.24 AS BUILDER
WORKDIR /app
COPY yarn.lock .
COPY package.json .
# Node 26 images ship without yarn and corepack.
RUN npm install -g yarn@1.22.22
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn run check:package
RUN yarn run build
RUN echo '//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}' >> ~/.npmrc