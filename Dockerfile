FROM node:20-alpine3.18 AS BUILDER
WORKDIR /app
COPY yarn.lock .
COPY package.json .
RUN yarn install
COPY . .
RUN yarn run check:package
RUN yarn run build
RUN echo '//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}' >> ~/.npmrc